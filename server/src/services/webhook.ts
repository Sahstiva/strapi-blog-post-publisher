import type { Core } from '@strapi/strapi';

const WEBHOOK_TIMEOUT_MS = 10_000;
const MAX_LOG_BODY_LENGTH = 500;

const BLOCKED_HOSTNAMES = new Set([
  'localhost',
  '127.0.0.1',
  '::1',
  '0.0.0.0',
  '169.254.169.254',
]);

function isPrivateIP(hostname: string): boolean {
  const normalized = hostname.replace(/^\[|\]$/g, '');
  if (BLOCKED_HOSTNAMES.has(normalized)) return true;
  if (normalized.endsWith('.local') || normalized.endsWith('.internal')) return true;

  const parts = hostname.split('.').map(Number);
  if (parts.length !== 4 || parts.some(isNaN)) return false;

  if (parts[0] === 10) return true;
  if (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) return true;
  if (parts[0] === 192 && parts[1] === 168) return true;
  if (parts[0] === 169 && parts[1] === 254) return true;
  if (parts[0] === 127) return true;

  return false;
}

export function isAllowedWebhookUrl(urlStr: string): boolean {
  if (!urlStr) return true;
  try {
    const url = new URL(urlStr);
    if (url.protocol !== 'https:' && url.protocol !== 'http:') return false;
    return !isPrivateIP(url.hostname.toLowerCase());
  } catch {
    return false;
  }
}

export default ({ strapi }: { strapi: Core.Strapi }) => {
  const getStore = () => strapi.store({ type: 'plugin', name: 'bulk-publish' });

  return {
    async getWebhookUrl(): Promise<string> {
      const url = await getStore().get({ key: 'webhookUrl' });
      return (url as string) || '';
    },

    async setWebhookUrl(url: string): Promise<void> {
      await getStore().set({ key: 'webhookUrl', value: url });
    },

    async trigger(documentIds: string[]): Promise<{ triggered: boolean; error?: string }> {
      const webhookUrl = await this.getWebhookUrl();
      if (!webhookUrl) {
        return { triggered: false, error: 'No webhook URL configured' };
      }

      if (!isAllowedWebhookUrl(webhookUrl)) {
        strapi.log.warn('bulk-publish: webhook URL blocked by SSRF protection');
        return { triggered: false, error: 'Webhook URL is not allowed' };
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
          signal: AbortSignal.timeout(WEBHOOK_TIMEOUT_MS),
        });

        if (!response.ok) {
          const text = await response.text();
          const truncated = text.length > MAX_LOG_BODY_LENGTH
            ? text.slice(0, MAX_LOG_BODY_LENGTH) + '...'
            : text;
          strapi.log.warn(`bulk-publish webhook returned ${response.status}: ${truncated}`);
          return { triggered: true, error: `Webhook returned ${response.status}` };
        }

        return { triggered: true };
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Webhook call failed';
        strapi.log.error(`bulk-publish: webhook call failed: ${message}`);
        return { triggered: false, error: message };
      }
    },
  };
};
