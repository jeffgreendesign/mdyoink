// mdyoink popup logic
import {
  applyMode, stripLinks, stripImages, estimateTokens,
  slugifyFilename, formatYouTubeTranscript, deepMerge,
  MODEL_CONTEXTS, DEFAULT_SETTINGS,
} from '../lib/output-modes.js';

// ─── State ──────────────────────────────────────────────────────────────────

let currentMode = 'llm';
let settings = structuredClone(DEFAULT_SETTINGS);
let rawMarkdown = '';
let rawHtml = '';
let metadata = {};
let stripLinksOverride = null; // null = follow mode default, true/false = manual override
let appendMode = false;
let clipboardStack = [];
let extractedData = null;

// ─── DOM References ─────────────────────────────────────────────────────────

const editor = document.getElementById('editor');
const copyBtn = document.getElementById('copyBtn');
const copyLabel = document.getElementById('copyLabel');
const downloadBtn = document.getElementById('downloadBtn');
const settingsBtn = document.getElementById('settingsBtn');
const tokenCount = document.getElementById('tokenCount');
const tokenPercent = document.getElementById('tokenPercent');
const tokenBar = document.getElementById('tokenBar');
const footer = document.getElementById('footer');
const stripLinksBtn = document.getElementById('stripLinksBtn');
const stripLinksLabel = document.getElementById('stripLinksLabel');
const appendBtn = document.getElementById('appendBtn');
const appendBadge = document.getElementById('appendBadge');
const selectorBtn = document.getElementById('selectorBtn');
const selectorPanel = document.getElementById('selectorPanel');
const selectorDomain = document.getElementById('selectorDomain');
const selectorInput = document.getElementById('selectorInput');
const selectorTest = document.getElementById('selectorTest');
const selectorSave = document.getElementById('selectorSave');
const selectorClear = document.getElementById('selectorClear');
const selectorStatus = document.getElementById('selectorStatus');
const editorStatus = document.getElementById('editorStatus');
const modeBtns = document.querySelectorAll('.mode-btn');

// ─── Settings ───────────────────────────────────────────────────────────────

async function loadSettings() {
  const data = await chrome.storage.local.get(['settings', 'outputMode']);
  settings = deepMerge(structuredClone(DEFAULT_SETTINGS), data.settings || {});
  currentMode = data.outputMode || settings.outputMode || 'llm';
  updateModeUI();
}

async function saveOutputMode(mode) {
  await chrome.storage.local.set({ outputMode: mode });
}

// ─── Turndown ───────────────────────────────────────────────────────────────

function createTurndownService() {
  const opts = {
    headingStyle: settings.markdown?.headingStyle || 'atx',
    bulletListMarker: settings.markdown?.bulletListMarker || '-',
    codeBlockStyle: settings.markdown?.codeBlockStyle || 'fenced',
    linkStyle: settings.markdown?.linkStyle || 'inlined',
    hr: '---',
    emDelimiter: '*',
    strongDelimiter: '**',
  };

  const service = new TurndownService(opts);

  if (typeof turndownPluginGfm !== 'undefined') {
    service.use(turndownPluginGfm.gfm);
  }

  return service;
}

// ─── Content Extraction ─────────────────────────────────────────────────────

async function extractContent() {
  try {
    const response = await chrome.runtime.sendMessage({ action: 'extractContent' });

    if (!response || response.error) {
      showError(response?.error || 'Failed to extract content');
      return;
    }

    extractedData = response;
    metadata = {
      title: response.title || '',
      url: response.url || '',
      domain: response.domain || '',
      byline: response.byline || '',
      siteName: response.siteName || '',
      excerpt: response.excerpt || '',
      publishedTime: response.publishedTime || '',
      selection: response.hasSelection ? (response.selection || '') : '',
    };

    // Set up domain selector panel
    selectorDomain.textContent = metadata.domain;

    // Check for existing domain selector
    const existingSelector = await chrome.runtime.sendMessage({
      action: 'getDomainSelector',
      domain: metadata.domain,
    });
    if (existingSelector) {
      selectorInput.value = existingSelector;
    }

    // Handle YouTube
    if (response.isYouTube) {
      if (response.segments) {
        const formatted = formatYouTubeTranscript(response, currentMode, settings);
        rawMarkdown = formatted.markdown;
        rawHtml = ''; // No HTML for YouTube
      } else {
        showError(response.error || 'No transcript available for this video');
        return;
      }
    } else if (response.html) {
      rawHtml = response.html;
      const turndown = createTurndownService();
      rawMarkdown = turndown.turndown(rawHtml);
    } else if (response.markdown) {
      rawMarkdown = response.markdown;
      rawHtml = '';
    }

    // Show warning if selector failed
    if (response.selectorFailed) {
      showEditorStatus("Selector didn't match — using auto-extract", 'warning');
    }

    renderPreview();
  } catch (e) {
    showError('Could not connect to the page. Try refreshing.');
  }
}

