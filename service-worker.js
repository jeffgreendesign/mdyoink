// mdyoink service worker (Manifest V3)
// ES module — all event listeners registered at top level

import { applyMode, slugifyFilename, formatYouTubeTranscript, deepMerge, DEFAULT_SETTINGS } from './lib/output-modes.js';

// ─── Helpers ────────────────────────────────────────────────────────────────

function escapeMarkdownText(str) {
  return str.replace(/[[\]\\]/g, '\\$&');
}

function escapeMarkdownUrl(url) {
  return url.replace(/\(/g, '%28').replace(/\)/g, '%29');
}

function parseDomain(url) {
  try {
    return new URL(url).hostname;
  } catch (e) {
    return '';
  }
}

function isYouTubeUrl(url) {
  return /(?:youtube\.com\/(?:watch|shorts|embed)|youtu\.be\/)/.test(url);
}

// ─── Context Menus ──────────────────────────────────────────────────────────

chrome.runtime.onInstalled.addListener(() => {
  // Create parent menu
  chrome.contextMenus.create({
    id: 'mdyoink-parent',
    title: 'mdyoink',
    contexts: ['page', 'selection', 'link', 'image'],
  });

  // Page-level items
  chrome.contextMenus.create({
    id: 'download-page',
    parentId: 'mdyoink-parent',
    title: 'Download page as Markdown',
    contexts: ['page', 'selection', 'link', 'image'],
  });

  chrome.contextMenus.create({
    id: 'copy-page',
    parentId: 'mdyoink-parent',
    title: 'Copy page as Markdown',
    contexts: ['page', 'selection', 'link', 'image'],
  });

  // Selection items
  chrome.contextMenus.create({
    id: 'download-selection',
    parentId: 'mdyoink-parent',
    title: 'Download selection as Markdown',
    contexts: ['selection'],
  });

  chrome.contextMenus.create({
    id: 'copy-selection',
    parentId: 'mdyoink-parent',
    title: 'Copy selection as Markdown',
    contexts: ['selection'],
  });

  // Link item
  chrome.contextMenus.create({
    id: 'copy-link',
    parentId: 'mdyoink-parent',
    title: 'Copy link as Markdown',
    contexts: ['link'],
  });

  // Image item
  chrome.contextMenus.create({
    id: 'copy-image',
    parentId: 'mdyoink-parent',
    title: 'Copy image as Markdown',
    contexts: ['image'],
  });
});

// ─── Settings Helper ────────────────────────────────────────────────────────

async function getSettings() {
  const data = await chrome.storage.local.get('settings');
  return deepMerge(structuredClone(DEFAULT_SETTINGS), data.settings || {});
}

async function getDomainSelector(domain) {
  const data = await chrome.storage.local.get('domainSelectors');
  const selectors = data.domainSelectors || {};
  return selectors[domain] || null;
}

// ─── Content Extraction ─────────────────────────────────────────────────────

async function injectAndExtract(tabId, options = {}) {
  const { returnMarkdown = true, tabUrl = '' } = options;
  const settings = await getSettings();

  // Use the provided tab URL for domain detection
  const domain = parseDomain(tabUrl);
  const domainSelector = await getDomainSelector(domain);

  const turndownOptions = {
    headingStyle: settings.markdown?.headingStyle || 'atx',
    bulletListMarker: settings.markdown?.bulletListMarker || '-',
    codeBlockStyle: settings.markdown?.codeBlockStyle || 'fenced',
    linkStyle: settings.markdown?.linkStyle || 'inlined',
  };

  // Check if YouTube — inject youtube.js too
  const isYouTube = isYouTubeUrl(tabUrl);

  // Inject libraries
  const files = ['lib/readability.js'];
  if (returnMarkdown) {
    files.push('lib/turndown.js', 'lib/turndown-plugin-gfm.js');
  }
  if (isYouTube) {
    files.push('content/youtube.js');
  }
  files.push('content/content.js');

  await chrome.scripting.executeScript({
    target: { tabId },
    files,
  });

  // Now call the extraction function with config
  const results = await chrome.scripting.executeScript({
    target: { tabId },
    func: (config) => {
      if (typeof window.__mdyoink_extract === 'function') {
        return window.__mdyoink_extract(config);
      }
      return { error: 'Content script not loaded' };
    },
    args: [{ returnMarkdown, turndownOptions, domainSelector }],
  });

  return results?.[0]?.result || { error: 'No result from content script' };
}

// ─── Clipboard & Download Helpers ───────────────────────────────────────────

async function copyToClipboard(tabId, text) {
  await chrome.scripting.executeScript({
    target: { tabId },
    func: (t) => {
      return navigator.clipboard.writeText(t).then(() => true).catch(() => {
        // Fallback: create textarea
        const el = document.createElement('textarea');
        el.value = t;
        el.style.position = 'fixed';
        el.style.opacity = '0';
        document.body.appendChild(el);
        el.select();
        document.execCommand('copy');
        document.body.removeChild(el);
        return true;
      });
    },
    args: [text],
  });
}

async function downloadMarkdown(markdown, title) {
  const filename = slugifyFilename(title);
  const blob = new Blob([markdown], { type: 'text/markdown' });
  const url = URL.createObjectURL(blob);
  try {
    await new Promise((resolve, reject) => {
      chrome.downloads.download({ url, filename, saveAs: false }, (downloadId) => {
        if (chrome.runtime.lastError || !downloadId) {
          reject(chrome.runtime.lastError?.message || 'Download failed');
        } else {
          resolve(downloadId);
        }
      });
    });
  } finally {
    URL.revokeObjectURL(url);
  }
}

