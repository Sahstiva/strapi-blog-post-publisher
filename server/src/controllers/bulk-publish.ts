import type { Core } from '@strapi/strapi';
import type { Context } from 'koa';
import type { PublishResult } from '../types';
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
      const webhookUrl = await webhookService().getWebhookUrl();
      ctx.body = { data: { webhookUrl } };
    },

    async updateSettings(ctx: Context) {
      const { webhookUrl } = ctx.request.body as { webhookUrl?: unknown };

      if (typeof webhookUrl !== 'string') {
        return ctx.badRequest('webhookUrl must be a string');
      }

      if (webhookUrl && !isAllowedWebhookUrl(webhookUrl)) {
        return ctx.badRequest('webhookUrl must be a valid public HTTP(S) URL');
      }

      await webhookService().setWebhookUrl(webhookUrl);
      ctx.body = { data: { webhookUrl } };
    },
  };
};
