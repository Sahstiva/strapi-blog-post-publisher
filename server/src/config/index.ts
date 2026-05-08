export default {
  default: {
    webhookUrl: '',
  },
  validator: (config: { webhookUrl?: string }) => {
    if (config.webhookUrl && typeof config.webhookUrl !== 'string') {
      throw new Error('bulk-publish: webhookUrl must be a string');
    }
  },
};
