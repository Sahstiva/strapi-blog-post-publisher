# Strapi Bulk Publish

Strapi 5 plugin to bulk publish blog posts across all locales with a single webhook trigger for frontend rebuild.

## Features

- Dedicated admin page listing all draft blog posts with per-locale status
- Batch selection and one-click publish across all locales
- Single consolidated webhook call after publishing (no per-locale rebuilds)
- Custom permissions: `plugin::bulk-publish.publish` and `plugin::bulk-publish.settings`
- Configurable webhook URL via Settings page

## Installation

```bash
npm install strapi-bulk-publish
```

## Configuration

Add to `config/plugins.ts`:

```typescript
export default ({ env }) => ({
  'bulk-publish': {
    enabled: true,
  },
});
```

Then configure the webhook URL in Settings → Bulk Publish → Webhook.

## Permissions

| Action | Purpose |
|--------|---------|
| `plugin::bulk-publish.publish` | Access bulk publish page and publish posts |
| `plugin::bulk-publish.settings` | Edit webhook URL |

Remove standard `publish` permission on blog-post from the Author role to enforce publishing only through this plugin.
