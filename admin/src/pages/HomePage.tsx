import { useState, useEffect, useCallback } from 'react';
import { useIntl } from 'react-intl';
import {
  Main,
  Box,
  Badge,
  Typography,
  Button,
  Table,
  Thead,
  Tbody,
  Tr,
  Th,
  Td,
  Checkbox,
  Flex,
  Loader,
  Dialog,
} from '@strapi/design-system';
import { WarningCircle } from '@strapi/icons';
import { Page, useFetchClient, useNotification } from '@strapi/strapi/admin';
import pluginPermissions from '../permissions';
import LocaleBadges from '../components/LocaleBadges';
import { PLUGIN_ID } from '../pluginId';
import type { PostEntry, LocaleInfo } from '../types';

const HomePage = () => {
  const { formatMessage } = useIntl();
  const { get, post } = useFetchClient();
  const { toggleNotification } = useNotification();
  const [posts, setPosts] = useState<PostEntry[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [publishing, setPublishing] = useState(false);

  const fetchPosts = useCallback(async () => {
    try {
      setLoading(true);
      const { data } = await get(`/${PLUGIN_ID}/posts`);
      setPosts(data.data || []);
    } catch {
      toggleNotification({
        type: 'danger',
        message: formatMessage({ id: `${PLUGIN_ID}.notification.load.error` }),
      });
    } finally {
      setLoading(false);
    }
  }, [get, toggleNotification, formatMessage]);

  useEffect(() => {
    fetchPosts();
  }, [fetchPosts]);

  const handleSelectAll = () => {
    if (selectedIds.size === posts.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(posts.map((p) => p.documentId)));
    }
  };

  const handleSelect = (documentId: string) => {
    const next = new Set(selectedIds);
    if (next.has(documentId)) {
      next.delete(documentId);
    } else {
      next.add(documentId);
    }
    setSelectedIds(next);
  };

  const handlePublish = async () => {
    if (selectedIds.size === 0) return;

    try {
      setPublishing(true);
      const { data } = await post(`/${PLUGIN_ID}/publish`, {
        documentIds: Array.from(selectedIds),
      });

      const result = data.data;
      const publishedCount = result.published?.length || 0;
      const totalLocales =
        result.published?.reduce(
          (sum: number, p: { localesPublished: string[] }) => sum + p.localesPublished.length,
          0
        ) || 0;
      const errorCount = result.errors?.length || 0;

      let message = formatMessage(
        { id: `${PLUGIN_ID}.notification.publish.success` },
        { count: publishedCount, locales: totalLocales }
      );
      if (result.webhookTriggered && !result.webhookError) {
        message += ' ' + formatMessage({ id: `${PLUGIN_ID}.notification.publish.webhook` });
      } else if (result.webhookError) {
        message +=
          ' ' +
          formatMessage(
            { id: `${PLUGIN_ID}.notification.publish.webhook-error` },
            { error: result.webhookError }
          );
      }
      if (errorCount > 0) {
        message +=
          ' ' +
          formatMessage(
            { id: `${PLUGIN_ID}.notification.publish.errors` },
            { count: errorCount }
          );
      }

      toggleNotification({
        type: errorCount > 0 ? 'warning' : 'success',
        message,
      });

      setSelectedIds(new Set());
      await fetchPosts();
    } catch {
      toggleNotification({
        type: 'danger',
        message: formatMessage({ id: `${PLUGIN_ID}.notification.publish.error` }),
      });
    } finally {
      setPublishing(false);
    }
  };

  const getPostStatus = (locales: LocaleInfo[]): string => {
    const hasDraft = locales.some((l) => l.status === 'draft');
    const hasPublished = locales.some((l) => l.status === 'published');
    if (hasDraft && hasPublished) {
      return formatMessage({ id: `${PLUGIN_ID}.status.partial` });
    }
    if (hasDraft) {
      return formatMessage({ id: `${PLUGIN_ID}.status.draft` });
    }
    return formatMessage({ id: `${PLUGIN_ID}.status.published` });
  };

  const getStatusColor = (locales: LocaleInfo[]): string => {
    const hasDraft = locales.some((l) => l.status === 'draft');
    const hasPublished = locales.some((l) => l.status === 'published');
    if (hasDraft && hasPublished) return 'warning600';
    if (hasDraft) return 'danger600';
    return 'success600';
  };

  const formatTimeAgo = (dateStr: string): string => {
    const diff = Date.now() - new Date(dateStr).getTime();
    if (diff < 0) return formatMessage({ id: `${PLUGIN_ID}.time.just-now` });
    const minutes = Math.floor(diff / 60000);
    if (minutes < 1) return formatMessage({ id: `${PLUGIN_ID}.time.just-now` });
    if (minutes < 60) {
      return formatMessage({ id: `${PLUGIN_ID}.time.minutes-ago` }, { count: minutes });
    }
    const hours = Math.floor(minutes / 60);
    if (hours < 24) {
      return formatMessage({ id: `${PLUGIN_ID}.time.hours-ago` }, { count: hours });
    }
    const days = Math.floor(hours / 24);
    return formatMessage({ id: `${PLUGIN_ID}.time.days-ago` }, { count: days });
  };

  return (
    <Page.Protect permissions={pluginPermissions.publish}>
      <Main>
        <Box paddingTop={8} paddingBottom={4} paddingLeft={10} paddingRight={10}>
          <Flex justifyContent="space-between" alignItems="center">
            <Box>
              <Typography variant="alpha" tag="h1">
                {formatMessage({ id: `${PLUGIN_ID}.page.title` })}
              </Typography>
              <Typography variant="epsilon" textColor="neutral600">
                {formatMessage({ id: `${PLUGIN_ID}.page.subtitle` })}
              </Typography>
              <Flex gap={3} paddingTop={2}>
                <Flex gap={1} alignItems="center">
                  <Badge textColor="success700" backgroundColor="success100" size="S">
                    en
                  </Badge>
                  <Typography variant="pi" textColor="neutral600">
                    {formatMessage({ id: `${PLUGIN_ID}.legend.draft` })}
                  </Typography>
                </Flex>
                <Flex gap={1} alignItems="center">
                  <Badge textColor="primary700" backgroundColor="primary100" size="S">
                    en &#10003;
                  </Badge>
                  <Typography variant="pi" textColor="neutral600">
                    {formatMessage({ id: `${PLUGIN_ID}.legend.published` })}
                  </Typography>
                </Flex>
                <Flex gap={1} alignItems="center">
                  <Badge textColor="warning700" backgroundColor="warning100" size="S">
                    en &#10007;
                  </Badge>
                  <Typography variant="pi" textColor="neutral600">
                    {formatMessage({ id: `${PLUGIN_ID}.legend.missing` })}
                  </Typography>
                </Flex>
              </Flex>
            </Box>
            <Dialog.Root>
              <Dialog.Trigger>
                <Button disabled={selectedIds.size === 0 || publishing} loading={publishing}>
                  {publishing
                    ? formatMessage({ id: `${PLUGIN_ID}.button.publishing` })
                    : formatMessage(
                        { id: `${PLUGIN_ID}.button.publish` },
                        { count: selectedIds.size }
                      )}
                </Button>
              </Dialog.Trigger>
              <Dialog.Content>
                <Dialog.Header>
                  {formatMessage({ id: `${PLUGIN_ID}.confirm.title` })}
                </Dialog.Header>
                <Dialog.Body icon={<WarningCircle fill="danger600" />}>
                  {formatMessage(
                    { id: `${PLUGIN_ID}.confirm.body` },
                    { count: selectedIds.size }
                  )}
                </Dialog.Body>
                <Dialog.Footer>
                  <Dialog.Cancel>
                    <Button variant="tertiary">
                      {formatMessage({ id: `${PLUGIN_ID}.button.cancel` })}
                    </Button>
                  </Dialog.Cancel>
                  <Dialog.Action>
                    <Button variant="danger-light" onClick={handlePublish} loading={publishing}>
                      {formatMessage({ id: `${PLUGIN_ID}.button.confirm` })}
                    </Button>
                  </Dialog.Action>
                </Dialog.Footer>
              </Dialog.Content>
            </Dialog.Root>
          </Flex>
        </Box>

        <Box paddingLeft={10} paddingRight={10} paddingBottom={10}>
          {loading ? (
            <Flex justifyContent="center" paddingTop={8}>
              <Loader>{formatMessage({ id: `${PLUGIN_ID}.loading.posts` })}</Loader>
            </Flex>
          ) : posts.length === 0 ? (
            <Box paddingTop={8}>
              <Typography variant="delta" textColor="neutral600" textAlign="center">
                {formatMessage({ id: `${PLUGIN_ID}.empty.message` })}
              </Typography>
            </Box>
          ) : (
            <Table colCount={4} rowCount={posts.length + 1}>
              <Thead>
                <Tr>
                  <Th>
                    <Checkbox
                      checked={posts.length > 0 && selectedIds.size === posts.length}
                      indeterminate={selectedIds.size > 0 && selectedIds.size < posts.length}
                      onCheckedChange={handleSelectAll}
                    />
                  </Th>
                  <Th>
                    <Typography variant="sigma">
                      {formatMessage({ id: `${PLUGIN_ID}.table.title` })}
                    </Typography>
                  </Th>
                  <Th>
                    <Typography variant="sigma">
                      {formatMessage({ id: `${PLUGIN_ID}.table.locales` })}
                    </Typography>
                  </Th>
                  <Th>
                    <Typography variant="sigma">
                      {formatMessage({ id: `${PLUGIN_ID}.table.status` })}
                    </Typography>
                  </Th>
                </Tr>
              </Thead>
              <Tbody>
                {posts.map((entry) => (
                  <Tr key={entry.documentId}>
                    <Td>
                      <Checkbox
                        checked={selectedIds.has(entry.documentId)}
                        onCheckedChange={() => handleSelect(entry.documentId)}
                      />
                    </Td>
                    <Td>
                      <Box>
                        <Typography fontWeight="semiBold" display="block">
                          {entry.title}
                        </Typography>
                        <Typography variant="pi" textColor="neutral500">
                          {formatMessage(
                            { id: `${PLUGIN_ID}.table.updated` },
                            { time: formatTimeAgo(entry.updatedAt) }
                          )}
                        </Typography>
                      </Box>
                    </Td>
                    <Td>
                      <LocaleBadges locales={entry.locales} />
                    </Td>
                    <Td>
                      <Typography
                        textColor={getStatusColor(entry.locales)}
                        fontWeight="semiBold"
                      >
                        {getPostStatus(entry.locales)}
                      </Typography>
                    </Td>
                  </Tr>
                ))}
              </Tbody>
            </Table>
          )}
        </Box>
      </Main>
    </Page.Protect>
  );
};

export { HomePage };
