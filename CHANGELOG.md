# Changelog

## [0.3.0] - 2026-02-21

### Fixed

- Article extraction now works on Shadow DOM sites (e.g., MSN.com) where content is rendered inside web component shadow roots
- Full Page scope and element picker also capture shadow DOM content

### Added

- Shadow DOM flattening helpers (`cloneWithShadowDom`, `getInnerHtmlWithShadows`) in content script
- Inline shadow-aware serializer in element picker
- TODO.md for project backlog
- CHANGELOG.md for version history

## [0.2.0] - 2026-02-21

### Added

- Extraction scope switcher: Article / Full Page / Selection modes
- Visual element picker for precise content extraction
- Documentation for scope switcher and element picker

### Fixed

- Mode button border-radius and settings gear icon

## [0.1.0] - 2026-02-21

### Added

- Initial Chrome extension MVP with Manifest V3
- Readability-based article extraction
- HTML-to-Markdown conversion via Turndown with GFM support
- Output modes: LLM, Obsidian, Raw
- YouTube transcript extraction
- Domain-specific CSS selectors for custom extraction
- Context menu and keyboard shortcut support
- Options page with settings management
- Dark/light mode support

### Fixed

- Deep merge for nested settings objects
- ARIA accessibility for radio-like button groups
- Error surfacing and guard clauses across codebase
- CSS clip-path usage (replaced deprecated clip property)
- YouTube URL detection for youtu.be short links
- Markdown escaping for special characters
- Focus-visible styles and download blob handling
