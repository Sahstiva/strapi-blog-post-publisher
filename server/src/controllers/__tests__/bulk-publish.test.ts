import { describe, it, expect, vi } from 'vitest';
import controllerFactory from '../bulk-publish';

function createMockCtx(body: Record<string, unknown> = {}) {
  return {
    request: { body },
    body: null as unknown,
    badRequest: vi.fn((msg: string) => {
      return { error: msg };
    }),
  } as any;
}

function createMockStrapi(overrides: {
  publishMany?: Function;
  getDraftPosts?: Function;
  getWebhookUrl?: Function;
  setWebhookUrl?: Function;
  trigger?: Function;
} = {}) {
  return {
    plugin: vi.fn(() => ({
      service: vi.fn((name: string) => {
        if (name === 'publish') {
          return {
            getDraftPosts: overrides.getDraftPosts || vi.fn(() => []),
            publishMany: overrides.publishMany || vi.fn(() => ({ published: [], errors: [] })),
          };
        }
        if (name === 'webhook') {
          return {
            getWebhookUrl: overrides.getWebhookUrl || vi.fn(() => ''),
            setWebhookUrl: overrides.setWebhookUrl || vi.fn(),
            trigger: overrides.trigger || vi.fn(() => ({ triggered: false })),
          };
        }
        return {};
      }),
    })),
  } as any;
}

describe('bulk-publish controller', () => {
  describe('getPosts', () => {
    it('returns posts from publish service', async () => {
      const mockPosts = [{ documentId: 'doc1', title: 'Test' }];
      const strapi = createMockStrapi({
        getDraftPosts: vi.fn(() => mockPosts),
      });
      const controller = controllerFactory({ strapi });
      const ctx = createMockCtx();

      await controller.getPosts(ctx);

      expect(ctx.body).toEqual({ data: mockPosts });
    });
  });

  describe('publish', () => {
    it('rejects missing documentIds', async () => {
      const strapi = createMockStrapi();
      const controller = controllerFactory({ strapi });
      const ctx = createMockCtx({});

      await controller.publish(ctx);

      expect(ctx.badRequest).toHaveBeenCalledWith('documentIds must be a non-empty array');
    });

    it('rejects empty array', async () => {
      const strapi = createMockStrapi();
      const controller = controllerFactory({ strapi });
      const ctx = createMockCtx({ documentIds: [] });

      await controller.publish(ctx);

      expect(ctx.badRequest).toHaveBeenCalledWith('documentIds must be a non-empty array');
    });

    it('rejects non-string items', async () => {
      const strapi = createMockStrapi();
      const controller = controllerFactory({ strapi });
      const ctx = createMockCtx({ documentIds: ['valid', 123] });

      await controller.publish(ctx);

      expect(ctx.badRequest).toHaveBeenCalledWith('Each documentId must be a non-empty string');
    });

    it('rejects empty string items', async () => {
      const strapi = createMockStrapi();
      const controller = controllerFactory({ strapi });
      const ctx = createMockCtx({ documentIds: ['valid', ''] });

      await controller.publish(ctx);

      expect(ctx.badRequest).toHaveBeenCalledWith('Each documentId must be a non-empty string');
    });

    it('rejects batches exceeding max size', async () => {
      const strapi = createMockStrapi();
      const controller = controllerFactory({ strapi });
      const ids = Array.from({ length: 101 }, (_, i) => `doc${i}`);
      const ctx = createMockCtx({ documentIds: ids });

      await controller.publish(ctx);

      expect(ctx.badRequest).toHaveBeenCalledWith(
        'Cannot publish more than 100 documents at once'
      );
    });

    it('accepts valid batch within size limit', async () => {
      const strapi = createMockStrapi({
        publishMany: vi.fn(() => ({
          published: [{ documentId: 'doc1', localesPublished: ['en'] }],
          errors: [],
        })),
        trigger: vi.fn(() => ({ triggered: true })),
      });
      const controller = controllerFactory({ strapi });
      const ctx = createMockCtx({ documentIds: ['doc1'] });

      await controller.publish(ctx);

      expect(ctx.badRequest).not.toHaveBeenCalled();
      expect(ctx.body).toBeDefined();
      expect((ctx.body as any).data.webhookTriggered).toBe(true);
    });

    it('does not trigger webhook when nothing published', async () => {
      const triggerMock = vi.fn();
      const strapi = createMockStrapi({
        publishMany: vi.fn(() => ({
          published: [],
          errors: [{ documentId: 'doc1', error: 'No drafts' }],
        })),
        trigger: triggerMock,
      });
      const controller = controllerFactory({ strapi });
      const ctx = createMockCtx({ documentIds: ['doc1'] });

      await controller.publish(ctx);

      expect(triggerMock).not.toHaveBeenCalled();
      expect((ctx.body as any).data.webhookTriggered).toBe(false);
    });
  });

  describe('getSettings', () => {
    it('returns webhook URL', async () => {
      const strapi = createMockStrapi({
        getWebhookUrl: vi.fn(() => 'https://example.com/hook'),
      });
      const controller = controllerFactory({ strapi });
      const ctx = createMockCtx();

      await controller.getSettings(ctx);

      expect(ctx.body).toEqual({ data: { webhookUrl: 'https://example.com/hook' } });
    });
  });

  describe('updateSettings', () => {
    it('rejects non-string webhookUrl', async () => {
      const strapi = createMockStrapi();
      const controller = controllerFactory({ strapi });
      const ctx = createMockCtx({ webhookUrl: 123 });

      await controller.updateSettings(ctx);

      expect(ctx.badRequest).toHaveBeenCalledWith('webhookUrl must be a string');
    });

    it('rejects private URLs (SSRF)', async () => {
      const strapi = createMockStrapi();
      const controller = controllerFactory({ strapi });
      const ctx = createMockCtx({ webhookUrl: 'http://169.254.169.254/latest/' });

      await controller.updateSettings(ctx);

      expect(ctx.badRequest).toHaveBeenCalledWith(
        'webhookUrl must be a valid public HTTP(S) URL'
      );
    });

    it('rejects localhost URLs', async () => {
      const strapi = createMockStrapi();
      const controller = controllerFactory({ strapi });
      const ctx = createMockCtx({ webhookUrl: 'http://localhost:3000/' });

      await controller.updateSettings(ctx);

      expect(ctx.badRequest).toHaveBeenCalledWith(
        'webhookUrl must be a valid public HTTP(S) URL'
      );
    });

    it('accepts valid public URL', async () => {
      const setMock = vi.fn();
      const strapi = createMockStrapi({ setWebhookUrl: setMock });
      const controller = controllerFactory({ strapi });
      const ctx = createMockCtx({ webhookUrl: 'https://example.com/hook' });

      await controller.updateSettings(ctx);

      expect(ctx.badRequest).not.toHaveBeenCalled();
      expect(setMock).toHaveBeenCalledWith('https://example.com/hook');
      expect(ctx.body).toEqual({ data: { webhookUrl: 'https://example.com/hook' } });
    });

    it('accepts empty string to clear webhook', async () => {
      const setMock = vi.fn();
      const strapi = createMockStrapi({ setWebhookUrl: setMock });
      const controller = controllerFactory({ strapi });
      const ctx = createMockCtx({ webhookUrl: '' });

      await controller.updateSettings(ctx);

      expect(ctx.badRequest).not.toHaveBeenCalled();
      expect(setMock).toHaveBeenCalledWith('');
    });
  });
});