// ─── Rendering ──────────────────────────────────────────────────────────────

function renderPreview() {
  let markdown = rawMarkdown;

  // For YouTube, re-format based on current mode
  if (extractedData?.isYouTube && extractedData?.segments) {
    const formatted = formatYouTubeTranscript(extractedData, currentMode, settings);
    markdown = formatted.markdown;
  }

  // Apply output mode
  let processed = applyMode(currentMode, markdown, metadata, settings);

  // Handle strip links override
  const shouldStripLinks = getStripLinksState();
  const modeStripsLinks = currentMode === 'llm' && settings.llm?.stripLinks !== false;

  if (shouldStripLinks && !modeStripsLinks) {
    // Manual override: strip links even though mode doesn't
    processed = stripLinks(processed);
  } else if (!shouldStripLinks && modeStripsLinks) {
    // Manual override: don't strip links even though mode does
    // Need to re-apply mode without link stripping
    const tempSettings = JSON.parse(JSON.stringify(settings));
    tempSettings.llm = tempSettings.llm || {};
    tempSettings.llm.stripLinks = false;
    processed = applyMode(currentMode, markdown, metadata, tempSettings);
  }

  editor.value = processed;
  updateTokenCount();
}

function getStripLinksState() {
  if (stripLinksOverride !== null) return stripLinksOverride;
  // Default: ON for LLM, OFF for Obsidian/Raw
  if (currentMode === 'llm') return settings.llm?.stripLinks !== false;
  return false;
}

function updateStripLinksUI() {
  const isStripping = getStripLinksState();
  stripLinksBtn.classList.toggle('active', isStripping);
  stripLinksLabel.textContent = isStripping ? 'links off' : 'links on';
}

// ─── Token Counter ──────────────────────────────────────────────────────────

function updateTokenCount() {
  const text = editor.value;
  const tokens = estimateTokens(text);
  const model = settings.tokenCounter?.model || 'Claude 200k';
  const maxTokens = MODEL_CONTEXTS[model] || 200000;
  const percentage = (tokens / maxTokens) * 100;

  tokenCount.textContent = `~${tokens.toLocaleString()} tokens`;
  tokenPercent.textContent = `${percentage.toFixed(1)}% of ${model}`;

  // Update bar
  tokenBar.style.width = Math.min(percentage, 100) + '%';
  tokenBar.classList.remove('yellow', 'red');
  if (percentage > 75) {
    tokenBar.classList.add('red');
  } else if (percentage > 25) {
    tokenBar.classList.add('yellow');
  }

  // Hide footer if setting says so
  if (settings.tokenCounter?.show === false) {
    footer.style.display = 'none';
  }
}

// ─── Mode Switching ─────────────────────────────────────────────────────────

function updateModeUI() {
  modeBtns.forEach(btn => {
    const isActive = btn.dataset.mode === currentMode;
    btn.classList.toggle('active', isActive);
    btn.setAttribute('aria-checked', isActive ? 'true' : 'false');
  });
  // Reset strip links override when switching modes
  stripLinksOverride = null;
  updateStripLinksUI();
}

function switchMode(mode) {
  currentMode = mode;
  saveOutputMode(mode);
  updateModeUI();
  if (rawMarkdown || (extractedData?.isYouTube && extractedData?.segments)) {
    renderPreview();
  }
}

// ─── Copy & Download ────────────────────────────────────────────────────────

async function copyToClipboard() {
  const text = editor.value;
  if (!text) return;

  try {
    if (appendMode) {
      // Read current clipboard, append
      try {
        const current = await navigator.clipboard.readText();
        if (clipboardStack.length === 0 && current) {
          // First append — include what was already on clipboard? No, start fresh.
        }
      } catch (e) {
        // Can't read clipboard, that's OK
      }

      clipboardStack.push(text);
      const combined = clipboardStack.join('\n\n---\n\n');
      await navigator.clipboard.writeText(combined);

      // Update badge
      appendBadge.textContent = clipboardStack.length;
      appendBadge.classList.remove('hidden');

      showCopyConfirmation(`Appended (${clipboardStack.length})`);
    } else {
      await navigator.clipboard.writeText(text);
      showCopyConfirmation('Copied');
    }
  } catch (e) {
    // Fallback for clipboard access
    const textarea = document.createElement('textarea');
    textarea.value = appendMode ? clipboardStack.join('\n\n---\n\n') : text;
    textarea.style.position = 'fixed';
    textarea.style.opacity = '0';
    document.body.appendChild(textarea);
    textarea.select();
    document.execCommand('copy');
    document.body.removeChild(textarea);
    showCopyConfirmation(appendMode ? `Appended (${clipboardStack.length})` : 'Copied');
  }
}

function showCopyConfirmation(message) {
  const origText = copyLabel.textContent;
  copyLabel.textContent = message + ' \u2713';
  copyBtn.classList.add('success');
  setTimeout(() => {
    copyLabel.textContent = 'Copy';
    copyBtn.classList.remove('success');
  }, 1500);
}

