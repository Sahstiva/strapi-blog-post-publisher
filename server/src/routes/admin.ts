export default {
  type: 'admin',
  routes: [
    {
      method: 'GET',
      path: '/posts',
      handler: 'bulk-publish.getPosts',
      config: {
        policies: [
          'admin::isAuthenticatedAdmin',
          {
            name: 'admin::hasPermissions',
            config: { actions: ['plugin::bulk-publish.publish'] },
          },
        ],
        description: 'List blog posts with unpublished locales',
      },
    },
    {
      method: 'POST',
      path: '/publish',
      handler: 'bulk-publish.publish',
      config: {
        policies: [
          'admin::isAuthenticatedAdmin',
          {
            name: 'admin::hasPermissions',
            config: { actions: ['plugin::bulk-publish.publish'] },
          },
        ],
        description: 'Publish selected posts across all locales',
      },
    },
    {
      method: 'POST',
      path: '/trigger',
      handler: 'bulk-publish.triggerWebhook',
      config: {
        policies: [
          'admin::isAuthenticatedAdmin',
          {
            name: 'admin::hasPermissions',
            config: { actions: ['plugin::bulk-publish.settings'] },
          },
        ],
        description: 'Manually trigger the webhook',
      },
    },
    {
      method: 'GET',
      path: '/settings',
      handler: 'bulk-publish.getSettings',
      config: {
        policies: [
          'admin::isAuthenticatedAdmin',
          {
            name: 'admin::hasPermissions',
            config: { actions: ['plugin::bulk-publish.settings'] },
          },
        ],
        description: 'Get webhook settings',
      },
    },
    {
      method: 'PUT',
      path: '/settings',
      handler: 'bulk-publish.updateSettings',
      config: {
        policies: [
          'admin::isAuthenticatedAdmin',
          {
            name: 'admin::hasPermissions',
            config: { actions: ['plugin::bulk-publish.settings'] },
          },
        ],
        description: 'Update webhook settings',
      },
    },
  ],
};
