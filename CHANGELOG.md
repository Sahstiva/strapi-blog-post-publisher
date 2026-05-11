# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.1.1] - 2026-05-11

### Fixed

- Redesigned webhook settings page to match native Strapi layout (Layouts.Header/Content, full-width fields, bordered variables section)

## [1.1.0] - 2026-05-08

### Added

- Webhook preset system: Generic JSON and GitLab Pipeline Trigger formats
- Token-based authentication for webhook requests (Bearer header or GitLab trigger token)
- Branch ref configuration for GitLab pipeline triggers
- Key-value variables editor in Settings UI, sent as extra fields with each webhook request
- GitLab-compatible `multipart/form-data` request format with `variables[...]` fields
- Automatic migration from v1.0.0 `webhookUrl` string to new `WebhookConfig` object

### Changed

- Settings page redesigned with preset selector, token field, and variables editor
- Webhook config stored as structured `WebhookConfig` object instead of plain URL string
- `webhookUrl` removed from `PluginConfig`; webhook is now fully managed via Settings UI

## [1.0.0] - 2026-05-08

### Added

- Dedicated admin page listing all draft documents with per-locale status
- Batch selection and one-click publish across all locales
- Configurable content type via `contentType` plugin option
- Configurable display field via `titleField` plugin option (default: `title`)
- Auto-detection of default locale from Strapi i18n settings
- Single consolidated webhook call after publishing
- SSRF protection for webhook URLs (blocks private/internal IPs)
- Webhook request timeout (10 seconds)
- Batch size limit (max 100 documents per request)
- Confirmation dialog before bulk publishing
- Configurable webhook URL via Settings page
- Custom permissions: `plugin::bulk-publish.publish` and `plugin::bulk-publish.settings`
- Full i18n support for admin UI strings
