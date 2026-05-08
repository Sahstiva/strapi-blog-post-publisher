import { useState, useEffect, useCallback } from 'react';
import {
  Main,
  Box,
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
} from '@strapi/design-system';
import { Page, useFetchClient, useNotification } from '@strapi/strapi/admin';
import pluginPermissions from '../permissions';
import LocaleBadges from '../components/LocaleBadges';
import { PLUGIN_ID } from '../pluginId';

interface LocaleInfo {
  locale: string;
  status: 'draft' | 'published' | 'missing';
}

interface PostEntry {
  documentId: string;
  title: string;
  updatedAt: string;
  locales: LocaleInfo[];
}

const HomePage = () => {
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
    } catch (err) {
      toggleNotification({
        type: 'danger',
        message: 'Failed to load posts',
      });
    } finally {
      setLoading(false);
    }
  }, [get, toggleNotification]);

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

      let message = `Published ${publishedCount} post(s), ${totalLocales} locale(s).`;
      if (result.webhookTriggered) {
        message += ' Webhook triggered.';
      } else if (result.webhookError) {
        message += ` Webhook failed: ${result.webhookError}`;
      }
      if (errorCount > 0) {
        message += ` ${errorCount} error(s).`;
      }

      toggleNotification({
        type: errorCount > 0 ? 'warning' : 'success',
        message,
      });

      setSelectedIds(new Set());
      await fetchPosts();
    } catch (err) {
      toggleNotification({
        type: 'danger',
        message: 'Failed to publish posts',
      });
    } finally {
      setPublishing(false);
    }
  };

  const getPostStatus = (locales: LocaleInfo[]): string => {
    const hasDraft = locales.some((l) => l.status === 'draft');
    const hasPublished = locales.some((l) => l.status === 'published');
    if (hasDraft && hasPublished) return 'Partial';
    if (hasDraft) return 'Draft';
    return 'Published';
  };

  const formatTimeAgo = (dateStr: string): string => {
    const diff = Date.now() - new Date(dateStr).getTime();
    const minutes = Math.floor(diff / 60000);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    return `${days}d ago`;
  };

  return (
    <Page.Protect permissions={pluginPermissions.publish}>
      <Main>
        <Box paddingTop={8} paddingBottom={4} paddingLeft={10} paddingRight={10}>
          <Flex justifyContent="space-between" alignItems="center">
            <Box>
              <Typography variant="alpha" tag="h1">
                Bulk Publish
              </Typography>
              <Typography variant="epsilon" textColor="neutral600">
                Publish blog posts across all locales with a single action
              </Typography>
            </Box>
            <Button
              onClick={handlePublish}
              disabled={selectedIds.size === 0 || publishing}
              loading={publishing}
            >
              {publishing ? 'Publishing...' : `Publish Selected (${selectedIds.size})`}
            </Button>
          </Flex>
        </Box>

        <Box paddingLeft={10} paddingRight={10} paddingBottom={10}>
          {loading ? (
            <Flex justifyContent="center" paddingTop={8}>
              <Loader>Loading posts...</Loader>
            </Flex>
          ) : posts.length === 0 ? (
            <Box paddingTop={8}>
              <Typography variant="delta" textColor="neutral600" textAlign="center">
                No draft blog posts found. All posts are published!
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
                    <Typography variant="sigma">Title (EN)</Typography>
                  </Th>
                  <Th>
                    <Typography variant="sigma">Locales</Typography>
                  </Th>
                  <Th>
                    <Typography variant="sigma">Status</Typography>
                  </Th>
                </Tr>
              </Thead>
              <Tbody>
                {posts.map((entry) => {
                  const status = getPostStatus(entry.locales);
                  return (
                    <Tr key={entry.documentId}>
                      <Td>
                        <Checkbox
                          checked={selectedIds.has(entry.documentId)}
                          onCheckedChange={() => handleSelect(entry.documentId)}
                        />
                      </Td>
                      <Td>
                        <Box>
                          <Typography fontWeight="semiBold">{entry.title}</Typography>
                          <Typography variant="pi" textColor="neutral500">
                            Updated {formatTimeAgo(entry.updatedAt)}
                          </Typography>
                        </Box>
                      </Td>
                      <Td>
                        <LocaleBadges locales={entry.locales} />
                      </Td>
                      <Td>
                        <Typography
                          textColor={
                            status === 'Draft'
                              ? 'danger600'
                              : status === 'Partial'
                                ? 'warning600'
                                : 'success600'
                          }
                          fontWeight="semiBold"
                        >
                          {status}
                        </Typography>
                      </Td>
                    </Tr>
                  );
                })}
              </Tbody>
            </Table>
          )}
        </Box>
      </Main>
    </Page.Protect>
  );
};

export { HomePage };
