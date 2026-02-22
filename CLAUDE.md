# CLAUDE.md — mdyoink project rules

## Architecture

- Manifest V3 Chrome extension: service worker (ES module), popup, options page, on-demand content scripts
- Libraries vendored in lib/ — no npm, no build step
- activeTab permission model — scripts injected on demand via chrome.scripting.executeScript
- Content scripts: content/content.js (extraction), content/youtube.js (YouTube transcripts), content/picker.js (element picker)
- Extraction scope: controlled by `scope` parameter ('article' | 'fullpage' | 'selection' | null) passed through service worker to content script
- Element picker uses chrome.storage.session to pass results back to popup (popup closes during picking, reopens via chrome.action.openPopup)

## Code Rules

### Settings & State

- DEFAULT_SETTINGS has nested objects (llm, obsidian, markdown, etc.) — ALWAYS use structuredClone(DEFAULT_SETTINGS) + deepMerge when loading/merging settings. NEVER use Object.assign or spread for settings.
- deepMerge is exported from lib/output-modes.js — import and reuse it everywhere; do not create new merge utilities.

### Guards & Safety

- Always guard property access on DOM nodes (e.g., node.rows, node.children) before indexing into them — empty/missing collections crash.
- Always wrap new URL() in try/catch or use the parseDomain() helper in service-worker.js — tabs can have chrome://, about:blank, or empty URLs.
- When interpolating user-provided text into Markdown syntax ([text](url), ![alt](src)), escape special characters: backslash-escape [ ] \ in text, percent-encode ( ) in URLs. Use escapeMarkdownText() and escapeMarkdownUrl() helpers.
- When calling functions that iterate data (e.g., formatYouTubeTranscript with segments), verify the data exists and is the expected type (Array.isArray + length check) before calling.

### Accessibility

- Every interactive element needs a :focus-visible style using var(--accent).
- Form inputs need associated label elements (use .visually-hidden if label should be invisible).
- Radio-like button groups need role="radiogroup" on the container and role="radio" + aria-checked on each button. Toggle aria-checked in JS when selection changes.

### Picker & Injected Scripts

- content/picker.js is a self-contained IIFE — all styles are inline (no CSS files) to avoid page CSS conflicts.
- Picker event listeners use capture phase (third arg `true`) to intercept before page handlers.
- Guard against double injection with `window.__mdyoink_picker_active`.
- Guard `el.className` with `typeof === 'string'` check — SVG elements have SVGAnimatedString, not a string.
- Picker communicates back to service worker via chrome.runtime.sendMessage, not window globals.

### Consistency

- When fixing a pattern in one file, grep for the same pattern in ALL files and fix everywhere. Common locations: service-worker.js, popup/popup.js, options/options.js, content/content.js.
- URL detection patterns (e.g., YouTube) must be consistent between service worker and content scripts. service-worker.js uses isYouTubeUrl(), content/content.js uses isYouTubePage() — both must cover /watch, /shorts/, /embed/, and youtu.be/.
- Use .visually-hidden (with clip-path: inset(100%), not the deprecated clip property) for accessible hidden elements.

### CSS

- Use CSS custom properties (var(--accent), var(--border), etc.) for all colors — supports dark/light mode.
- Use clip-path: inset(100%) instead of the deprecated clip: rect() for visual hiding.
- Never remove outline without providing a :focus-visible replacement.

### Downloads

- Use URL.createObjectURL for download blobs, not FileReader.readAsDataURL.
- Always revoke object URLs in a finally block.
- Check chrome.runtime.lastError in chrome.downloads.download callbacks.
