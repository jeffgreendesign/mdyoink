// mdyoink content script
// Injected into pages via chrome.scripting.executeScript
// Expects: lib/readability.js injected before this file
// Optionally: lib/turndown.js + lib/turndown-plugin-gfm.js for direct markdown conversion
// Optionally: content/youtube.js for YouTube pages

(function () {
  'use strict';

  function isYouTubePage() {
    return window.location.hostname.includes('youtube.com') &&
      window.location.pathname === '/watch';
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

  function extractWithReadability() {
    try {
      const docClone = document.cloneNode(true);
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

    // Fallback: use document.body
    return {
      html: document.body.innerHTML,
      title: document.title,
      byline: '',
      siteName: '',
      excerpt: '',
      publishedTime: '',
      length: document.body.textContent.length,
    };
  }

  function extractWithSelector(selector) {
    const el = document.querySelector(selector);
    if (!el) {
      return null; // Selector didn't match
    }
    return {
      html: el.innerHTML,
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
    } = config;

    // Handle selector testing
    if (testSelector) {
      const el = document.querySelector(testSelector);
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

    let result;

    // Check for selection first
    const selectionHtml = getSelectionHtml();
    if (selectionHtml) {
      result = {
        html: selectionHtml,
        title: document.title,
        byline: '',
        siteName: '',
        excerpt: '',
        publishedTime: '',
        length: selectionHtml.length,
        hasSelection: true,
      };
      metadata.selection = window.getSelection().toString();
    }
    // Then try domain-specific selector
    else if (domainSelector) {
      result = extractWithSelector(domainSelector);
      if (!result) {
        // Selector didn't match — fall back to Readability with warning
        result = extractWithReadability();
        result.selectorFailed = true;
      }
    }
    // Default: Readability extraction
    else {
      result = extractWithReadability();
    }

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
