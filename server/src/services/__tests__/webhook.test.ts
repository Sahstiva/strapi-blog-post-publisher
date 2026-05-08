import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { isAllowedWebhookUrl } from '../webhook';
import webhookFactory from '../webhook';
import type { WebhookConfig } from '../../types';

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
  const makeConfig = (overrides: Partial<WebhookConfig> = {}): WebhookConfig => ({
    preset: 'generic',
    url: '',
    token: '',
    ref: 'main',
    variables: [],
    ...overrides,
  });

  const createMockStrapi = (config?: WebhookConfig) => {
    const storeData: Record<string, unknown> = {};
    if (config) storeData['webhookConfig'] = config;

    const storeInstance = {
      get: vi.fn(({ key }: { key: string }) => storeData[key] ?? null),
      set: vi.fn(({ key, value }: { key: string; value: unknown }) => {
        storeData[key] = value;
      }),
    };
    return {
      store: vi.fn(() => storeInstance),
      _storeInstance: storeInstance,
      log: { warn: vi.fn(), error: vi.fn() },
    } as any;
  };

  let originalFetch: typeof globalThis.fetch;

  beforeEach(() => {
    originalFetch = globalThis.fetch;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  describe('getConfig / setConfig', () => {
    it('returns stored config', async () => {
      const cfg = makeConfig({ url: 'https://example.com/hook', preset: 'gitlab' });
      const strapi = createMockStrapi(cfg);
      const service = webhookFactory({ strapi });
      const result = await service.getConfig();
      expect(result).toEqual(cfg);
    });

    it('returns default config when nothing stored', async () => {
      const strapi = createMockStrapi();
      const service = webhookFactory({ strapi });
      const result = await service.getConfig();
      expect(result.preset).toBe('generic');
      expect(result.url).toBe('');
    });

    it('persists config to store', async () => {
      const strapi = createMockStrapi();
      const service = webhookFactory({ strapi });
      const cfg = makeConfig({ url: 'https://new.com', preset: 'gitlab', token: 'abc' });
      await service.setConfig(cfg);
      expect(strapi._storeInstance.set).toHaveBeenCalledWith({
        key: 'webhookConfig',
        value: cfg,
      });
    });
  });

  describe('trigger - generic preset', () => {
    it('returns not triggered when no URL configured', async () => {
      const strapi = createMockStrapi(makeConfig());
      const service = webhookFactory({ strapi });
      const result = await service.trigger(['doc1']);
      expect(result).toEqual({ triggered: false, error: 'No webhook URL configured' });
    });

    it('blocks SSRF attempts', async () => {
      const cfg = makeConfig({ url: 'http://169.254.169.254/latest/meta-data/' });
      const strapi = createMockStrapi(cfg);
      const service = webhookFactory({ strapi });
      const result = await service.trigger(['doc1']);
      expect(result.triggered).toBe(false);
      expect(result.error).toBe('Webhook URL is not allowed');
    });

    it('sends JSON with Bearer token when token is set', async () => {
      const cfg = makeConfig({ url: 'https://example.com/hook', token: 'my-secret' });
      globalThis.fetch = vi.fn().mockResolvedValue({ ok: true });
      const strapi = createMockStrapi(cfg);
      const service = webhookFactory({ strapi });
      await service.trigger(['doc1']);

      expect(globalThis.fetch).toHaveBeenCalledWith(
        'https://example.com/hook',
        expect.objectContaining({
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: 'Bearer my-secret',
          },
        })
      );
    });

    it('sends JSON without Authorization when no token', async () => {
      const cfg = makeConfig({ url: 'https://example.com/hook' });
      globalThis.fetch = vi.fn().mockResolvedValue({ ok: true });
      const strapi = createMockStrapi(cfg);
      const service = webhookFactory({ strapi });
      await service.trigger(['doc1']);

      const callArgs = (globalThis.fetch as any).mock.calls[0][1];
      expect(callArgs.headers).not.toHaveProperty('Authorization');
    });

    it('merges variables into JSON body', async () => {
      const cfg = makeConfig({
        url: 'https://example.com/hook',
        variables: [
          { key: 'DEPLOY', value: 'true' },
          { key: 'ENV', value: 'prod' },
        ],
      });
      globalThis.fetch = vi.fn().mockResolvedValue({ ok: true });
      const strapi = createMockStrapi(cfg);
      const service = webhookFactory({ strapi });
      await service.trigger(['doc1']);

      const body = JSON.parse((globalThis.fetch as any).mock.calls[0][1].body);
      expect(body.DEPLOY).toBe('true');
      expect(body.ENV).toBe('prod');
      expect(body.event).toBe('bulk-publish');
      expect(body.posts).toEqual(['doc1']);
    });

    it('handles non-ok response', async () => {
      const cfg = makeConfig({ url: 'https://example.com/hook' });
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
        text: () => Promise.resolve('Internal Server Error'),
      });
      const strapi = createMockStrapi(cfg);
      const service = webhookFactory({ strapi });
      const result = await service.trigger(['doc1']);
      expect(result).toEqual({ triggered: true, error: 'Webhook returned 500' });
    });

    it('handles fetch errors', async () => {
      const cfg = makeConfig({ url: 'https://example.com/hook' });
      globalThis.fetch = vi.fn().mockRejectedValue(new Error('Network error'));
      const strapi = createMockStrapi(cfg);
      const service = webhookFactory({ strapi });
      const result = await service.trigger(['doc1']);
      expect(result).toEqual({ triggered: false, error: 'Network error' });
    });

    it('truncates long response bodies in logs', async () => {
      const longBody = 'x'.repeat(1000);
      const cfg = makeConfig({ url: 'https://example.com/hook' });
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 502,
        text: () => Promise.resolve(longBody),
      });
      const strapi = createMockStrapi(cfg);
      const service = webhookFactory({ strapi });
      await service.trigger(['doc1']);
      const logCall = strapi.log.warn.mock.calls[0][0] as string;
      expect(logCall.length).toBeLessThan(longBody.length + 100);
      expect(logCall).toContain('...');
    });
  });

  describe('trigger - gitlab preset', () => {
    it('sends FormData with token, ref, and variables', async () => {
      const cfg = makeConfig({
        preset: 'gitlab',
        url: 'https://gitlab.example.com/api/v4/projects/1/trigger/pipeline',
        token: 'gl-trigger-token',
        ref: 'main',
        variables: [{ key: 'DEPLOY_WEBSITE', value: 'true' }],
      });
      globalThis.fetch = vi.fn().mockResolvedValue({ ok: true });
      const strapi = createMockStrapi(cfg);
      const service = webhookFactory({ strapi });
      await service.trigger(['doc1', 'doc2']);

      const callArgs = (globalThis.fetch as any).mock.calls[0];
      expect(callArgs[0]).toBe(cfg.url);
      expect(callArgs[1].method).toBe('POST');

      const form = callArgs[1].body as FormData;
      expect(form.get('token')).toBe('gl-trigger-token');
      expect(form.get('ref')).toBe('main');
      expect(form.get('variables[DEPLOY_WEBSITE]')).toBe('true');
      expect(form.get('variables[BULK_PUBLISH_EVENT]')).toBe('bulk-publish');
      expect(form.get('variables[BULK_PUBLISH_POSTS]')).toBe('doc1,doc2');
      expect(form.get('variables[BULK_PUBLISH_DATE]')).toBeTruthy();
    });

    it('does not set Content-Type header (let FormData set boundary)', async () => {
      const cfg = makeConfig({
        preset: 'gitlab',
        url: 'https://gitlab.example.com/api/v4/projects/1/trigger/pipeline',
        token: 'tok',
      });
      globalThis.fetch = vi.fn().mockResolvedValue({ ok: true });
      const strapi = createMockStrapi(cfg);
      const service = webhookFactory({ strapi });
      await service.trigger(['doc1']);

      const callArgs = (globalThis.fetch as any).mock.calls[0][1];
      expect(callArgs.headers).toBeUndefined();
    });
  });
});
