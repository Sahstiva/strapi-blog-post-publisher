import type { PluginConfig } from '../types';

export default {
  default: {
    contentType: '',
    titleField: 'title',
  },
  validator: (config: Partial<PluginConfig>) => {
    if (!config.contentType || typeof config.contentType !== 'string') {
      throw new Error(
        'bulk-publish: contentType is required (e.g. "api::blog-post.blog-post")'
      );
    }
    if (config.titleField && typeof config.titleField !== 'string') {
      throw new Error('bulk-publish: titleField must be a string');
    }
  },
};
