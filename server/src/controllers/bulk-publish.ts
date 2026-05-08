import type { Core } from '@strapi/strapi';
import type { Context } from 'koa';
import type { PublishResult, WebhookConfig, WebhookVariable } from '../types';
import { WEBHOOK_PRESETS } from '../types';
import { isAllowedWebhookUrl } from '../services/webhook';

const MAX_BATCH_SIZE = 100;

export default ({ strapi }: { strapi: Core.Strapi }) => {
  const publishService = () => strapi.plugin('bulk-publish').service('publish');
  const webhookService = () => strapi.plugin('bulk-publish').service('webhook');

  return {
    async getPosts(ctx: Context) {
      const posts = await publishService().getDraftPosts();
      ctx.body = { data: posts };
    },

    async publish(ctx: Context) {
      const { documentIds } = ctx.request.body as { documentIds?: unknown };

      if (!Array.isArray(documentIds) || documentIds.length === 0) {
        return ctx.badRequest('documentIds must be a non-empty array');
      }

      if (documentIds.length > MAX_BATCH_SIZE) {
        return ctx.badRequest(`Cannot publish more than ${MAX_BATCH_SIZE} documents at once`);
      }

      if (!documentIds.every((id): id is string => typeof id === 'string' && id.length > 0)) {
        return ctx.badRequest('Each documentId must be a non-empty string');
      }

      const { published, errors } = await publishService().publishMany(documentIds);

      let webhookResult = { triggered: false, error: 'No posts published' };
      if (published.length > 0) {
        webhookResult = await webhookService().trigger(
          published.map((p: PublishResult) => p.documentId)
        );
      }

      ctx.body = {
        data: {
          published,
          errors,
          webhookTriggered: webhookResult.triggered,
          webhookError: webhookResult.error || null,
        },
      };
    },

    async getSettings(ctx: Context) {
      const config = await webhookService().getConfig();
      ctx.body = { data: config };
    },

    async updateSettings(ctx: Context) {
      const body = ctx.request.body as Partial<WebhookConfig> | undefined;

      if (!body || typeof body !== 'object') {
        return ctx.badRequest('Request body is required');
      }

      const { preset, url, token, ref, variables } = body;

      if (typeof preset !== 'string' || !WEBHOOK_PRESETS.includes(preset as never)) {
        return ctx.badRequest(`preset must be one of: ${WEBHOOK_PRESETS.join(', ')}`);
      }

      if (typeof url !== 'string') {
        return ctx.badRequest('url must be a string');
      }

      if (url && !isAllowedWebhookUrl(url)) {
        return ctx.badRequest('url must be a valid public HTTP(S) URL');
      }

      if (typeof token !== 'string') {
        return ctx.badRequest('token must be a string');
      }

      if (typeof ref !== 'string') {
        return ctx.badRequest('ref must be a string');
      }

      if (preset === 'gitlab' && !ref) {
        return ctx.badRequest('ref is required for GitLab preset');
      }

      if (!Array.isArray(variables)) {
        return ctx.badRequest('variables must be an array');
      }

      if (
        !variables.every(
          (v): v is WebhookVariable =>
            typeof v === 'object' &&
            v !== null &&
            typeof v.key === 'string' &&
            typeof v.value === 'string'
        )
      ) {
        return ctx.badRequest('Each variable must have string key and value');
      }

      const config: WebhookConfig = { preset, url, token, ref, variables };
      await webhookService().setConfig(config);
      ctx.body = { data: config };
    },
  };
};
