# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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
