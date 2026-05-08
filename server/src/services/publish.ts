import type { Core } from '@strapi/strapi';

const CONTENT_TYPE = 'api::blog-post.blog-post';

interface PublishResult {
  documentId: string;
  title: string;
  localesPublished: string[];
}

interface PostInfo {
  documentId: string;
  title: string;
  updatedAt: string;
  locales: {
    locale: string;
    status: 'draft' | 'published' | 'missing';
  }[];
}

export default ({ strapi }: { strapi: Core.Strapi }) => ({
  async getAvailableLocales(): Promise<string[]> {
    const localeService = strapi.plugin('i18n')?.service('locales');
    if (!localeService) {
      return ['en'];
    }
    const locales = await localeService.find();
    return locales.map((l: { code: string }) => l.code);
  },

  async getDraftPosts(): Promise<PostInfo[]> {
    const allLocales = await this.getAvailableLocales();

    const draftsByLocale = new Map<string, Map<string, { title: string; updatedAt: string }>>();
    const publishedByLocale = new Map<string, Map<string, { updatedAt: string }>>();

    for (const locale of allLocales) {
      const drafts = await strapi.documents(CONTENT_TYPE).findMany({
        locale,
        status: 'draft',
        fields: ['title', 'updatedAt'],
        limit: 1000,
      });

      const localeMap = new Map<string, { title: string; updatedAt: string }>();
      for (const doc of drafts as any[]) {
        localeMap.set(doc.documentId, { title: doc.title, updatedAt: doc.updatedAt });
      }
      draftsByLocale.set(locale, localeMap);

      const published = await strapi.documents(CONTENT_TYPE).findMany({
        locale,
        status: 'published',
        fields: ['updatedAt'],
        limit: 1000,
      });

      const pubMap = new Map<string, { updatedAt: string }>();
      for (const doc of published as any[]) {
        pubMap.set(doc.documentId, { updatedAt: doc.updatedAt });
      }
      publishedByLocale.set(locale, pubMap);
    }

    const allDocIds = new Set<string>();
    for (const localeMap of draftsByLocale.values()) {
      for (const docId of localeMap.keys()) {
        allDocIds.add(docId);
      }
    }

    const posts: PostInfo[] = [];

    for (const docId of allDocIds) {
      let hasUnpublishedLocale = false;
      let latestUpdatedAt = '';
      let enTitle = '';

      const locales: PostInfo['locales'] = [];

      for (const locale of allLocales) {
        const draft = draftsByLocale.get(locale)?.get(docId);
        const pub = publishedByLocale.get(locale)?.get(docId);

        if (!draft) {
          locales.push({ locale, status: 'missing' });
          continue;
        }

        if (locale === 'en') {
          enTitle = draft.title;
        }

        if (draft.updatedAt > latestUpdatedAt) {
          latestUpdatedAt = draft.updatedAt;
        }

        const needsPublishing = !pub || new Date(draft.updatedAt) > new Date(pub.updatedAt);
        if (needsPublishing) {
          hasUnpublishedLocale = true;
          locales.push({ locale, status: 'draft' });
        } else {
          locales.push({ locale, status: 'published' });
        }
      }

      if (!hasUnpublishedLocale) continue;

      posts.push({
        documentId: docId,
        title: enTitle || '(untitled)',
        updatedAt: latestUpdatedAt,
        locales,
      });
    }

    posts.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());

    return posts;
  },

  async publishDocument(documentId: string): Promise<PublishResult> {
    const allLocales = await this.getAvailableLocales();
    const localesPublished: string[] = [];
    let title = '';

    for (const locale of allLocales) {
      try {
        const draft = await strapi.documents(CONTENT_TYPE).findOne({
          documentId,
          locale,
          status: 'draft',
          fields: ['title', 'updatedAt'],
        } as any);

        if (!draft) continue;

        if (locale === 'en' && (draft as any).title) {
          title = (draft as any).title;
        }

        const published = await strapi.documents(CONTENT_TYPE).findOne({
          documentId,
          locale,
          status: 'published',
          fields: ['updatedAt'],
        } as any);

        if (
          published &&
          new Date((draft as any).updatedAt) <= new Date((published as any).updatedAt)
        ) {
          continue;
        }

        await strapi.documents(CONTENT_TYPE).publish({
          documentId,
          locale,
        } as any);
        localesPublished.push(locale);
      } catch (err) {
        strapi.log.error(
          `bulk-publish: failed to publish ${documentId} locale ${locale}`,
          err
        );
      }
    }

    if (!title) {
      title = `Document ${documentId}`;
    }

    return { documentId, title, localesPublished };
  },

  async publishMany(
    documentIds: string[]
  ): Promise<{
    published: PublishResult[];
    errors: { documentId: string; error: string }[];
  }> {
    const published: PublishResult[] = [];
    const errors: { documentId: string; error: string }[] = [];

    for (const documentId of documentIds) {
      try {
        const result = await this.publishDocument(documentId);
        if (result.localesPublished.length > 0) {
          published.push(result);
        } else {
          errors.push({ documentId, error: 'No draft locales found to publish' });
        }
      } catch (err: any) {
        errors.push({ documentId, error: err.message || 'Unknown error' });
      }
    }

    return { published, errors };
  },
});
