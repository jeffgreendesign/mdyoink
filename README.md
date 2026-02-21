# mdyoink

Yoink any webpage into clean, LLM-ready markdown.

A minimal Chrome/Brave extension that converts any webpage (or selection) to clean Markdown and lets you copy or download it. Built for the LLM-first workflow: clip a webpage, strip the noise, and paste optimized context into Claude, ChatGPT, or your Obsidian vault.

<!-- Screenshot placeholder -->

## Features

- **Three output modes** — LLM (strips images, links, and front matter for token efficiency), Obsidian (full YAML front matter), and Raw (clean Markdown)
- **Token counter** — approximate token count with model context percentage (Claude 200k, GPT-4 128k, Gemini 1M, etc.)
- **Strip links toggle** — remove URLs from Markdown links to save tokens
- **Append to clipboard** — accumulate clips from multiple pages with `---` separators, then paste all at once
- **Domain CSS selectors** — save custom selectors for repeat-visit sites (docs, MDN, etc.) for precise extraction
- **YouTube transcript extraction** — pulls video transcripts directly from the page, no API key needed
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

Spiritual successor to [markdownload](https://github.com/deathau/markdownload/) by deathau, built from scratch with zero inherited code.

## License

MIT

Built by [Jeff Green](https://github.com/jeffgreendesign)
