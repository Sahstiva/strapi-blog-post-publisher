import type { Core } from '@strapi/strapi';
import type { PostInfo, PublishResult, DraftDocument, PublishedDocument } from '../types';

export default ({ strapi }: { strapi: Core.Strapi }) => {
  const getContentType = (): string =>
    strapi.plugin('bulk-publish').config('contentType');

  const getTitleField = (): string =>
    strapi.plugin('bulk-publish').config('titleField') || 'title';

  return {
    async getAvailableLocales(): Promise<string[]> {
      const localeService = strapi.plugin('i18n')?.service('locales');
      if (!localeService) {
        return ['en'];
      }
      const locales = await localeService.find();
      return locales.map((l: { code: string }) => l.code);
    },

    async getDefaultLocale(): Promise<string> {
      const localeService = strapi.plugin('i18n')?.service('locales');
      if (!localeService) {
        return 'en';
      }
      const defaultLocale = await localeService.getDefaultLocale();
      return defaultLocale || 'en';
    },

    async getDraftPosts(): Promise<PostInfo[]> {
      const allLocales = await this.getAvailableLocales();
      const defaultLocale = await this.getDefaultLocale();
      const contentType = getContentType();
      const titleField = getTitleField();

      const draftsByLocale = new Map<string, Map<string, { title: string; updatedAt: string }>>();
      const publishedByLocale = new Map<string, Map<string, { updatedAt: string }>>();

      await Promise.all(
        allLocales.map(async (locale) => {
          const [drafts, published] = await Promise.all([
            strapi.documents(contentType as never).findMany({
              locale,
              status: 'draft',
              fields: [titleField, 'updatedAt'],
              limit: 1000,
            }),
            strapi.documents(contentType as never).findMany({
              locale,
              status: 'published',
              fields: ['updatedAt'],
              limit: 1000,
            }),
          ]);

          const localeMap = new Map<string, { title: string; updatedAt: string }>();
          for (const doc of drafts as DraftDocument[]) {
            localeMap.set(doc.documentId, {
              title: String(doc[titleField] ?? ''),
              updatedAt: doc.updatedAt,
            });
          }
          draftsByLocale.set(locale, localeMap);

          const pubMap = new Map<string, { updatedAt: string }>();
          for (const doc of published as PublishedDocument[]) {
            pubMap.set(doc.documentId, { updatedAt: doc.updatedAt });
          }
          publishedByLocale.set(locale, pubMap);
        })
      );

      const allDocIds = new Set<string>();
      for (const localeMap of draftsByLocale.values()) {
        for (const docId of localeMap.keys()) {
          allDocIds.add(docId);
        }
      }

      const posts: PostInfo[] = [];

      for (const docId of allDocIds) {
        let hasUnpublishedLocale = false;
        let latestUpdatedAt = 0;
        let primaryTitle = '';

        const locales: PostInfo['locales'] = [];

        for (const locale of allLocales) {
          const draft = draftsByLocale.get(locale)?.get(docId);
          const pub = publishedByLocale.get(locale)?.get(docId);

          if (!draft) {
            locales.push({ locale, status: 'missing' });
            continue;
          }

          if (locale === defaultLocale) {
            primaryTitle = draft.title;
          }

          const draftTime = new Date(draft.updatedAt).getTime();
          if (draftTime > latestUpdatedAt) {
            latestUpdatedAt = draftTime;
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
          title: primaryTitle || '(untitled)',
          updatedAt: new Date(latestUpdatedAt).toISOString(),
          locales,
        });
      }

      posts.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());

      return posts;
    },

    async publishDocument(
      documentId: string,
      locales?: string[]
    ): Promise<PublishResult> {
      const allLocales = locales ?? (await this.getAvailableLocales());
      const defaultLocale = await this.getDefaultLocale();
      const contentType = getContentType();
      const titleField = getTitleField();
      const localesPublished: string[] = [];
      const localeErrors: PublishResult['localeErrors'] = [];
      let title = '';

      for (const locale of allLocales) {
        try {
          const draft = await strapi.documents(contentType as never).findOne({
            documentId,
            locale,
            status: 'draft',
            fields: [titleField, 'updatedAt'],
          });

          if (!draft) continue;

          const draftDoc = draft as DraftDocument;
          if (locale === defaultLocale && draftDoc[titleField]) {
            title = String(draftDoc[titleField]);
          }

          const published = await strapi.documents(contentType as never).findOne({
            documentId,
            locale,
            status: 'published',
            fields: ['updatedAt'],
          });

          if (
            published &&
            new Date(draftDoc.updatedAt) <= new Date((published as PublishedDocument).updatedAt)
          ) {
            continue;
          }

          await strapi.documents(contentType as never).publish({
            documentId,
            locale,
          });
          localesPublished.push(locale);
        } catch (err: unknown) {
          const message = err instanceof Error ? err.message : 'Unknown error';
          strapi.log.error(
            `bulk-publish: failed to publish ${documentId} locale ${locale}: ${message}`
          );
          localeErrors.push({ locale, error: message });
        }
      }

      if (!title) {
        title = `Document ${documentId}`;
      }

      return { documentId, title, localesPublished, localeErrors };
    },

    async publishMany(
      documentIds: string[]
    ): Promise<{
      published: PublishResult[];
      errors: { documentId: string; error: string }[];
    }> {
      const allLocales = await this.getAvailableLocales();
      const published: PublishResult[] = [];
      const errors: { documentId: string; error: string }[] = [];

      for (const documentId of documentIds) {
        try {
          const result = await this.publishDocument(documentId, allLocales);
          if (result.localesPublished.length > 0) {
            published.push(result);
          } else {
            errors.push({ documentId, error: 'No draft locales found to publish' });
          }
        } catch (err: unknown) {
          const message = err instanceof Error ? err.message : 'Unknown error';
          errors.push({ documentId, error: message });
        }
      }

      return { published, errors };
    },
  };
};
