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
  SingleSelect,
  SingleSelectOption,
  Field,
  Grid,
  IconButton,
} from '@strapi/design-system';
import { Trash, Plus, Play } from '@strapi/icons';
import { Page, Layouts, useFetchClient, useNotification } from '@strapi/strapi/admin';
import pluginPermissions from '../permissions';
import { PLUGIN_ID } from '../pluginId';

type WebhookPreset = 'generic' | 'gitlab';

interface WebhookVariable {
  key: string;
  value: string;
}

interface WebhookConfig {
  preset: WebhookPreset;
  url: string;
  token: string;
  ref: string;
  variables: WebhookVariable[];
}

const DEFAULT_CONFIG: WebhookConfig = {
  preset: 'generic',
  url: '',
  token: '',
  ref: 'main',
  variables: [],
};

const SettingsPage = () => {
  const { formatMessage } = useIntl();
  const { get, put, post } = useFetchClient();
  const { toggleNotification } = useNotification();
  const [config, setConfig] = useState<WebhookConfig>(DEFAULT_CONFIG);
  const [initialConfig, setInitialConfig] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [triggering, setTriggering] = useState(false);

  const fetchSettings = useCallback(async () => {
    try {
      const { data } = await get(`/${PLUGIN_ID}/settings`);
      const fetched: WebhookConfig = {
        preset: data.data?.preset || 'generic',
        url: data.data?.url || '',
        token: data.data?.token || '',
        ref: data.data?.ref || 'main',
        variables: data.data?.variables || [],
      };
      setConfig(fetched);
      setInitialConfig(JSON.stringify(fetched));
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
      await put(`/${PLUGIN_ID}/settings`, config);
      setInitialConfig(JSON.stringify(config));
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

  const handleTrigger = async () => {
    if (!config.url) {
      toggleNotification({
        type: 'warning',
        message: formatMessage({ id: `${PLUGIN_ID}.notification.trigger.no-url` }),
      });
      return;
    }
    try {
      setTriggering(true);
      const { data } = await post(`/${PLUGIN_ID}/trigger`, {});
      if (data.data?.triggered && !data.data?.error) {
        toggleNotification({
          type: 'success',
          message: formatMessage({ id: `${PLUGIN_ID}.notification.trigger.success` }),
        });
      } else {
        toggleNotification({
          type: 'danger',
          message: formatMessage(
            { id: `${PLUGIN_ID}.notification.trigger.error` },
            { error: data.data?.error || 'Unknown error' }
          ),
        });
      }
    } catch {
      toggleNotification({
        type: 'danger',
        message: formatMessage(
          { id: `${PLUGIN_ID}.notification.trigger.error` },
          { error: 'Request failed' }
        ),
      });
    } finally {
      setTriggering(false);
    }
  };

  const updateField = <K extends keyof WebhookConfig>(key: K, value: WebhookConfig[K]) => {
    setConfig((prev) => ({ ...prev, [key]: value }));
  };

  const addVariable = () => {
    setConfig((prev) => ({
      ...prev,
      variables: [...prev.variables, { key: '', value: '' }],
    }));
  };

  const updateVariable = (index: number, field: 'key' | 'value', val: string) => {
    setConfig((prev) => ({
      ...prev,
      variables: prev.variables.map((v, i) => (i === index ? { ...v, [field]: val } : v)),
    }));
  };

  const removeVariable = (index: number) => {
    setConfig((prev) => ({
      ...prev,
      variables: prev.variables.filter((_, i) => i !== index),
    }));
  };

  const hasChanged = JSON.stringify(config) !== initialConfig;
  const isGitlab = config.preset === 'gitlab';

  const msg = (id: string) => formatMessage({ id: `${PLUGIN_ID}.${id}` });

  if (loading) {
    return (
      <Page.Protect permissions={pluginPermissions.settings}>
        <Main>
          <Flex justifyContent="center" paddingTop={8}>
            <Loader>{msg('loading.settings')}</Loader>
          </Flex>
        </Main>
      </Page.Protect>
    );
  }

  return (
    <Page.Protect permissions={pluginPermissions.settings}>
      <Main>
        <Layouts.Header
          title={msg('settings.title')}
          subtitle={msg('settings.subtitle')}
          primaryAction={
            <Flex gap={2}>
              <Button
                variant="tertiary"
                startIcon={<Play />}
                onClick={handleTrigger}
                disabled={!config.url || triggering || hasChanged}
                loading={triggering}
              >
                {msg('button.trigger')}
              </Button>
              <Button onClick={handleSave} disabled={!hasChanged || saving} loading={saving}>
                {msg('button.save')}
              </Button>
            </Flex>
          }
        />

        <Layouts.Content>
          <Box background="neutral0" padding={6} shadow="tableShadow" hasRadius>
            <Flex direction="column" alignItems="stretch" gap={6}>
              <Grid.Root gap={5}>
                <Grid.Item col={6} s={12} direction="column" alignItems="stretch">
                  <Field.Root name="preset">
                    <Field.Label>{msg('webhook.preset.label')}</Field.Label>
                    <SingleSelect
                      value={config.preset}
                      onChange={(value: string) => updateField('preset', value as WebhookPreset)}
                    >
                      <SingleSelectOption value="generic">
                        {msg('webhook.preset.generic')}
                      </SingleSelectOption>
                      <SingleSelectOption value="gitlab">
                        {msg('webhook.preset.gitlab')}
                      </SingleSelectOption>
                    </SingleSelect>
                  </Field.Root>
                </Grid.Item>

                {isGitlab && (
                  <Grid.Item col={6} s={12} direction="column" alignItems="stretch">
                    <Field.Root name="ref">
                      <Field.Label>{msg('webhook.ref.label')}</Field.Label>
                      <TextInput
                        placeholder={msg('webhook.ref.placeholder')}
                        name="ref"
                        value={config.ref}
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                          updateField('ref', e.target.value)
                        }
                      />
                      <Field.Hint>{msg('webhook.ref.hint')}</Field.Hint>
                    </Field.Root>
                  </Grid.Item>
                )}
              </Grid.Root>

              <Grid.Root gap={5}>
                <Grid.Item col={12} direction="column" alignItems="stretch">
                  <Field.Root name="url">
                    <Field.Label>{msg('webhook.url.label')}</Field.Label>
                    <TextInput
                      placeholder={
                        isGitlab
                          ? msg('webhook.url.placeholder.gitlab')
                          : msg('webhook.url.placeholder')
                      }
                      name="url"
                      value={config.url}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                        updateField('url', e.target.value)
                      }
                    />
                    <Field.Hint>{msg('webhook.url.hint')}</Field.Hint>
                  </Field.Root>
                </Grid.Item>
              </Grid.Root>

              <Grid.Root gap={5}>
                <Grid.Item col={12} direction="column" alignItems="stretch">
                  <Field.Root name="token">
                    <Field.Label>{msg('webhook.token.label')}</Field.Label>
                    <TextInput
                      placeholder={msg('webhook.token.placeholder')}
                      name="token"
                      type="password"
                      value={config.token}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                        updateField('token', e.target.value)
                      }
                    />
                    <Field.Hint>
                      {isGitlab ? msg('webhook.token.hint.gitlab') : msg('webhook.token.hint')}
                    </Field.Hint>
                  </Field.Root>
                </Grid.Item>
              </Grid.Root>
            </Flex>
          </Box>

          <Box paddingTop={6}>
            <Box background="neutral0" shadow="tableShadow" hasRadius>
              <Box padding={6} borderColor="neutral200" borderWidth="0 0 1px 0" borderStyle="solid">
                <Typography variant="delta" tag="h2">
                  {msg('webhook.variables.label')}
                </Typography>
              </Box>

              <Box padding={6}>
                {config.variables.length > 0 && (
                  <Box paddingBottom={4}>
                    <Grid.Root gap={4}>
                      <Grid.Item col={5} s={12}>
                        <Typography variant="sigma" textColor="neutral600">
                          {msg('webhook.variables.key')}
                        </Typography>
                      </Grid.Item>
                      <Grid.Item col={6} s={12}>
                        <Typography variant="sigma" textColor="neutral600">
                          {msg('webhook.variables.value')}
                        </Typography>
                      </Grid.Item>
                      <Grid.Item col={1} />
                    </Grid.Root>
                  </Box>
                )}

                <Flex direction="column" alignItems="stretch" gap={2}>
                  {config.variables.map((variable, index) => (
                    <Grid.Root key={index} gap={4}>
                      <Grid.Item col={5} s={12} direction="column" alignItems="stretch">
                        <TextInput
                          aria-label={msg('webhook.variables.key')}
                          placeholder={msg('webhook.variables.key')}
                          name={`var-key-${index}`}
                          value={variable.key}
                          onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                            updateVariable(index, 'key', e.target.value)
                          }
                        />
                      </Grid.Item>
                      <Grid.Item col={6} s={12} direction="column" alignItems="stretch">
                        <TextInput
                          aria-label={msg('webhook.variables.value')}
                          placeholder={msg('webhook.variables.value')}
                          name={`var-value-${index}`}
                          value={variable.value}
                          onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                            updateVariable(index, 'value', e.target.value)
                          }
                        />
                      </Grid.Item>
                      <Grid.Item col={1} s={12}>
                        <Flex justifyContent="center">
                          <IconButton
                            onClick={() => removeVariable(index)}
                            label="Delete"
                            variant="ghost"
                          >
                            <Trash />
                          </IconButton>
                        </Flex>
                      </Grid.Item>
                    </Grid.Root>
                  ))}
                </Flex>

                <Box paddingTop={4}>
                  <Button
                    variant="tertiary"
                    startIcon={<Plus />}
                    onClick={addVariable}
                    size="S"
                  >
                    {msg('webhook.variables.add')}
                  </Button>
                </Box>
              </Box>
            </Box>
          </Box>
        </Layouts.Content>
      </Main>
    </Page.Protect>
  );
};

export { SettingsPage };
