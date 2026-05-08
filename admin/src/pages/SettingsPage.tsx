import { useState, useEffect, useCallback } from 'react';
import { useIntl } from 'react-intl';
import {
  Main,
  Box,
  Typography,
  Button,
  TextInput,
  Flex,
  Loader,
} from '@strapi/design-system';
import { Page, useFetchClient, useNotification } from '@strapi/strapi/admin';
import pluginPermissions from '../permissions';
import { PLUGIN_ID } from '../pluginId';

const SettingsPage = () => {
  const { formatMessage } = useIntl();
  const { get, put } = useFetchClient();
  const { toggleNotification } = useNotification();
  const [webhookUrl, setWebhookUrl] = useState('');
  const [initialUrl, setInitialUrl] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const fetchSettings = useCallback(async () => {
    try {
      const { data } = await get(`/${PLUGIN_ID}/settings`);
      const url = data.data?.webhookUrl || '';
      setWebhookUrl(url);
      setInitialUrl(url);
    } catch {
      toggleNotification({
        type: 'danger',
        message: formatMessage({ id: `${PLUGIN_ID}.notification.settings.error` }),
      });
    } finally {
      setLoading(false);
    }
  }, [get, toggleNotification, formatMessage]);

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  const handleSave = async () => {
    try {
      setSaving(true);
      await put(`/${PLUGIN_ID}/settings`, { webhookUrl });
      setInitialUrl(webhookUrl);
      toggleNotification({
        type: 'success',
        message: formatMessage({ id: `${PLUGIN_ID}.notification.settings.success` }),
      });
    } catch {
      toggleNotification({
        type: 'danger',
        message: formatMessage({ id: `${PLUGIN_ID}.notification.settings.error` }),
      });
    } finally {
      setSaving(false);
    }
  };

  const hasChanged = webhookUrl !== initialUrl;

  return (
    <Page.Protect permissions={pluginPermissions.settings}>
      <Main>
        {loading ? (
          <Flex justifyContent="center" paddingTop={8}>
            <Loader>
              {formatMessage({ id: `${PLUGIN_ID}.loading.settings` })}
            </Loader>
          </Flex>
        ) : (
          <>
            <Box paddingTop={8} paddingBottom={4} paddingLeft={10} paddingRight={10}>
              <Flex justifyContent="space-between" alignItems="center">
                <Box>
                  <Typography variant="alpha" tag="h1">
                    {formatMessage({ id: `${PLUGIN_ID}.settings.title` })}
                  </Typography>
                  <Typography variant="epsilon" textColor="neutral600">
                    {formatMessage({ id: `${PLUGIN_ID}.settings.subtitle` })}
                  </Typography>
                </Box>
                <Button onClick={handleSave} disabled={!hasChanged || saving} loading={saving}>
                  {formatMessage({ id: `${PLUGIN_ID}.button.save` })}
                </Button>
              </Flex>
            </Box>

            <Box paddingLeft={10} paddingRight={10} paddingBottom={10}>
              <Box background="neutral0" padding={6} shadow="tableShadow" hasRadius>
                <TextInput
                  label={formatMessage({ id: `${PLUGIN_ID}.webhook.label` })}
                  placeholder={formatMessage({ id: `${PLUGIN_ID}.webhook.placeholder` })}
                  hint={formatMessage({ id: `${PLUGIN_ID}.webhook.hint` })}
                  name="webhookUrl"
                  value={webhookUrl}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                    setWebhookUrl(e.target.value)
                  }
                />
              </Box>
            </Box>
          </>
        )}
      </Main>
    </Page.Protect>
  );
};

export { SettingsPage };
