import type { PluginConfig } from '../types';

export default {
  default: {
    contentType: '',
    titleField: 'title',
    webhookUrl: '',
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
    if (config.webhookUrl && typeof config.webhookUrl !== 'string') {
      throw new Error('bulk-publish: webhookUrl must be a string');
    }
  },
};
