import type { Core } from '@strapi/strapi';

export default ({ strapi }: { strapi: Core.Strapi }) => ({
  async getWebhookUrl(): Promise<string> {
    const store = strapi.store({ type: 'plugin', name: 'bulk-publish' });
    const url = await store.get({ key: 'webhookUrl' });
    return (url as string) || '';
  },

  async setWebhookUrl(url: string): Promise<void> {
    const store = strapi.store({ type: 'plugin', name: 'bulk-publish' });
    await store.set({ key: 'webhookUrl', value: url });
  },

  async trigger(documentIds: string[]): Promise<{ triggered: boolean; error?: string }> {
    const webhookUrl = await this.getWebhookUrl();
    if (!webhookUrl) {
      return { triggered: false, error: 'No webhook URL configured' };
    }

    try {
      const response = await fetch(webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          event: 'bulk-publish',
          posts: documentIds,
          publishedAt: new Date().toISOString(),
        }),
      });

      if (!response.ok) {
        const text = await response.text();
        strapi.log.warn(`bulk-publish webhook returned ${response.status}: ${text}`);
        return { triggered: true, error: `Webhook returned ${response.status}` };
      }

      return { triggered: true };
    } catch (err: any) {
      strapi.log.error('bulk-publish: webhook call failed', err);
      return { triggered: false, error: err.message || 'Webhook call failed' };
    }
  },
});
