// mdyoink content script
// Injected into pages via chrome.scripting.executeScript
// Expects: lib/readability.js injected before this file
// Optionally: lib/turndown.js + lib/turndown-plugin-gfm.js for direct markdown conversion
// Optionally: content/youtube.js for YouTube pages

(function () {
  'use strict';

  function isYouTubePage() {
    const hostname = window.location.hostname;
    const pathname = window.location.pathname;
    if (hostname === 'youtu.be' && pathname.length > 1) return true;
    return hostname.includes('youtube.com') &&
      (pathname === '/watch' || pathname.startsWith('/shorts/') || pathname.startsWith('/embed/'));
  }

  function getSelectionHtml() {
    const selection = window.getSelection();
    if (!selection || selection.isCollapsed || selection.rangeCount === 0) {
      return null;
    }
    const range = selection.getRangeAt(0);
    const container = document.createElement('div');
    container.appendChild(range.cloneContents());
    return container.innerHTML;
  }

  // ─── Shadow DOM helpers ────────────────────────────────────────────────────
  // Standard DOM APIs (cloneNode, innerHTML) do not include shadow root
  // content. These helpers "flatten" open shadow roots so Readability and
  // other consumers can see the full page content.

  function hasShadowDescendants(el) {
    if (el.shadowRoot) return true;
    var descendants = el.querySelectorAll('*');
    for (var i = 0; i < descendants.length; i++) {
      if (descendants[i].shadowRoot) return true;
    }
    return false;
  }

  function serializeElementWithShadows(node) {
    if (node.nodeType === Node.TEXT_NODE) return node.textContent;
    if (node.nodeType !== Node.ELEMENT_NODE) return '';
    var tag = node.tagName.toLowerCase();
    var attrs = '';
    for (var a = 0; a < node.attributes.length; a++) {
      var at = node.attributes[a];
      attrs += ' ' + at.name + '="' +
        at.value.replace(/&/g, '&amp;').replace(/"/g, '&quot;') + '"';
    }
    if (node.shadowRoot) {
      return '<' + tag + attrs + '>' +
        getInnerHtmlWithShadows(node.shadowRoot) + '</' + tag + '>';
    }
    if (hasShadowDescendants(node)) {
      return '<' + tag + attrs + '>' +
        getInnerHtmlWithShadows(node) + '</' + tag + '>';
    }
    return node.outerHTML;
  }

  function getInnerHtmlWithShadows(node) {
    if (!node) return '';
    var children = node.childNodes;
    if (!children || children.length === 0) {
      if (node.innerHTML !== undefined) return node.innerHTML;
      return node.textContent || '';
    }

    var parts = [];
    for (var i = 0; i < children.length; i++) {
      var child = children[i];
      if (child.nodeType === Node.TEXT_NODE) {
        parts.push(child.textContent);
      } else if (child.nodeType === Node.COMMENT_NODE) {
        // skip comments
      } else if (child.nodeType === Node.ELEMENT_NODE) {
        // Resolve <slot> elements to their assigned (projected) content
        if (child.tagName === 'SLOT' && typeof child.assignedNodes === 'function') {
          var assigned = child.assignedNodes({ flatten: true });
          if (assigned.length > 0) {
            for (var s = 0; s < assigned.length; s++) {
              parts.push(serializeElementWithShadows(assigned[s]));
            }
          } else {
            // Slot fallback content
            parts.push(getInnerHtmlWithShadows(child));
          }
          continue;
        }
        parts.push(serializeElementWithShadows(child));
      }
    }
    return parts.join('');
  }

  function cloneWithShadowDom(root) {
    // Fast path — no shadow hosts, just clone normally
    var allElements = root.querySelectorAll('*');
    var hasShadow = false;
    for (var i = 0; i < allElements.length; i++) {
      if (allElements[i].shadowRoot) { hasShadow = true; break; }
    }
    if (!hasShadow) return root.cloneNode(true);

    // Serialize the document with shadow DOM content and <slot> elements
    // resolved, then re-parse into a clean document for Readability.
    var headHtml = root.head ? root.head.innerHTML : '';
    var bodyHtml = getInnerHtmlWithShadows(root.body);
    var fullHtml = '<!DOCTYPE html><html><head>' + headHtml +
      '</head><body>' + bodyHtml + '</body></html>';
    return new DOMParser().parseFromString(fullHtml, 'text/html');
  }

  function extractWithReadability() {
    try {
      const docClone = cloneWithShadowDom(document);
      const article = new Readability(docClone).parse();
      if (article && article.content) {
        return {
          html: article.content,
          title: article.title || document.title,
          byline: article.byline || '',
          siteName: article.siteName || '',
          excerpt: article.excerpt || '',
          publishedTime: article.publishedTime || '',
          length: article.length || 0,
        };
      }
    } catch (e) {
      // Readability failed, fall back
    }

    // Fallback: use document.body (with shadow DOM flattening)
    return {
      html: getInnerHtmlWithShadows(document.body),
      title: document.title,
      byline: '',
      siteName: '',
      excerpt: '',
      publishedTime: '',
      length: document.body.textContent.length,
    };
  }

  function extractWithSelector(selector) {
    var el;
    try {
      el = document.querySelector(selector);
    } catch (e) {
      return null; // Invalid selector syntax
    }
    if (!el) {
      return null; // Selector didn't match
    }
    return {
      html: el.shadowRoot ? getInnerHtmlWithShadows(el.shadowRoot) : getInnerHtmlWithShadows(el),
      title: document.title,
      byline: '',
      siteName: '',
      excerpt: '',
      publishedTime: '',
      length: el.textContent.length,
      usedSelector: true,
    };
  }

  function convertToMarkdown(html, turndownOptions) {
    if (typeof TurndownService === 'undefined') {
      return null; // Turndown not injected
    }

    const options = Object.assign({
      headingStyle: 'atx',
      bulletListMarker: '-',
      codeBlockStyle: 'fenced',
      linkStyle: 'inlined',
      hr: '---',
      emDelimiter: '*',
      strongDelimiter: '**',
    }, turndownOptions || {});

    const turndown = new TurndownService(options);

    // Add GFM plugin if available
    if (typeof turndownPluginGfm !== 'undefined') {
      turndown.use(turndownPluginGfm.gfm);
    }

    return turndown.turndown(html);
  }

  // Main extraction function — called by the service worker via executeScript
  window.__mdyoink_extract = async function (config) {
    config = config || {};
    const {
      returnMarkdown = false,
      turndownOptions = {},
      domainSelector = null,
      testSelector = null,
      scope = null, // 'article' | 'fullpage' | 'selection' | null
    } = config;

    // Handle selector testing
    if (testSelector) {
      var el;
      try {
        el = document.querySelector(testSelector);
      } catch (e) {
        return { matched: false, error: 'Invalid selector syntax' };
      }
      if (el) {
        // Briefly highlight the element
        const origOutline = el.style.outline;
        const origTransition = el.style.transition;
        el.style.transition = 'outline 0.15s ease';
        el.style.outline = '3px solid #6366f1';
        setTimeout(() => {
          el.style.outline = origOutline;
          el.style.transition = origTransition;
        }, 2000);
        return { matched: true, tagName: el.tagName, textLength: el.textContent.length };
      }
      return { matched: false };
    }

    const url = window.location.href;
    const domain = window.location.hostname;
    const metadata = { url, domain };

    // YouTube transcript extraction
    if (isYouTubePage() && typeof window.__mdyoink_extractYouTubeTranscript === 'function') {
      const ytResult = await window.__mdyoink_extractYouTubeTranscript();
      if (ytResult.error && !ytResult.title) {
        // Complete failure — fall back to normal extraction
      } else {
        return Object.assign(ytResult, { url, domain });
      }
    }

    // Always check for selection so we can report availability
    const selectionHtml = getSelectionHtml();
    const hasSelection = !!selectionHtml;

    let result;

    if (scope === 'fullpage') {
      // Full page scope — use document.body directly, skip Readability
      result = {
        html: getInnerHtmlWithShadows(document.body),
        title: document.title,
        byline: '',
        siteName: '',
        excerpt: '',
        publishedTime: '',
        length: document.body.textContent.length,
      };
    } else if (scope === 'selection') {
      if (selectionHtml) {
        const selectionText = window.getSelection().toString();
        result = {
          html: selectionHtml,
          title: document.title,
          byline: '',
          siteName: '',
          excerpt: '',
          publishedTime: '',
          length: selectionHtml.length,
          hasSelection: true,
          selection: selectionText,
        };
        metadata.selection = selectionText;
      } else {
        // User requested selection but nothing is selected — fall back with warning
        result = extractWithReadability();
        result.selectorFailed = true;
      }
    } else {
      // scope === 'article' or null — original priority logic
      if (selectionHtml && !scope) {
        // Auto mode: use selection if present (original behavior)
        const selectionText = window.getSelection().toString();
        result = {
          html: selectionHtml,
          title: document.title,
          byline: '',
          siteName: '',
          excerpt: '',
          publishedTime: '',
          length: selectionHtml.length,
          hasSelection: true,
          selection: selectionText,
        };
        metadata.selection = selectionText;
      } else if (domainSelector) {
        result = extractWithSelector(domainSelector);
        if (!result) {
          // Selector didn't match — fall back to Readability with warning
          result = extractWithReadability();
          result.selectorFailed = true;
        }
      } else {
        result = extractWithReadability();
      }
    }

    // Always report whether a selection exists
    result.hasSelection = hasSelection;

    // Add metadata
    result.url = url;
    result.domain = domain;
    result.title = result.title || document.title;

    // Convert to markdown if requested (context menu / shortcut flow)
    if (returnMarkdown) {
      const markdown = convertToMarkdown(result.html, turndownOptions);
      if (markdown !== null) {
        result.markdown = markdown;
        delete result.html; // Don't send raw HTML if we have markdown
      }
    }

    return result;
  };

  // Also set up as a message listener for the popup flow
  // The popup sends a message and we respond with extracted content
  // This is NOT used for context menu flow (which uses executeScript return value)
})();