// ─── Process Extraction Result ──────────────────────────────────────────────

async function processResult(result, mode) {
  if (result.error) return result;

  const settings = await getSettings();
  let markdown = result.markdown || '';

  // Apply output mode
  const metadata = {
    title: result.title || '',
    url: result.url || '',
    domain: result.domain || '',
    selection: result.hasSelection ? (result.selection || '') : '',
  };

  if (result.isYouTube && Array.isArray(result.segments) && result.segments.length > 0) {
    // YouTube transcript — format according to mode
    const ytFormatted = formatYouTubeTranscript(result, mode, settings);
    markdown = ytFormatted.markdown;
  } else if (result.isYouTube) {
    markdown = `No transcript available for "${result.title || 'this video'}".`;
  }

  markdown = applyMode(mode, markdown, metadata, settings);

  // Handle strip links override based on mode defaults
  // (For context menu flow, we always use the mode's default)

  return { markdown, title: result.title };
}

// ─── Context Menu Handler ───────────────────────────────────────────────────

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (!tab?.id) return;

  const settings = await getSettings();
  const mode = settings.outputMode || 'llm';

  try {
    switch (info.menuItemId) {
      case 'copy-link': {
        const linkText = info.linkText || info.linkUrl;
        const md = `[${escapeMarkdownText(linkText)}](${escapeMarkdownUrl(info.linkUrl)})`;
        await copyToClipboard(tab.id, md);
        return;
      }

      case 'copy-image': {
        const md = `![image](${escapeMarkdownUrl(info.srcUrl)})`;
        await copyToClipboard(tab.id, md);
        return;
      }

      case 'download-page':
      case 'copy-page': {
        const result = await injectAndExtract(tab.id, { returnMarkdown: true, tabUrl: tab.url });
        const processed = await processResult(result, mode);
        if (processed.error) return;

        if (info.menuItemId === 'copy-page') {
          await copyToClipboard(tab.id, processed.markdown);
        } else {
          await downloadMarkdown(processed.markdown, processed.title);
        }
        return;
      }

      case 'download-selection':
      case 'copy-selection': {
        const result = await injectAndExtract(tab.id, { returnMarkdown: true, tabUrl: tab.url });
        const processed = await processResult(result, mode);
        if (processed.error) return;

        if (info.menuItemId === 'copy-selection') {
          await copyToClipboard(tab.id, processed.markdown);
        } else {
          await downloadMarkdown(processed.markdown, processed.title);
        }
        return;
      }
    }
  } catch (e) {
    console.error('mdyoink context menu error:', e);
  }
});

// ─── Keyboard Shortcuts ─────────────────────────────────────────────────────

chrome.commands.onCommand.addListener(async (command) => {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id) return;

  const settings = await getSettings();
  const mode = settings.outputMode || 'llm';

  try {
    const result = await injectAndExtract(tab.id, { returnMarkdown: true, tabUrl: tab.url });
    const processed = await processResult(result, mode);
    if (processed.error) return;

    if (command === 'copy-page') {
      await copyToClipboard(tab.id, processed.markdown);
    } else if (command === 'download-page') {
      await downloadMarkdown(processed.markdown, processed.title);
    }
  } catch (e) {
    console.error('mdyoink command error:', e);
  }
});

// ─── Message Handler (for popup communication) ─────────────────────────────

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'extractContent') {
    handleExtractContent(message).then(sendResponse);
    return true; // Keep channel open for async response
  }

  if (message.action === 'testSelector') {
    handleTestSelector(message).then(sendResponse);
    return true;
  }

  if (message.action === 'getSettings') {
    getSettings().then(sendResponse);
    return true;
  }

  if (message.action === 'getDomainSelector') {
    getDomainSelector(message.domain).then(sendResponse);
    return true;
  }
});

async function handleExtractContent(message) {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id) return { error: 'No active tab' };

  try {
    // For popup flow: don't inject Turndown (popup has it locally)
    // But DO inject Readability and content script
    const tabUrl = tab.url || '';
    const domain = parseDomain(tabUrl);
    const domainSelector = await getDomainSelector(domain);
    const isYouTube = isYouTubeUrl(tabUrl);

    const files = ['lib/readability.js'];
    if (isYouTube) {
      files.push('content/youtube.js');
    }
    files.push('content/content.js');

    await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      files,
    });

    const results = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: (config) => {
        if (typeof window.__mdyoink_extract === 'function') {
          return window.__mdyoink_extract(config);
        }
        return { error: 'Content script not loaded' };
      },
      args: [{ returnMarkdown: false, domainSelector }],
    });

    return results?.[0]?.result || { error: 'No result' };
  } catch (e) {
    return { error: e.message || 'Extraction failed' };
  }
}

async function handleTestSelector(message) {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id) return { error: 'No active tab' };

  try {
    // Inject content script first if needed
    await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      files: ['lib/readability.js', 'content/content.js'],
    });

    const results = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: (selector) => {
        if (typeof window.__mdyoink_extract === 'function') {
          return window.__mdyoink_extract({ testSelector: selector });
        }
        return { error: 'Content script not loaded' };
      },
      args: [message.selector],
    });

    return results?.[0]?.result || { error: 'No result' };
  } catch (e) {
    return { error: e.message || 'Test failed' };
  }
}
