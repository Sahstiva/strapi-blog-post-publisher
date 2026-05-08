import { describe, it, expect, vi, beforeEach } from 'vitest';
import { isAllowedWebhookUrl } from '../webhook';
import webhookFactory from '../webhook';

describe('isAllowedWebhookUrl', () => {
  it('allows valid public HTTPS URLs', () => {
    expect(isAllowedWebhookUrl('https://example.com/webhook')).toBe(true);
    expect(isAllowedWebhookUrl('https://hooks.slack.com/services/xxx')).toBe(true);
  });

  it('allows valid public HTTP URLs', () => {
    expect(isAllowedWebhookUrl('http://example.com/rebuild')).toBe(true);
  });

  it('allows empty string (no webhook configured)', () => {
    expect(isAllowedWebhookUrl('')).toBe(true);
  });

  it('blocks localhost', () => {
    expect(isAllowedWebhookUrl('http://localhost:3000/api')).toBe(false);
    expect(isAllowedWebhookUrl('http://localhost/admin')).toBe(false);
  });

  it('blocks 127.x.x.x loopback', () => {
    expect(isAllowedWebhookUrl('http://127.0.0.1:1337/admin')).toBe(false);
    expect(isAllowedWebhookUrl('http://127.0.0.2/test')).toBe(false);
  });

  it('blocks IPv6 loopback', () => {
    expect(isAllowedWebhookUrl('http://[::1]:3000/')).toBe(false);
  });

  it('blocks private 10.x.x.x range', () => {
    expect(isAllowedWebhookUrl('http://10.0.0.1/internal')).toBe(false);
    expect(isAllowedWebhookUrl('http://10.255.255.255/api')).toBe(false);
  });

  it('blocks private 172.16-31.x.x range', () => {
    expect(isAllowedWebhookUrl('http://172.16.0.1/api')).toBe(false);
    expect(isAllowedWebhookUrl('http://172.31.255.255/api')).toBe(false);
  });

  it('allows public 172.x.x.x outside private range', () => {
    expect(isAllowedWebhookUrl('http://172.15.0.1/api')).toBe(true);
    expect(isAllowedWebhookUrl('http://172.32.0.1/api')).toBe(true);
  });

  it('blocks private 192.168.x.x range', () => {
    expect(isAllowedWebhookUrl('http://192.168.1.1/api')).toBe(false);
    expect(isAllowedWebhookUrl('http://192.168.0.100/hook')).toBe(false);
  });

  it('blocks AWS metadata endpoint', () => {
    expect(isAllowedWebhookUrl('http://169.254.169.254/latest/meta-data/')).toBe(false);
  });

  it('blocks 0.0.0.0', () => {
    expect(isAllowedWebhookUrl('http://0.0.0.0:3000/')).toBe(false);
  });

  it('blocks .local and .internal domains', () => {
    expect(isAllowedWebhookUrl('http://myservice.local/api')).toBe(false);
    expect(isAllowedWebhookUrl('http://db.internal/hook')).toBe(false);
  });

  it('rejects non-HTTP protocols', () => {
    expect(isAllowedWebhookUrl('ftp://example.com/file')).toBe(false);
    expect(isAllowedWebhookUrl('file:///etc/passwd')).toBe(false);
  });

  it('rejects invalid URLs', () => {
    expect(isAllowedWebhookUrl('not-a-url')).toBe(false);
    expect(isAllowedWebhookUrl('://missing-protocol')).toBe(false);
  });
});

describe('webhook service', () => {
  const createMockStrapi = (webhookUrl = '') => {
    const storeData: Record<string, unknown> = { webhookUrl };
    const storeInstance = {
      get: vi.fn(({ key }: { key: string }) => storeData[key]),
      set: vi.fn(({ key, value }: { key: string; value: unknown }) => {
        storeData[key] = value;
      }),
    };
    return {
      store: vi.fn(() => storeInstance),
      _storeInstance: storeInstance,
      log: {
        warn: vi.fn(),
        error: vi.fn(),
      },
    } as any;
  };

  describe('getWebhookUrl', () => {
    it('returns stored URL', async () => {
      const strapi = createMockStrapi('https://example.com/hook');
      const service = webhookFactory({ strapi });
      expect(await service.getWebhookUrl()).toBe('https://example.com/hook');
    });

    it('returns empty string when no URL stored', async () => {
      const strapi = createMockStrapi();
      const service = webhookFactory({ strapi });
      expect(await service.getWebhookUrl()).toBe('');
    });
  });

  describe('setWebhookUrl', () => {
    it('persists URL to store', async () => {
      const strapi = createMockStrapi();
      const service = webhookFactory({ strapi });
      await service.setWebhookUrl('https://new-url.com/hook');
      expect(strapi._storeInstance.set).toHaveBeenCalledWith({
        key: 'webhookUrl',
        value: 'https://new-url.com/hook',
      });
    });
  });

  describe('trigger', () => {
    let originalFetch: typeof globalThis.fetch;

    beforeEach(() => {
      originalFetch = globalThis.fetch;
    });

    it('returns not triggered when no URL configured', async () => {
      globalThis.fetch = originalFetch;
      const strapi = createMockStrapi('');
      const service = webhookFactory({ strapi });
      const result = await service.trigger(['doc1']);
      expect(result).toEqual({ triggered: false, error: 'No webhook URL configured' });
    });

    it('blocks SSRF attempts', async () => {
      const strapi = createMockStrapi('http://169.254.169.254/latest/meta-data/');
      const service = webhookFactory({ strapi });
      const result = await service.trigger(['doc1']);
      expect(result.triggered).toBe(false);
      expect(result.error).toBe('Webhook URL is not allowed');
    });

    it('triggers successfully on 200 response', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({ ok: true });
      const strapi = createMockStrapi('https://example.com/hook');
      const service = webhookFactory({ strapi });
      const result = await service.trigger(['doc1', 'doc2']);
      expect(result).toEqual({ triggered: true });
      expect(globalThis.fetch).toHaveBeenCalledWith(
        'https://example.com/hook',
        expect.objectContaining({
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
        })
      );
      globalThis.fetch = originalFetch;
    });

    it('handles non-ok response', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
        text: () => Promise.resolve('Internal Server Error'),
      });
      const strapi = createMockStrapi('https://example.com/hook');
      const service = webhookFactory({ strapi });
      const result = await service.trigger(['doc1']);
      expect(result).toEqual({ triggered: true, error: 'Webhook returned 500' });
      globalThis.fetch = originalFetch;
    });

    it('handles fetch errors', async () => {
      globalThis.fetch = vi.fn().mockRejectedValue(new Error('Network error'));
      const strapi = createMockStrapi('https://example.com/hook');
      const service = webhookFactory({ strapi });
      const result = await service.trigger(['doc1']);
      expect(result).toEqual({ triggered: false, error: 'Network error' });
      globalThis.fetch = originalFetch;
    });

    it('truncates long response bodies in logs', async () => {
      const longBody = 'x'.repeat(1000);
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 502,
        text: () => Promise.resolve(longBody),
      });
      const strapi = createMockStrapi('https://example.com/hook');
      const service = webhookFactory({ strapi });
      await service.trigger(['doc1']);
      const logCall = strapi.log.warn.mock.calls[0][0] as string;
      expect(logCall.length).toBeLessThan(longBody.length + 100);
      expect(logCall).toContain('...');
      globalThis.fetch = originalFetch;
    });
  });
});
