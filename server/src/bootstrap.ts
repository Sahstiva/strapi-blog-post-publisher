import type { Core } from '@strapi/strapi';

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
  const existingUrl = await store.get({ key: 'webhookUrl' });
  if (existingUrl === null || existingUrl === undefined) {
    const configUrl = strapi.plugin('bulk-publish').config('webhookUrl') || '';
    await store.set({ key: 'webhookUrl', value: configUrl });
  }
};

export default bootstrap;
