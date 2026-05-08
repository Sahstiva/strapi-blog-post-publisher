import type { Core } from '@strapi/strapi';
import type { WebhookConfig } from './types';
import { DEFAULT_WEBHOOK_CONFIG } from './types';

const bootstrap = async ({ strapi }: { strapi: Core.Strapi }) => {
  strapi.log.debug('Bulk Publish plugin bootstrapped');

  await strapi.service('admin::permission').actionProvider.registerMany([
    {
      section: 'plugins',
      displayName: 'Publish',
      uid: 'publish',
      pluginName: 'bulk-publish',
    },
    {
      section: 'plugins',
      displayName: 'Settings',
      uid: 'settings',
      pluginName: 'bulk-publish',
    },
  ]);

  const store = strapi.store({ type: 'plugin', name: 'bulk-publish' });
  const existingConfig = await store.get({ key: 'webhookConfig' });

  if (existingConfig) return;

  // Migrate from v1.0.0 webhookUrl format
  const legacyUrl = await store.get({ key: 'webhookUrl' });
  if (legacyUrl && typeof legacyUrl === 'string') {
    const migrated: WebhookConfig = {
      ...DEFAULT_WEBHOOK_CONFIG,
      url: legacyUrl,
    };
    await store.set({ key: 'webhookConfig', value: migrated });
    await store.set({ key: 'webhookUrl', value: null });
    strapi.log.info('bulk-publish: migrated webhookUrl to webhookConfig');
    return;
  }

  // Seed from plugin config on first run
  const configUrl = strapi.plugin('bulk-publish').config('webhookUrl') || '';
  const seeded: WebhookConfig = {
    ...DEFAULT_WEBHOOK_CONFIG,
    url: typeof configUrl === 'string' ? configUrl : '',
  };
  await store.set({ key: 'webhookConfig', value: seeded });
};

export default bootstrap;
