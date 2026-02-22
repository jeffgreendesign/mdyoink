// mdyoink element picker
// Injected on demand via chrome.scripting.executeScript
// Creates hover-to-highlight overlay, captures clicked element's HTML

(function () {
  'use strict';

  // Prevent double injection
  if (window.__mdyoink_picker_active) return;
  window.__mdyoink_picker_active = true;

  let currentTarget = null;

  // ─── DOM Elements (all inline-styled to avoid page CSS conflicts) ────────

  const overlay = document.createElement('div');
  overlay.id = '__mdyoink-picker-overlay';
  Object.assign(overlay.style, {
    position: 'fixed',
    pointerEvents: 'none',
    border: '2px solid #6366f1',
    backgroundColor: 'rgba(99, 102, 241, 0.08)',
    borderRadius: '4px',
    zIndex: '2147483647',
    transition: 'top 80ms ease-out, left 80ms ease-out, width 80ms ease-out, height 80ms ease-out',
    display: 'none',
  });
  document.documentElement.appendChild(overlay);

  const label = document.createElement('div');
  label.id = '__mdyoink-picker-label';
  Object.assign(label.style, {
    position: 'fixed',
    zIndex: '2147483647',
    background: '#6366f1',
    color: '#fff',
    padding: '2px 8px',
    borderRadius: '4px',
    fontSize: '11px',
    fontFamily: 'system-ui, -apple-system, sans-serif',
    pointerEvents: 'none',
    display: 'none',
    whiteSpace: 'nowrap',
    maxWidth: '300px',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  });
  document.documentElement.appendChild(label);

  const banner = document.createElement('div');
  banner.id = '__mdyoink-picker-banner';
  Object.assign(banner.style, {
    position: 'fixed',
    top: '0',
    left: '0',
    right: '0',
    zIndex: '2147483647',
    background: '#6366f1',
    color: '#fff',
    padding: '8px 16px',
    fontSize: '13px',
    fontFamily: 'system-ui, -apple-system, sans-serif',
    textAlign: 'center',
    boxShadow: '0 2px 8px rgba(0,0,0,0.2)',
  });
  banner.textContent = 'mdyoink: Click an element to extract. Press Esc to cancel.';
  document.documentElement.appendChild(banner);

  // ─── Helpers ─────────────────────────────────────────────────────────────

  function buildSelector(el) {
    if (!el) return '';
    if (el.id) return '#' + CSS.escape(el.id);
    var selector = el.tagName.toLowerCase();
    if (typeof el.className === 'string' && el.className.trim()) {
      var classes = el.className.trim().split(/\s+/).slice(0, 3);
      selector += classes.map(function (c) { return '.' + CSS.escape(c); }).join('');
    }
    return selector;
  }

  function isPickerElement(el) {
    if (!el || !el.id) return false;
    return el.id.startsWith('__mdyoink-picker');
  }

  function getTargetAt(x, y) {
    // Temporarily hide our elements to get the real target underneath
    overlay.style.display = 'none';
    label.style.display = 'none';
    var target = document.elementFromPoint(x, y);
    return target;
  }

  function updateOverlay(el) {
    if (!el || el === document.documentElement || el === document.body) {
      overlay.style.display = 'none';
      label.style.display = 'none';
      return;
    }

    var rect = el.getBoundingClientRect();
    overlay.style.display = 'block';
    overlay.style.top = rect.top + 'px';
    overlay.style.left = rect.left + 'px';
    overlay.style.width = rect.width + 'px';
    overlay.style.height = rect.height + 'px';

    var selectorStr = buildSelector(el);
    label.textContent = selectorStr;
    label.style.display = 'block';
    label.style.left = Math.max(0, rect.left) + 'px';
    if (rect.top > 30) {
      label.style.top = (rect.top - 24) + 'px';
    } else {
      label.style.top = (rect.bottom + 4) + 'px';
    }
  }

  // ─── Cleanup ─────────────────────────────────────────────────────────────

  function cleanup() {
    document.removeEventListener('mousemove', onMouseMove, true);
    document.removeEventListener('click', onClick, true);
    document.removeEventListener('keydown', onKeyDown, true);
    document.removeEventListener('contextmenu', onContextMenu, true);
    if (overlay.parentNode) overlay.remove();
    if (label.parentNode) label.remove();
    if (banner.parentNode) banner.remove();
    window.__mdyoink_picker_active = false;
  }

  // ─── Event Handlers ──────────────────────────────────────────────────────

  function onMouseMove(e) {
    var target = isPickerElement(e.target) ? getTargetAt(e.clientX, e.clientY) : e.target;
    currentTarget = target;
    updateOverlay(currentTarget);
  }

  function onClick(e) {
    e.preventDefault();
    e.stopPropagation();
    e.stopImmediatePropagation();

    var target = isPickerElement(e.target) ? getTargetAt(e.clientX, e.clientY) : e.target;
    if (!target || target === document.documentElement || target === document.body) return;

    var html = target.innerHTML;
    var selector = buildSelector(target);
    var tagName = target.tagName.toLowerCase();
    var textLength = (target.textContent || '').length;

    cleanup();

    chrome.runtime.sendMessage({
      action: 'pickerResult',
      html: html,
      selector: selector,
      tagName: tagName,
      textLength: textLength,
      title: document.title,
      url: window.location.href,
      domain: window.location.hostname,
    });
  }

  function onKeyDown(e) {
    if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      cleanup();
      chrome.runtime.sendMessage({ action: 'pickerCancelled' });
    }
  }

  function onContextMenu(e) {
    e.preventDefault();
    cleanup();
    chrome.runtime.sendMessage({ action: 'pickerCancelled' });
  }

  // ─── Attach Listeners (capture phase) ────────────────────────────────────

  document.addEventListener('mousemove', onMouseMove, true);
  document.addEventListener('click', onClick, true);
  document.addEventListener('keydown', onKeyDown, true);
  document.addEventListener('contextmenu', onContextMenu, true);
})();
