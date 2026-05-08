# Strapi Bulk Publish

[![npm version](https://img.shields.io/npm/v/strapi-bulk-publish.svg)](https://www.npmjs.com/package/strapi-bulk-publish)
[![license](https://img.shields.io/npm/l/strapi-bulk-publish.svg)](LICENSE)

Strapi 5 plugin to bulk publish content across all locales with a single webhook trigger for frontend rebuild.

## Features

- Dedicated admin page listing all draft documents with per-locale status
- Batch selection and one-click publish across all locales
- Configurable content type and display field
- Auto-detection of default locale from Strapi i18n settings
- Flexible webhook with preset formats: **Generic JSON** and **GitLab Pipeline Trigger**
- Token-based authentication for webhooks
- Configurable key-value variables sent with webhook requests
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
    },
  },
});
```

### Options

| Option | Type | Required | Default | Description |
|--------|------|----------|---------|-------------|
| `contentType` | `string` | **yes** | — | Strapi content type UID (e.g. `api::article.article`) |
| `titleField` | `string` | no | `'title'` | Field name used as the display title in the admin list |

## Webhook

Configure the webhook in **Settings > Bulk Publish > Webhook**. Two formats are supported:

### Generic JSON

Sends a `POST` request with `Content-Type: application/json`:

```json
{
  "event": "bulk-publish",
  "posts": ["documentId1", "documentId2"],
  "publishedAt": "2026-05-08T12:00:00.000Z"
}
```

If a token is configured, it is sent as an `Authorization: Bearer <token>` header. Any custom variables are merged into the JSON body as top-level keys.

### GitLab Pipeline Trigger

Sends a `POST` request with `Content-Type: multipart/form-data`, matching the [GitLab pipeline trigger API](https://docs.gitlab.com/ee/ci/triggers/):

```
token=<trigger-token>
ref=<branch>
variables[BULK_PUBLISH_EVENT]=bulk-publish
variables[BULK_PUBLISH_POSTS]=docId1,docId2
variables[BULK_PUBLISH_DATE]=2026-05-08T12:00:00.000Z
variables[YOUR_CUSTOM_VAR]=value
```

### Webhook Settings

| Field | Description |
|-------|-------------|
| **Preset** | `Generic JSON` or `GitLab Pipeline Trigger` |
| **URL** | Webhook endpoint URL |
| **Token** | Auth token (Bearer header for generic, trigger token for GitLab) |
| **Branch Ref** | Git branch for GitLab pipeline trigger (GitLab only) |
| **Variables** | Key-value pairs sent as extra fields with every request |

The webhook request has a 10-second timeout. Private/internal URLs (localhost, private IP ranges) are blocked for SSRF protection.

## Permissions

Configure in Settings > Roles:

| Action | Purpose |
|--------|---------|
| `plugin::bulk-publish.publish` | Access bulk publish page and publish documents |
| `plugin::bulk-publish.settings` | View and edit webhook settings |

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
