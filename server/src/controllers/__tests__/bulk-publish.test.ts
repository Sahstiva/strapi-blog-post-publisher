import { describe, it, expect, vi } from 'vitest';
import controllerFactory from '../bulk-publish';
import type { WebhookConfig } from '../../types';

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
  getConfig?: Function;
  setConfig?: Function;
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
            getConfig: overrides.getConfig || vi.fn(() => ({
              preset: 'generic', url: '', token: '', ref: 'main', variables: [],
            })),
            setConfig: overrides.setConfig || vi.fn(),
            trigger: overrides.trigger || vi.fn(() => ({ triggered: false })),
          };
        }
        return {};
      }),
    })),
  } as any;
}

const validConfig: WebhookConfig = {
  preset: 'generic',
  url: 'https://example.com/hook',
  token: '',
  ref: 'main',
  variables: [],
};

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
    it('returns full webhook config', async () => {
      const strapi = createMockStrapi({
        getConfig: vi.fn(() => validConfig),
      });
      const controller = controllerFactory({ strapi });
      const ctx = createMockCtx();

      await controller.getSettings(ctx);

      expect(ctx.body).toEqual({ data: validConfig });
    });
  });

  describe('updateSettings', () => {
    it('rejects invalid preset', async () => {
      const strapi = createMockStrapi();
      const controller = controllerFactory({ strapi });
      const ctx = createMockCtx({ ...validConfig, preset: 'invalid' });

      await controller.updateSettings(ctx);

      expect(ctx.badRequest).toHaveBeenCalledWith('preset must be one of: generic, gitlab');
    });

    it('rejects non-string url', async () => {
      const strapi = createMockStrapi();
      const controller = controllerFactory({ strapi });
      const ctx = createMockCtx({ ...validConfig, url: 123 });

      await controller.updateSettings(ctx);

      expect(ctx.badRequest).toHaveBeenCalledWith('url must be a string');
    });

    it('rejects private URLs (SSRF)', async () => {
      const strapi = createMockStrapi();
      const controller = controllerFactory({ strapi });
      const ctx = createMockCtx({ ...validConfig, url: 'http://169.254.169.254/latest/' });

      await controller.updateSettings(ctx);

      expect(ctx.badRequest).toHaveBeenCalledWith('url must be a valid public HTTP(S) URL');
    });

    it('rejects localhost URLs', async () => {
      const strapi = createMockStrapi();
      const controller = controllerFactory({ strapi });
      const ctx = createMockCtx({ ...validConfig, url: 'http://localhost:3000/' });

      await controller.updateSettings(ctx);

      expect(ctx.badRequest).toHaveBeenCalledWith('url must be a valid public HTTP(S) URL');
    });

    it('rejects non-string token', async () => {
      const strapi = createMockStrapi();
      const controller = controllerFactory({ strapi });
      const ctx = createMockCtx({ ...validConfig, token: 123 });

      await controller.updateSettings(ctx);

      expect(ctx.badRequest).toHaveBeenCalledWith('token must be a string');
    });

    it('rejects empty ref for gitlab preset', async () => {
      const strapi = createMockStrapi();
      const controller = controllerFactory({ strapi });
      const ctx = createMockCtx({ ...validConfig, preset: 'gitlab', ref: '' });

      await controller.updateSettings(ctx);

      expect(ctx.badRequest).toHaveBeenCalledWith('ref is required for GitLab preset');
    });

    it('rejects invalid variables format', async () => {
      const strapi = createMockStrapi();
      const controller = controllerFactory({ strapi });
      const ctx = createMockCtx({ ...validConfig, variables: 'not-array' });

      await controller.updateSettings(ctx);

      expect(ctx.badRequest).toHaveBeenCalledWith('variables must be an array');
    });

    it('rejects variables with non-string keys', async () => {
      const strapi = createMockStrapi();
      const controller = controllerFactory({ strapi });
      const ctx = createMockCtx({
        ...validConfig,
        variables: [{ key: 123, value: 'val' }],
      });

      await controller.updateSettings(ctx);

      expect(ctx.badRequest).toHaveBeenCalledWith(
        'Each variable must have string key and value'
      );
    });

    it('accepts valid generic config', async () => {
      const setMock = vi.fn();
      const strapi = createMockStrapi({ setConfig: setMock });
      const controller = controllerFactory({ strapi });
      const ctx = createMockCtx(validConfig);

      await controller.updateSettings(ctx);

      expect(ctx.badRequest).not.toHaveBeenCalled();
      expect(setMock).toHaveBeenCalledWith(validConfig);
      expect(ctx.body).toEqual({ data: validConfig });
    });

    it('accepts valid gitlab config with variables', async () => {
      const setMock = vi.fn();
      const strapi = createMockStrapi({ setConfig: setMock });
      const controller = controllerFactory({ strapi });
      const gitlabConfig: WebhookConfig = {
        preset: 'gitlab',
        url: 'https://gitlab.example.com/api/v4/projects/1/trigger/pipeline',
        token: 'gl-token',
        ref: 'main',
        variables: [
          { key: 'DEPLOY_WEBSITE', value: 'true' },
          { key: 'ENV', value: 'production' },
        ],
      };
      const ctx = createMockCtx(gitlabConfig);

      await controller.updateSettings(ctx);

      expect(ctx.badRequest).not.toHaveBeenCalled();
      expect(setMock).toHaveBeenCalledWith(gitlabConfig);
    });

    it('accepts empty url to disable webhook', async () => {
      const setMock = vi.fn();
      const strapi = createMockStrapi({ setConfig: setMock });
      const controller = controllerFactory({ strapi });
      const ctx = createMockCtx({ ...validConfig, url: '' });

      await controller.updateSettings(ctx);

      expect(ctx.badRequest).not.toHaveBeenCalled();
    });
  });
});
