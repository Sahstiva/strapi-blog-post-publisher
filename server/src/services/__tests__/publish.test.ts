import { describe, it, expect, vi } from 'vitest';
import publishFactory from '../publish';

function createMockStrapi({
  locales = [{ code: 'en' }, { code: 'fr' }],
  defaultLocale = 'en',
  contentType = 'api::blog-post.blog-post',
  titleField = 'title',
  drafts = new Map<string, any[]>(),
  published = new Map<string, any[]>(),
}: {
  locales?: { code: string }[];
  defaultLocale?: string;
  contentType?: string;
  titleField?: string;
  drafts?: Map<string, any[]>;
  published?: Map<string, any[]>;
} = {}) {
  return {
    plugin: vi.fn((name: string) => {
      if (name === 'i18n') {
        return {
          service: vi.fn(() => ({
            find: vi.fn(() => locales),
            getDefaultLocale: vi.fn(() => defaultLocale),
          })),
        };
      }
      if (name === 'bulk-publish') {
        return {
          config: vi.fn((key: string) => {
            if (key === 'contentType') return contentType;
            if (key === 'titleField') return titleField;
            return '';
          }),
        };
      }
      return null;
    }),
    documents: vi.fn(() => ({
      findMany: vi.fn(({ locale, status }: { locale: string; status: string }) => {
        if (status === 'draft') return drafts.get(locale) || [];
        if (status === 'published') return published.get(locale) || [];
        return [];
      }),
      findOne: vi.fn(
        ({ documentId, locale, status }: { documentId: string; locale: string; status: string }) => {
          const list = status === 'draft' ? drafts.get(locale) : published.get(locale);
          return list?.find((d: any) => d.documentId === documentId) || null;
        }
      ),
      publish: vi.fn(),
    })),
    log: {
      error: vi.fn(),
      warn: vi.fn(),
    },
  } as any;
}

