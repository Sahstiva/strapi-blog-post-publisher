import { useState, useEffect } from 'react';
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
  const { get, put } = useFetchClient();
  const { toggleNotification } = useNotification();
  const [webhookUrl, setWebhookUrl] = useState('');
  const [initialUrl, setInitialUrl] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const { data } = await get(`/${PLUGIN_ID}/settings`);
        const url = data.data?.webhookUrl || '';
        setWebhookUrl(url);
        setInitialUrl(url);
      } catch (err) {
        toggleNotification({
          type: 'danger',
          message: 'Failed to load settings',
        });
      } finally {
        setLoading(false);
      }
    };
    fetchSettings();
  }, [get, toggleNotification]);

  const handleSave = async () => {
    try {
      setSaving(true);
      await put(`/${PLUGIN_ID}/settings`, { webhookUrl });
      setInitialUrl(webhookUrl);
      toggleNotification({
        type: 'success',
        message: 'Settings saved successfully',
      });
    } catch (err) {
      toggleNotification({
        type: 'danger',
        message: 'Failed to save settings',
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
            <Loader>Loading settings...</Loader>
          </Flex>
        ) : (
          <>
            <Box paddingTop={8} paddingBottom={4} paddingLeft={10} paddingRight={10}>
              <Flex justifyContent="space-between" alignItems="center">
                <Box>
                  <Typography variant="alpha" tag="h1">
                    Bulk Publish Settings
                  </Typography>
                  <Typography variant="epsilon" textColor="neutral600">
                    Configure webhook for frontend rebuild
                  </Typography>
                </Box>
                <Button onClick={handleSave} disabled={!hasChanged || saving} loading={saving}>
                  Save
                </Button>
              </Flex>
            </Box>

            <Box paddingLeft={10} paddingRight={10} paddingBottom={10}>
              <Box background="neutral0" padding={6} shadow="tableShadow" hasRadius>
                <TextInput
                  label="Webhook URL"
                  placeholder="https://example.com/api/rebuild"
                  hint="POST request will be sent to this URL after publishing"
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
