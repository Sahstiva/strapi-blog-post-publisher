import { PLUGIN_ID } from './pluginId';
import pluginPermissions from './permissions';

export default {
  register(app: any) {
    app.addMenuLink({
      to: `plugins/${PLUGIN_ID}`,
      icon: () => null,
      intlLabel: {
        id: `${PLUGIN_ID}.plugin.name`,
        defaultMessage: 'Bulk Publish',
      },
      Component: async () => {
        const { HomePage } = await import('./pages/HomePage');
        return HomePage;
      },
      permissions: pluginPermissions.publish,
    });

    app.createSettingSection(
      {
        id: PLUGIN_ID,
        intlLabel: {
          id: `${PLUGIN_ID}.settings.section-label`,
          defaultMessage: 'Bulk Publish',
        },
      },
      [
        {
          intlLabel: {
            id: `${PLUGIN_ID}.settings.webhook`,
            defaultMessage: 'Webhook',
          },
          id: 'webhook',
          to: `${PLUGIN_ID}/webhook`,
          Component: async () => {
            const { SettingsPage } = await import('./pages/SettingsPage');
            return SettingsPage;
          },
          permissions: pluginPermissions.settings,
        },
      ]
    );

    app.registerPlugin({
      id: PLUGIN_ID,
      name: PLUGIN_ID,
    });
  },

  async registerTrads({ locales }: { locales: string[] }) {
    const importedTranslations = await Promise.all(
      locales.map(async (locale) => {
        try {
          const data = await import(`./translations/${locale}.json`);
          return {
            data: prefixPluginTranslations(data.default, PLUGIN_ID),
            locale,
          };
        } catch {
          return {
            data: {},
            locale,
          };
        }
      })
    );

    return importedTranslations;
  },
};

const prefixPluginTranslations = (
  trad: Record<string, string>,
  pluginId: string
): Record<string, string> => {
  return Object.keys(trad).reduce(
    (acc, current) => {
      acc[`${pluginId}.${current}`] = trad[current];
      return acc;
    },
    {} as Record<string, string>
  );
};
