// mdyoink options page logic
import { DEFAULT_SETTINGS } from '../lib/output-modes.js';

// ─── DOM References ─────────────────────────────────────────────────────────

const elements = {
  outputMode: document.getElementById('outputMode'),
  llmStripLinks: document.getElementById('llmStripLinks'),
  llmStripImages: document.getElementById('llmStripImages'),
  llmStripFrontMatter: document.getElementById('llmStripFrontMatter'),
  llmSourceLine: document.getElementById('llmSourceLine'),
  obsidianFrontMatter: document.getElementById('obsidianFrontMatter'),
  tokenModel: document.getElementById('tokenModel'),
  tokenShow: document.getElementById('tokenShow'),
  mdHeadingStyle: document.getElementById('mdHeadingStyle'),
  mdBulletMarker: document.getElementById('mdBulletMarker'),
  mdCodeBlockStyle: document.getElementById('mdCodeBlockStyle'),
  mdLinkStyle: document.getElementById('mdLinkStyle'),
  mdIncludeImages: document.getElementById('mdIncludeImages'),
  downloadFilename: document.getElementById('downloadFilename'),
  ytTimestamps: document.getElementById('ytTimestamps'),
  ytFormat: document.getElementById('ytFormat'),
  selectorsList: document.getElementById('selectorsList'),
  newSelectorDomain: document.getElementById('newSelectorDomain'),
  newSelectorValue: document.getElementById('newSelectorValue'),
  addSelectorBtn: document.getElementById('addSelectorBtn'),
  exportSelectorsBtn: document.getElementById('exportSelectorsBtn'),
  importSelectorsBtn: document.getElementById('importSelectorsBtn'),
  importSelectorsFile: document.getElementById('importSelectorsFile'),
};

// ─── Settings Management ────────────────────────────────────────────────────

let settings = { ...DEFAULT_SETTINGS };
let saveTimeout = null;

async function loadSettings() {
  const data = await chrome.storage.local.get('settings');
  settings = Object.assign({}, DEFAULT_SETTINGS, data.settings || {});
  populateUI();
}

async function saveSettings() {
  // Debounce saves
  clearTimeout(saveTimeout);
  saveTimeout = setTimeout(async () => {
    await chrome.storage.local.set({ settings });
  }, 300);
}

function readSettingsFromUI() {
  settings.outputMode = elements.outputMode.value;

  settings.llm = settings.llm || {};
  settings.llm.stripLinks = elements.llmStripLinks.checked;
  settings.llm.stripImages = elements.llmStripImages.checked;
  settings.llm.stripFrontMatter = elements.llmStripFrontMatter.checked;
  settings.llm.sourceLineFormat = elements.llmSourceLine.value;

  settings.obsidian = settings.obsidian || {};
  settings.obsidian.frontMatterTemplate = elements.obsidianFrontMatter.value;

  settings.tokenCounter = settings.tokenCounter || {};
  settings.tokenCounter.model = elements.tokenModel.value;
  settings.tokenCounter.show = elements.tokenShow.checked;

  settings.markdown = settings.markdown || {};
  settings.markdown.headingStyle = elements.mdHeadingStyle.value;
  settings.markdown.bulletListMarker = elements.mdBulletMarker.value;
  settings.markdown.codeBlockStyle = elements.mdCodeBlockStyle.value;
  settings.markdown.linkStyle = elements.mdLinkStyle.value;
  settings.markdown.includeImages = elements.mdIncludeImages.checked;

  settings.downloads = settings.downloads || {};
  settings.downloads.filenameTemplate = elements.downloadFilename.value;

  settings.youtube = settings.youtube || {};
  settings.youtube.timestamps = elements.ytTimestamps.value;
  settings.youtube.format = elements.ytFormat.value;

  saveSettings();
}

function populateUI() {
  elements.outputMode.value = settings.outputMode || 'llm';

  elements.llmStripLinks.checked = settings.llm?.stripLinks !== false;
  elements.llmStripImages.checked = settings.llm?.stripImages !== false;
  elements.llmStripFrontMatter.checked = settings.llm?.stripFrontMatter !== false;
  elements.llmSourceLine.value = settings.llm?.sourceLineFormat || 'Source: {url}';

  elements.obsidianFrontMatter.value = settings.obsidian?.frontMatterTemplate ||
    '---\ntitle: {title}\nurl: {url}\ndate: {date:YYYY-MM-DD}\n---';

  elements.tokenModel.value = settings.tokenCounter?.model || 'Claude 200k';
  elements.tokenShow.checked = settings.tokenCounter?.show !== false;

  elements.mdHeadingStyle.value = settings.markdown?.headingStyle || 'atx';
  elements.mdBulletMarker.value = settings.markdown?.bulletListMarker || '-';
  elements.mdCodeBlockStyle.value = settings.markdown?.codeBlockStyle || 'fenced';
  elements.mdLinkStyle.value = settings.markdown?.linkStyle || 'inlined';
  elements.mdIncludeImages.checked = settings.markdown?.includeImages !== false;

  elements.downloadFilename.value = settings.downloads?.filenameTemplate || '{title}';

  elements.ytTimestamps.value = settings.youtube?.timestamps || 'obsidian';
  elements.ytFormat.value = settings.youtube?.format || 'auto';

  loadDomainSelectors();
}

