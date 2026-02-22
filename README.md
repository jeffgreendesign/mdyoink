# mdyoink

Yoink any webpage into clean, LLM-ready Markdown.

A minimal Chrome/Brave extension that converts any webpage (or selection) to clean Markdown and lets you copy or download it. Built for the LLM-first workflow: clip a webpage, strip the noise, and paste optimized context into Claude, ChatGPT, or your Obsidian vault.

<!-- Screenshot placeholder -->

## Features

- **Three output modes** — LLM (strips images, links, and front matter for token efficiency), Obsidian (full YAML front matter), and Raw (clean Markdown)
- **Extraction scope** — switch between Article (Readability auto-extract), Full Page, or Selection with one click
- **Element picker** — click any element on the page to extract just that region as Markdown
- **Token counter** — approximate token count with model context percentage (Claude 200k, GPT-4 128k, Gemini 1M, etc.)
- **Strip links toggle** — remove URLs from Markdown links to save tokens
- **Append to clipboard** — accumulate clips from multiple pages with `---` separators, then paste all at once
- **Domain CSS selectors** — save custom selectors for repeat-visit sites (docs, MDN, etc.) for precise extraction
- **Shadow DOM support** — extracts content from Shadow DOM sites (MSN, web components) where other tools fail
- **YouTube transcript extraction** — pulls video transcripts directly from the page, no API key needed, with configurable timestamp and format options
- **Markdown formatting options** — heading style, bullet markers, code block style, link style, all configurable in settings
- **Export/import domain selectors** — back up and share your custom selectors as JSON
- **Keyboard shortcuts** — configurable hotkeys for quick copy/download
- **Dark/light mode** — respects system preference
- **Zero tracking** — no analytics, no telemetry, no external network requests

## Installation

1. Clone or download this repository
2. Open Chrome or Brave and go to `chrome://extensions`
3. Enable **Developer mode** (toggle in the top right)
4. Click **Load unpacked** and select the `mdyoink` folder
5. Pin the extension to your toolbar

## Keyboard Shortcuts

| Shortcut | Action |
|---|---|
| `Alt+Shift+M` | Open popup |
| `Alt+Shift+D` | Download current page as Markdown |
| `Alt+Shift+C` | Copy current page as Markdown |

Customize in `chrome://extensions/shortcuts`.

## Output Modes

### LLM Mode (default)
Optimized for pasting into Claude, ChatGPT, or other LLMs. Strips image references (LLMs can't see them), strips link URLs (keeps link text), removes front matter, and adds a single `Source: {url}` line at the top. Minimizes token usage while preserving content.

### Obsidian Mode
Full YAML front matter with title, URL, and date. Keeps all images and links intact. Ready to drop into your vault.

### Raw Mode
Clean Markdown conversion with no modifications. Just the Turndown output.

## Context Menu

Right-click on any page to access:
- Download/copy **page** as Markdown
- Download/copy **selection** as Markdown
- Copy **link** as `[text](url)`
- Copy **image** as `![alt](src)`

## Extraction Scope

Control what content gets extracted using the scope switcher in the popup:

- **Article** (default) — uses Readability to auto-extract the main article content, stripping navigation, sidebars, and ads
- **Full Page** — extracts the entire page body, including headers, footers, and navigation
- **Selection** — extracts only the text you've highlighted on the page (disabled if nothing is selected)

## Element Picker

For precise control over what gets extracted:

1. Click the **pick** button in the popup toolbar
2. The popup closes and the page gets a hover overlay
3. Move your mouse over elements — they highlight with a purple border and show their CSS selector
4. Click an element to extract it — the popup reopens with that element's Markdown
5. The picked element's CSS selector is pre-filled in the domain selector panel so you can save it for future visits
6. Press **Esc** or right-click to cancel

## Domain Selectors

For documentation sites where auto-extraction grabs too much (nav bars, sidebars), save a CSS selector per domain:

1. Click the target icon in the popup toolbar
2. Enter a CSS selector (e.g., `article`, `.docs-content`, `main`)
3. Click **Test** to verify the match
4. Click **Save** to remember it for that domain

Manage all saved selectors in Settings.

## Credits

- [Readability.js](https://github.com/mozilla/readability) by Mozilla (Apache 2.0)
- [Turndown](https://github.com/mixmark-io/turndown) by mixmark-io (MIT)
- [Turndown Plugin GFM](https://github.com/mixmark-io/turndown-plugin-gfm) by mixmark-io (MIT)
- Inspired by [markdownload](https://github.com/deathau/markdownload/) by deathau

## License

MIT

Built by [Jeff Green](https://github.com/jeffgreendesign)
