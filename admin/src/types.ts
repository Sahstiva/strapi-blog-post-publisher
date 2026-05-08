export type LocaleStatus = 'draft' | 'published' | 'missing';

export interface LocaleInfo {
  locale: string;
  status: LocaleStatus;
}

export interface PostEntry {
  documentId: string;
  title: string;
  updatedAt: string;
  locales: LocaleInfo[];
}