function downloadMarkdown() {
  const text = editor.value;
  if (!text) return;

  const template = settings.downloads?.filenameTemplate || '{title}';
  let filename = template.replace(/\{title\}/g, metadata.title || 'untitled');
  filename = slugifyFilename(filename);

  const blob = new Blob([text], { type: 'text/markdown;charset=utf-8' });
  const url = URL.createObjectURL(blob);

  chrome.downloads.download({
    url,
    filename,
    saveAs: false,
  }, () => {
    URL.revokeObjectURL(url);
  });
}

// ─── Domain Selector ────────────────────────────────────────────────────────

function toggleSelectorPanel() {
  selectorPanel.classList.toggle('hidden');
}

async function testSelector() {
  const selector = selectorInput.value.trim();
  if (!selector) return;

  const result = await chrome.runtime.sendMessage({
    action: 'testSelector',
    selector,
  });

  selectorStatus.classList.remove('hidden', 'success', 'error', 'warning');

  if (result?.matched) {
    selectorStatus.classList.add('success');
    selectorStatus.textContent = `Matched: <${result.tagName.toLowerCase()}> (${result.textLength} chars)`;
  } else if (result?.error) {
    selectorStatus.classList.add('error');
    selectorStatus.textContent = result.error;
  } else {
    selectorStatus.classList.add('error');
    selectorStatus.textContent = 'No match found for this selector';
  }
}

async function saveSelector() {
  const selector = selectorInput.value.trim();
  if (!selector || !metadata.domain) return;

  const data = await chrome.storage.local.get('domainSelectors');
  const selectors = data.domainSelectors || {};
  selectors[metadata.domain] = selector;
  await chrome.storage.local.set({ domainSelectors: selectors });

  selectorStatus.classList.remove('hidden', 'success', 'error', 'warning');
  selectorStatus.classList.add('success');
  selectorStatus.textContent = 'Selector saved for ' + metadata.domain;

  // Re-extract with the new selector
  extractContent();
}

async function clearSelector() {
  if (!metadata.domain) return;

  const data = await chrome.storage.local.get('domainSelectors');
  const selectors = data.domainSelectors || {};
  delete selectors[metadata.domain];
  await chrome.storage.local.set({ domainSelectors: selectors });

  selectorInput.value = '';
  selectorStatus.classList.remove('hidden', 'success', 'error', 'warning');
  selectorStatus.classList.add('warning');
  selectorStatus.textContent = 'Selector cleared — using auto-extract';

  // Re-extract without selector
  extractContent();
}

// ─── Append Mode ────────────────────────────────────────────────────────────

function toggleAppendMode() {
  appendMode = !appendMode;
  appendBtn.classList.toggle('active', appendMode);

  if (!appendMode) {
    clipboardStack = [];
    appendBadge.classList.add('hidden');
    appendBadge.textContent = '0';
  }
}

function clearAppendStack() {
  clipboardStack = [];
  appendBadge.classList.add('hidden');
  appendBadge.textContent = '0';
  appendMode = false;
  appendBtn.classList.remove('active');
}

// ─── UI Helpers ─────────────────────────────────────────────────────────────

function showError(message) {
  editor.value = '';
  editor.placeholder = message || "mdyoink can't extract this page";
}

function showEditorStatus(message, type) {
  editorStatus.textContent = message;
  editorStatus.className = 'editor-status ' + type;
  editorStatus.classList.remove('hidden');
  setTimeout(() => {
    editorStatus.classList.add('hidden');
  }, 4000);
}

// ─── Event Listeners ────────────────────────────────────────────────────────

// Mode switcher
modeBtns.forEach(btn => {
  btn.addEventListener('click', () => switchMode(btn.dataset.mode));
});

// Strip links toggle
stripLinksBtn.addEventListener('click', () => {
  stripLinksOverride = !getStripLinksState();
  updateStripLinksUI();
  renderPreview();
});

// Append mode
appendBtn.addEventListener('click', toggleAppendMode);

// Long-press / right-click to clear append stack
appendBtn.addEventListener('contextmenu', (e) => {
  e.preventDefault();
  clearAppendStack();
});

// Domain selector
selectorBtn.addEventListener('click', toggleSelectorPanel);
selectorTest.addEventListener('click', testSelector);
selectorSave.addEventListener('click', saveSelector);
selectorClear.addEventListener('click', clearSelector);

// Copy & download
copyBtn.addEventListener('click', copyToClipboard);
downloadBtn.addEventListener('click', downloadMarkdown);

// Settings
settingsBtn.addEventListener('click', () => {
  chrome.runtime.openOptionsPage();
});

// Live token count on edit
editor.addEventListener('input', updateTokenCount);

// ─── Initialize ─────────────────────────────────────────────────────────────

async function init() {
  await loadSettings();
  updateStripLinksUI();
  extractContent();
}

init();