// ─── Domain Selectors Management ────────────────────────────────────────────

async function loadDomainSelectors() {
  const data = await chrome.storage.local.get('domainSelectors');
  const selectors = data.domainSelectors || {};
  renderSelectorsList(selectors);
}

function renderSelectorsList(selectors) {
  const list = elements.selectorsList;
  list.innerHTML = '';

  const entries = Object.entries(selectors);
  if (entries.length === 0) {
    list.innerHTML = '<div class="selectors-empty">No domain selectors saved</div>';
    return;
  }

  for (const [domain, selector] of entries) {
    const item = document.createElement('div');
    item.className = 'selector-item';
    item.innerHTML = `
      <span class="selector-item-domain">${escapeHtml(domain)}</span>
      <span class="selector-item-value">${escapeHtml(selector)}</span>
      <button class="selector-item-delete" data-domain="${escapeHtml(domain)}">Delete</button>
    `;
    list.appendChild(item);
  }

  // Add delete handlers
  list.querySelectorAll('.selector-item-delete').forEach(btn => {
    btn.addEventListener('click', async () => {
      const domain = btn.dataset.domain;
      const data = await chrome.storage.local.get('domainSelectors');
      const sels = data.domainSelectors || {};
      delete sels[domain];
      await chrome.storage.local.set({ domainSelectors: sels });
      loadDomainSelectors();
    });
  });
}

async function addSelector() {
  const domain = elements.newSelectorDomain.value.trim();
  const selector = elements.newSelectorValue.value.trim();
  if (!domain || !selector) return;

  const data = await chrome.storage.local.get('domainSelectors');
  const selectors = data.domainSelectors || {};
  selectors[domain] = selector;
  await chrome.storage.local.set({ domainSelectors: selectors });

  elements.newSelectorDomain.value = '';
  elements.newSelectorValue.value = '';
  loadDomainSelectors();
}

async function exportSelectors() {
  const data = await chrome.storage.local.get('domainSelectors');
  const selectors = data.domainSelectors || {};
  const json = JSON.stringify(selectors, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);

  const a = document.createElement('a');
  a.href = url;
  a.download = 'mdyoink-selectors.json';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function importSelectors() {
  elements.importSelectorsFile.click();
}

async function handleImportFile(e) {
  const file = e.target.files[0];
  if (!file) return;

  try {
    const text = await file.text();
    const imported = JSON.parse(text);

    if (typeof imported !== 'object' || Array.isArray(imported)) {
      alert('Invalid format: expected a JSON object with domain → selector mappings');
      return;
    }

    const data = await chrome.storage.local.get('domainSelectors');
    const existing = data.domainSelectors || {};
    const merged = Object.assign(existing, imported);
    await chrome.storage.local.set({ domainSelectors: merged });
    loadDomainSelectors();
  } catch (err) {
    alert('Failed to import: ' + err.message);
  }

  // Reset file input
  elements.importSelectorsFile.value = '';
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

// ─── Event Listeners ────────────────────────────────────────────────────────

// Auto-save on any change
const changeElements = [
  'outputMode', 'llmStripLinks', 'llmStripImages', 'llmStripFrontMatter',
  'llmSourceLine', 'obsidianFrontMatter', 'tokenModel', 'tokenShow',
  'mdHeadingStyle', 'mdBulletMarker', 'mdCodeBlockStyle', 'mdLinkStyle',
  'mdIncludeImages', 'downloadFilename', 'ytTimestamps', 'ytFormat',
];

changeElements.forEach(id => {
  const el = elements[id];
  if (!el) return;
  const event = el.type === 'checkbox' ? 'change' : 'input';
  el.addEventListener(event, readSettingsFromUI);
});

// Domain selectors
elements.addSelectorBtn.addEventListener('click', addSelector);
elements.exportSelectorsBtn.addEventListener('click', exportSelectors);
elements.importSelectorsBtn.addEventListener('click', importSelectors);
elements.importSelectorsFile.addEventListener('change', handleImportFile);

// Enter key on selector inputs
elements.newSelectorDomain.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') elements.newSelectorValue.focus();
});
elements.newSelectorValue.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') addSelector();
});

// ─── Initialize ─────────────────────────────────────────────────────────────

loadSettings();
