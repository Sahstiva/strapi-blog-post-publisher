import type { Core } from '@strapi/strapi';

const bootstrap = async ({ strapi }: { strapi: Core.Strapi }) => {
  strapi.log.info('Bulk Publish plugin bootstrapped');

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
  const webhookUrl = await store.get({ key: 'webhookUrl' });
  if (webhookUrl === null || webhookUrl === undefined) {
    await store.set({ key: 'webhookUrl', value: '' });
  }
};

export default bootstrap;
