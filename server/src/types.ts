export type LocaleStatus = 'draft' | 'published' | 'missing';

export interface LocaleInfo {
  locale: string;
  status: LocaleStatus;
}

export interface PostInfo {
  documentId: string;
  title: string;
  updatedAt: string;
  locales: LocaleInfo[];
}

export interface PublishResult {
  documentId: string;
  title: string;
  localesPublished: string[];
  localeErrors: { locale: string; error: string }[];
}

export interface PluginConfig {
  contentType: string;
  titleField: string;
  webhookUrl: string;
}

export interface DraftDocument {
  documentId: string;
  title?: string;
  updatedAt: string;
  [key: string]: unknown;
}

export interface PublishedDocument {
  documentId: string;
  updatedAt: string;
  [key: string]: unknown;
}
