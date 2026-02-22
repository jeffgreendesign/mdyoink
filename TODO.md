# TODO

## Extraction Improvements

- [ ] **Update Readability.js to 0.6.0** — Current vendored version is ~0.5.0. Latest (March 2025) adds Parsely metadata fallback, improved JSON-LD parsing, better data table support, Jekyll footnotes, and enhanced author/byline extraction. [Changelog](https://github.com/mozilla/readability/blob/main/CHANGELOG.md)

- [ ] **Evaluate Defuddle as extraction alternative** — [Defuddle](https://github.com/kepano/defuddle) (v0.7.0) by the Obsidian developer is a more forgiving extractor that removes fewer uncertain elements, extracts schema.org metadata, and has built-in markdown conversion. Zero-dependency browser bundle available. Could serve as a user-selectable alternative engine or a replacement for Readability.

- [ ] **Closed shadow root handling** — Currently only open shadow roots can be flattened (closed roots are inaccessible by spec). Monitor for future web platform changes or heuristics to detect and work around closed shadow DOM content.

## General

- [ ] **Add version metadata to vendored libraries** — `lib/readability.js`, `lib/turndown.js`, and `lib/turndown-plugin-gfm.js` lack version comments. Add version headers to track what's vendored.
