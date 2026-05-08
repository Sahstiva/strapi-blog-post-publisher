# Strapi Bulk Publish

[![npm version](https://img.shields.io/npm/v/strapi-bulk-publish.svg)](https://www.npmjs.com/package/strapi-bulk-publish)
[![license](https://img.shields.io/npm/l/strapi-bulk-publish.svg)](LICENSE)

Strapi 5 plugin to bulk publish content across all locales with a single webhook trigger for frontend rebuild.

## Features

- Dedicated admin page listing all draft documents with per-locale status
- Batch selection and one-click publish across all locales
- Configurable content type and display field
- Auto-detection of default locale from Strapi i18n settings
- Single consolidated webhook call after publishing (no per-locale rebuilds)
- SSRF protection for webhook URLs
- Confirmation dialog before bulk actions
- Custom admin permissions
- Full i18n support for admin UI

## Compatibility

| Strapi | Plugin |
|--------|--------|
| 5.x    | 1.x    |

## Installation

```bash
npm install strapi-bulk-publish
```

## Configuration

Add to your `config/plugins.ts` (or `.js`):

```typescript
export default ({ env }) => ({
  'bulk-publish': {
    enabled: true,
    config: {
      contentType: 'api::blog-post.blog-post', // required — your content type UID
      titleField: 'title',                      // optional, default: 'title'
      webhookUrl: '',                            // optional, can also be set via Settings UI
    },
  },
});
```

### Options

| Option | Type | Required | Default | Description |
|--------|------|----------|---------|-------------|
| `contentType` | `string` | **yes** | — | Strapi content type UID (e.g. `api::article.article`) |
| `titleField` | `string` | no | `'title'` | Field name used as the display title in the admin list |
| `webhookUrl` | `string` | no | `''` | Initial webhook URL; can be changed later in Settings UI |

The `webhookUrl` set in config serves as the initial seed value. Once changed through the admin Settings page, the UI value takes precedence.

## Webhook

After publishing, a single POST request is sent to the configured webhook URL:

```json
{
  "event": "bulk-publish",
  "posts": ["documentId1", "documentId2"],
  "publishedAt": "2026-05-08T12:00:00.000Z"
}
```

The webhook request has a 10-second timeout. Private/internal URLs (localhost, private IP ranges) are blocked for security.

## Permissions

Configure in Settings > Roles:

| Action | Purpose |
|--------|---------|
| `plugin::bulk-publish.publish` | Access bulk publish page and publish documents |
| `plugin::bulk-publish.settings` | View and edit webhook URL |

## Prerequisites

- **Strapi 5** with the **i18n** plugin enabled
- At least one content type with **Draft & Publish** and **Internationalization** enabled

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/my-feature`)
3. Commit your changes (`git commit -am 'Add my feature'`)
4. Push to the branch (`git push origin feature/my-feature`)
5. Open a Pull Request

## License

[MIT](LICENSE)
