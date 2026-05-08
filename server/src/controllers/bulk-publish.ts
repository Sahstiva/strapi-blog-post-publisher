import type { Core } from '@strapi/strapi';

export default ({ strapi }: { strapi: Core.Strapi }) => ({
  async getPosts(ctx: any) {
    const publishService = strapi.plugin('bulk-publish').service('publish');
    const posts = await publishService.getDraftPosts();
    ctx.body = { data: posts };
  },

  async publish(ctx: any) {
    const { documentIds } = ctx.request.body;

    if (!Array.isArray(documentIds) || documentIds.length === 0) {
      return ctx.badRequest('documentIds must be a non-empty array');
    }

    if (!documentIds.every((id: any) => typeof id === 'string' && id.length > 0)) {
      return ctx.badRequest('Each documentId must be a non-empty string');
    }

    const publishService = strapi.plugin('bulk-publish').service('publish');
    const webhookService = strapi.plugin('bulk-publish').service('webhook');

    const { published, errors } = await publishService.publishMany(documentIds);

    let webhookResult = { triggered: false, error: 'No posts published' };
    if (published.length > 0) {
      webhookResult = await webhookService.trigger(
        published.map((p: any) => p.documentId)
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

  async getSettings(ctx: any) {
    const webhookService = strapi.plugin('bulk-publish').service('webhook');
    const webhookUrl = await webhookService.getWebhookUrl();
    ctx.body = { data: { webhookUrl } };
  },

  async updateSettings(ctx: any) {
    const { webhookUrl } = ctx.request.body;

    if (typeof webhookUrl !== 'string') {
      return ctx.badRequest('webhookUrl must be a string');
    }

    if (webhookUrl && !/^https?:\/\/.+/.test(webhookUrl)) {
      return ctx.badRequest('webhookUrl must be a valid HTTP(S) URL');
    }

    const webhookService = strapi.plugin('bulk-publish').service('webhook');
    await webhookService.setWebhookUrl(webhookUrl);
    ctx.body = { data: { webhookUrl } };
  },
});