describe('publish service', () => {
  describe('getAvailableLocales', () => {
    it('returns locale codes from i18n plugin', async () => {
      const strapi = createMockStrapi({
        locales: [{ code: 'en' }, { code: 'fr' }, { code: 'de' }],
      });
      const service = publishFactory({ strapi });
      const result = await service.getAvailableLocales();
      expect(result).toEqual(['en', 'fr', 'de']);
    });

    it('falls back to ["en"] when i18n plugin is absent', async () => {
      const strapi = createMockStrapi();
      strapi.plugin = vi.fn(() => null);
      const service = publishFactory({ strapi });
      const result = await service.getAvailableLocales();
      expect(result).toEqual(['en']);
    });
  });

  describe('getDefaultLocale', () => {
    it('returns default locale from i18n', async () => {
      const strapi = createMockStrapi({ defaultLocale: 'fr' });
      const service = publishFactory({ strapi });
      const result = await service.getDefaultLocale();
      expect(result).toBe('fr');
    });

    it('falls back to "en" when i18n plugin is absent', async () => {
      const strapi = createMockStrapi();
      strapi.plugin = vi.fn((name: string) => {
        if (name === 'bulk-publish') {
          return {
            config: vi.fn((key: string) => {
              if (key === 'contentType') return 'api::blog-post.blog-post';
              if (key === 'titleField') return 'title';
              return '';
            }),
          };
        }
        return null;
      });
      const service = publishFactory({ strapi });
      const result = await service.getDefaultLocale();
      expect(result).toBe('en');
    });
  });

  describe('getDraftPosts', () => {
    it('returns posts that need publishing', async () => {
      const now = new Date().toISOString();
      const older = new Date(Date.now() - 86400000).toISOString();

      const drafts = new Map([
        [
          'en',
          [{ documentId: 'doc1', title: 'Test Post', updatedAt: now }],
        ],
        [
          'fr',
          [{ documentId: 'doc1', title: 'Article Test', updatedAt: now }],
        ],
      ]);

      const published = new Map([
        ['en', [{ documentId: 'doc1', updatedAt: older }]],
        ['fr', [] as any[]],
      ]);

      const strapi = createMockStrapi({ drafts, published });
      const service = publishFactory({ strapi });
      const posts = await service.getDraftPosts();

      expect(posts).toHaveLength(1);
      expect(posts[0].documentId).toBe('doc1');
      expect(posts[0].title).toBe('Test Post');
      expect(posts[0].locales).toHaveLength(2);
    });

    it('excludes fully published posts', async () => {
      const now = new Date().toISOString();

      const drafts = new Map([
        ['en', [{ documentId: 'doc1', title: 'Published Post', updatedAt: now }]],
      ]);
      const published = new Map([
        ['en', [{ documentId: 'doc1', updatedAt: now }]],
      ]);

      const strapi = createMockStrapi({
        locales: [{ code: 'en' }],
        drafts,
        published,
      });
      const service = publishFactory({ strapi });
      const posts = await service.getDraftPosts();
      expect(posts).toHaveLength(0);
    });

    it('marks missing locales correctly', async () => {
      const now = new Date().toISOString();

      const drafts = new Map([
        ['en', [{ documentId: 'doc1', title: 'EN Only', updatedAt: now }]],
        ['fr', [] as any[]],
      ]);
      const published = new Map([
        ['en', [] as any[]],
        ['fr', [] as any[]],
      ]);

      const strapi = createMockStrapi({ drafts, published });
      const service = publishFactory({ strapi });
      const posts = await service.getDraftPosts();

      expect(posts).toHaveLength(1);
      const frLocale = posts[0].locales.find((l) => l.locale === 'fr');
      expect(frLocale?.status).toBe('missing');
    });

    it('uses configured titleField for display', async () => {
      const now = new Date().toISOString();

      const drafts = new Map([
        ['en', [{ documentId: 'doc1', name: 'Custom Field', updatedAt: now }]],
      ]);
      const published = new Map([['en', [] as any[]]]);

      const strapi = createMockStrapi({
        locales: [{ code: 'en' }],
        titleField: 'name',
        drafts,
        published,
      });
      const service = publishFactory({ strapi });
      const posts = await service.getDraftPosts();

      expect(posts[0].title).toBe('Custom Field');
    });

    it('uses default locale for title, not hardcoded "en"', async () => {
      const now = new Date().toISOString();

      const drafts = new Map([
        ['en', [{ documentId: 'doc1', title: 'English Title', updatedAt: now }]],
        ['fr', [{ documentId: 'doc1', title: 'Titre Francais', updatedAt: now }]],
      ]);
      const published = new Map([
        ['en', [] as any[]],
        ['fr', [] as any[]],
      ]);

      const strapi = createMockStrapi({
        defaultLocale: 'fr',
        drafts,
        published,
      });
      const service = publishFactory({ strapi });
      const posts = await service.getDraftPosts();

      expect(posts[0].title).toBe('Titre Francais');
    });

    it('returns "(untitled)" when default locale has no title', async () => {
      const now = new Date().toISOString();

      const drafts = new Map([
        ['en', [] as any[]],
        ['fr', [{ documentId: 'doc1', title: 'Titre', updatedAt: now }]],
      ]);
      const published = new Map([
        ['en', [] as any[]],
        ['fr', [] as any[]],
      ]);

      const strapi = createMockStrapi({ drafts, published });
      const service = publishFactory({ strapi });
      const posts = await service.getDraftPosts();

      expect(posts[0].title).toBe('(untitled)');
    });
  });

  describe('publishDocument', () => {
    it('publishes all draft locales', async () => {
      const now = new Date().toISOString();
      const older = new Date(Date.now() - 86400000).toISOString();

      const drafts = new Map([
        ['en', [{ documentId: 'doc1', title: 'Test', updatedAt: now }]],
        ['fr', [{ documentId: 'doc1', title: 'Test FR', updatedAt: now }]],
      ]);
      const published = new Map([
        ['en', [{ documentId: 'doc1', updatedAt: older }]],
        ['fr', [] as any[]],
      ]);

      const strapi = createMockStrapi({ drafts, published });
      const service = publishFactory({ strapi });
      const result = await service.publishDocument('doc1');

      expect(result.localesPublished).toEqual(['en', 'fr']);
      expect(result.localeErrors).toEqual([]);
      expect(result.title).toBe('Test');
    });

    it('skips locales where draft is not newer than published', async () => {
      const now = new Date().toISOString();

      const drafts = new Map([
        ['en', [{ documentId: 'doc1', title: 'Test', updatedAt: now }]],
      ]);
      const published = new Map([
        ['en', [{ documentId: 'doc1', updatedAt: now }]],
      ]);

      const strapi = createMockStrapi({
        locales: [{ code: 'en' }],
        drafts,
        published,
      });
      const service = publishFactory({ strapi });
      const result = await service.publishDocument('doc1');

      expect(result.localesPublished).toEqual([]);
    });

    it('reports per-locale errors without stopping', async () => {
      const now = new Date().toISOString();

      const drafts = new Map([
        ['en', [{ documentId: 'doc1', title: 'Test', updatedAt: now }]],
        ['fr', [{ documentId: 'doc1', title: 'Test FR', updatedAt: now }]],
      ]);
      const published = new Map([
        ['en', [] as any[]],
        ['fr', [] as any[]],
      ]);

      const strapi = createMockStrapi({ drafts, published });
      let callCount = 0;
      strapi.documents = vi.fn(() => ({
        findOne: vi.fn(({ locale, status }: any) => {
          const list = status === 'draft' ? drafts.get(locale) : published.get(locale);
          return list?.find((d: any) => d.documentId === 'doc1') || null;
        }),
        publish: vi.fn(() => {
          callCount++;
          if (callCount === 1) throw new Error('Publish failed for en');
        }),
        findMany: vi.fn(() => []),
      }));

      const service = publishFactory({ strapi });
      const result = await service.publishDocument('doc1', ['en', 'fr']);

      expect(result.localeErrors).toHaveLength(1);
      expect(result.localeErrors[0].locale).toBe('en');
      expect(result.localesPublished).toEqual(['fr']);
    });
  });

  describe('publishMany', () => {
    it('aggregates results across documents', async () => {
      const now = new Date().toISOString();

      const drafts = new Map([
        [
          'en',
          [
            { documentId: 'doc1', title: 'Post 1', updatedAt: now },
            { documentId: 'doc2', title: 'Post 2', updatedAt: now },
          ],
        ],
      ]);
      const published = new Map([['en', [] as any[]]]);

      const strapi = createMockStrapi({
        locales: [{ code: 'en' }],
        drafts,
        published,
      });
      const service = publishFactory({ strapi });
      const result = await service.publishMany(['doc1', 'doc2']);

      expect(result.published).toHaveLength(2);
      expect(result.errors).toHaveLength(0);
    });

    it('reports errors for documents with no draft locales', async () => {
      const strapi = createMockStrapi({
        locales: [{ code: 'en' }],
      });
      const service = publishFactory({ strapi });
      const result = await service.publishMany(['nonexistent']);

      expect(result.published).toHaveLength(0);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].documentId).toBe('nonexistent');
    });
  });
});
