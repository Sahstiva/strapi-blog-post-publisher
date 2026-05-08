import type { Core } from '@strapi/strapi';
import type { WebhookConfig } from '../types';
import { DEFAULT_WEBHOOK_CONFIG } from '../types';

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

function buildGenericRequest(
  config: WebhookConfig,
  documentIds: string[]
): { headers: Record<string, string>; body: string } {
  const payload: Record<string, unknown> = {
    event: 'bulk-publish',
    posts: documentIds,
    publishedAt: new Date().toISOString(),
  };

  for (const { key, value } of config.variables) {
    if (key) payload[key] = value;
  }

  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (config.token) {
    headers['Authorization'] = `Bearer ${config.token}`;
  }

  return { headers, body: JSON.stringify(payload) };
}

function buildGitlabRequest(
  config: WebhookConfig,
  documentIds: string[]
): FormData {
  const form = new FormData();
  form.append('token', config.token);
  form.append('ref', config.ref || 'main');

  form.append('variables[BULK_PUBLISH_EVENT]', 'bulk-publish');
  form.append('variables[BULK_PUBLISH_POSTS]', documentIds.join(','));
  form.append('variables[BULK_PUBLISH_DATE]', new Date().toISOString());

  for (const { key, value } of config.variables) {
    if (key) form.append(`variables[${key}]`, value);
  }

  return form;
}

function logTruncated(strapi: Core.Strapi, status: number, text: string): void {
  const truncated = text.length > MAX_LOG_BODY_LENGTH
    ? text.slice(0, MAX_LOG_BODY_LENGTH) + '...'
    : text;
  strapi.log.warn(`bulk-publish webhook returned ${status}: ${truncated}`);
}

export default ({ strapi }: { strapi: Core.Strapi }) => {
  const getStore = () => strapi.store({ type: 'plugin', name: 'bulk-publish' });

  return {
    async getConfig(): Promise<WebhookConfig> {
      const stored = await getStore().get({ key: 'webhookConfig' });
      if (stored && typeof stored === 'object') {
        return stored as WebhookConfig;
      }
      return { ...DEFAULT_WEBHOOK_CONFIG };
    },

    async setConfig(config: WebhookConfig): Promise<void> {
      await getStore().set({ key: 'webhookConfig', value: config });
    },

    async trigger(documentIds: string[]): Promise<{ triggered: boolean; error?: string }> {
      const config = await this.getConfig();
      if (!config.url) {
        return { triggered: false, error: 'No webhook URL configured' };
      }

      if (!isAllowedWebhookUrl(config.url)) {
        strapi.log.warn('bulk-publish: webhook URL blocked by SSRF protection');
        return { triggered: false, error: 'Webhook URL is not allowed' };
      }

      try {
        let response: Response;

        if (config.preset === 'gitlab') {
          const form = buildGitlabRequest(config, documentIds);
          response = await fetch(config.url, {
            method: 'POST',
            body: form,
            signal: AbortSignal.timeout(WEBHOOK_TIMEOUT_MS),
          });
        } else {
          const { headers, body } = buildGenericRequest(config, documentIds);
          response = await fetch(config.url, {
            method: 'POST',
            headers,
            body,
            signal: AbortSignal.timeout(WEBHOOK_TIMEOUT_MS),
          });
        }

        if (!response.ok) {
          const text = await response.text();
          logTruncated(strapi, response.status, text);
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
