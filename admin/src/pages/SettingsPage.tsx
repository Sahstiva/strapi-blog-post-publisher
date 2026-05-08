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
import { Trash, Plus } from '@strapi/icons';
import { Page, useFetchClient, useNotification } from '@strapi/strapi/admin';
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
  const { get, put } = useFetchClient();
  const { toggleNotification } = useNotification();
  const [config, setConfig] = useState<WebhookConfig>(DEFAULT_CONFIG);
  const [initialConfig, setInitialConfig] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

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

  return (
    <Page.Protect permissions={pluginPermissions.settings}>
      <Main>
        {loading ? (
          <Flex justifyContent="center" paddingTop={8}>
            <Loader>{msg('loading.settings')}</Loader>
          </Flex>
        ) : (
          <>
            <Box paddingTop={8} paddingBottom={4} paddingLeft={10} paddingRight={10}>
              <Flex justifyContent="space-between" alignItems="center">
                <Box>
                  <Typography variant="alpha" tag="h1">
                    {msg('settings.title')}
                  </Typography>
                  <Typography variant="epsilon" textColor="neutral600">
                    {msg('settings.subtitle')}
                  </Typography>
                </Box>
                <Button onClick={handleSave} disabled={!hasChanged || saving} loading={saving}>
                  {msg('button.save')}
                </Button>
              </Flex>
            </Box>

            <Box paddingLeft={10} paddingRight={10} paddingBottom={10}>
              <Box background="neutral0" padding={6} shadow="tableShadow" hasRadius>
                <Flex direction="column" gap={4}>
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

                  <TextInput
                    label={msg('webhook.url.label')}
                    placeholder={
                      isGitlab
                        ? msg('webhook.url.placeholder.gitlab')
                        : msg('webhook.url.placeholder')
                    }
                    hint={msg('webhook.url.hint')}
                    name="url"
                    value={config.url}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                      updateField('url', e.target.value)
                    }
                  />

                  <TextInput
                    label={msg('webhook.token.label')}
                    placeholder={msg('webhook.token.placeholder')}
                    hint={isGitlab ? msg('webhook.token.hint.gitlab') : msg('webhook.token.hint')}
                    name="token"
                    type="password"
                    value={config.token}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                      updateField('token', e.target.value)
                    }
                  />

                  {isGitlab && (
                    <TextInput
                      label={msg('webhook.ref.label')}
                      placeholder={msg('webhook.ref.placeholder')}
                      hint={msg('webhook.ref.hint')}
                      name="ref"
                      value={config.ref}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                        updateField('ref', e.target.value)
                      }
                    />
                  )}

                  <Box>
                    <Flex justifyContent="space-between" alignItems="center" paddingBottom={2}>
                      <Box>
                        <Typography variant="pi" fontWeight="bold" textColor="neutral800">
                          {msg('webhook.variables.label')}
                        </Typography>
                        <Typography variant="pi" textColor="neutral600" display="block">
                          {isGitlab
                            ? msg('webhook.variables.hint.gitlab')
                            : msg('webhook.variables.hint')}
                        </Typography>
                      </Box>
                      <Button
                        variant="tertiary"
                        startIcon={<Plus />}
                        onClick={addVariable}
                        size="S"
                      >
                        {msg('webhook.variables.add')}
                      </Button>
                    </Flex>

                    {config.variables.length > 0 && (
                      <Flex direction="column" gap={2}>
                        {config.variables.map((variable, index) => (
                          <Grid.Root key={index} gap={2}>
                            <Grid.Item col={5} s={12}>
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
                            <Grid.Item col={6} s={12}>
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
                              <IconButton
                                onClick={() => removeVariable(index)}
                                label="Delete"
                                variant="ghost"
                              >
                                <Trash />
                              </IconButton>
                            </Grid.Item>
                          </Grid.Root>
                        ))}
                      </Flex>
                    )}
                  </Box>
                </Flex>
              </Box>
            </Box>
          </>
        )}
      </Main>
    </Page.Protect>
  );
};

export { SettingsPage };
