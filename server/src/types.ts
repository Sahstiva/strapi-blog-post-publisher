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

export type WebhookPreset = 'generic' | 'gitlab';

export const WEBHOOK_PRESETS: WebhookPreset[] = ['generic', 'gitlab'];

export interface WebhookVariable {
  key: string;
  value: string;
}

export interface WebhookConfig {
  preset: WebhookPreset;
  url: string;
  token: string;
  ref: string;
  variables: WebhookVariable[];
}

export const DEFAULT_WEBHOOK_CONFIG: WebhookConfig = {
  preset: 'generic',
  url: '',
  token: '',
  ref: 'main',
  variables: [],
};

export interface PluginConfig {
  contentType: string;
  titleField: string;
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
