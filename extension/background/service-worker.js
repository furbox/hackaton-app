/**
 * URLoft Extension — Background Service Worker
 * Handles install init, badge updates, and storage change listeners.
 *
 * NOTE: This file uses chrome.storage directly (no import) because
 * service workers in MV3 support ES modules but chrome.storage is always available.
 */

// ── Constants ──────────────────────────────────────────────────────
const DEFAULT_STATS = {
  linksAddedToday: 0,
  lastResetDate: '',
};

// ── onInstalled ────────────────────────────────────────────────────
chrome.runtime.onInstalled.addListener(async () => {
  console.log('[URLoft] Extension installed/updated.');
  await _initStorage();
  await updateBadge();
});

// ── onStartup ─────────────────────────────────────────────────────
chrome.runtime.onStartup.addListener(async () => {
  await updateBadge();
});

// ── Storage change listener ────────────────────────────────────────
// Recalculate badge whenever apiKey or stats change
chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName === 'local' && (changes.apiKey || changes.stats)) {
    updateBadge();
  }
});

// ── Scanner Tab Cleanup ─────────────────────────────────────────────
chrome.tabs.onRemoved.addListener(async (tabId) => {
  const stored = await _getStorage(['scannerActiveTabs']);
  const activeTabs = stored.scannerActiveTabs || [];
  if (activeTabs.includes(tabId)) {
    const updated = activeTabs.filter(id => id !== tabId);
    await _setStorage({ scannerActiveTabs: updated });
    console.log('[URLoft] Scanner tab closed, removed from tracking:', tabId);
  }
});

// ── Scanner Handlers ────────────────────────────────────────────────
/**
 * Enable the scanner feature on the active tab.
 * Injects content scripts, tracks the active tab, and starts the scanner UI.
 */
async function _handleEnableScanner(sendResponse) {
  try {
    // Get the active tab in the current window
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

    if (!tab?.id) {
      sendResponse({ ok: false, error: 'No active tab found' });
      return;
    }

    // Cannot inject into restricted pages (chrome://, about:, etc.)
    if (tab.url && (tab.url.startsWith('chrome://') || tab.url.startsWith('about:'))) {
      sendResponse({ ok: false, error: 'Cannot run scanner on this page' });
      return;
    }

    // Inject content script and styles
    try {
      // Inject JavaScript
      await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        files: ['features/scanner/scanner.js']
      });

      // Inject CSS (MUST use insertCSS, not executeScript)
      const cssUrl = chrome.runtime.getURL('features/scanner/scanner.css');
      const cssResponse = await fetch(cssUrl);
      const cssText = await cssResponse.text();
      await chrome.scripting.insertCSS({
        target: { tabId: tab.id },
        css: cssText
      });
    } catch (injectError) {
      console.error('[URLoft] Failed to inject scanner:', injectError);
      sendResponse({ ok: false, error: injectError.message });
      return;
    }

    // Track this tab as having scanner active
    const stored = await _getStorage(['scannerActiveTabs']);
    const activeTabs = stored.scannerActiveTabs || [];
    if (!activeTabs.includes(tab.id)) {
      activeTabs.push(tab.id);
      await _setStorage({ scannerActiveTabs: activeTabs });
    }

    // Send message to content script to start scanner UI
    try {
      await chrome.tabs.sendMessage(tab.id, { action: 'startScanner' });
    } catch (msgError) {
      // Content script might not be ready yet, give it a moment
      await new Promise(resolve => setTimeout(resolve, 100));
      try {
        await chrome.tabs.sendMessage(tab.id, { action: 'startScanner' });
      } catch {
        console.warn('[URLoft] Scanner injected but content script not ready');
      }
    }

    sendResponse({ ok: true, tabId: tab.id });
  } catch (error) {
    console.error('[URLoft] Error enabling scanner:', error);
    sendResponse({ ok: false, error: error.message });
  }
}

/**
 * Disable the scanner feature on the active tab.
 * Stops the scanner UI and removes tab from tracking.
 */
async function _handleDisableScanner(sendResponse) {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

    if (!tab?.id) {
      sendResponse({ ok: false, error: 'No active tab found' });
      return;
    }

    // Remove from active tabs tracking
    const stored = await _getStorage(['scannerActiveTabs']);
    const activeTabs = (stored.scannerActiveTabs || []).filter(id => id !== tab.id);
    await _setStorage({ scannerActiveTabs: activeTabs });

    // Send stop message to content script (ignore if tab already closed)
    try {
      await chrome.tabs.sendMessage(tab.id, { action: 'stopScanner' });
    } catch (msgError) {
      // Tab might be closed or content script gone - that's fine
      console.debug('[URLoft] Content script not reachable for stop:', msgError.message);
    }

    sendResponse({ ok: true });
  } catch (error) {
    console.error('[URLoft] Error disabling scanner:', error);
    sendResponse({ ok: false, error: error.message });
  }
}

/**
 * Handle a link clicked in the scanner overlay.
 * Saves the URL/title to storage and opens the extension popup.
 */
async function _handleLinkClicked(message, sendResponse) {
  try {
    const { url, title } = message.data || {};

    if (!url) {
      sendResponse({ ok: false, error: 'Missing URL in message data' });
      return;
    }

    // Save preloaded data for the popup to use
    await _setStorage({
      scannerPreloadedData: { url, title: title || url }
    });

    // Open the extension popup
    try {
      await chrome.action.openPopup();
    } catch (popupError) {
      // Popup might not be available (user has it pinned, etc.)
      console.warn('[URLoft] Could not open popup:', popupError.message);
      // Still return ok since data is saved
    }

    sendResponse({ ok: true });
  } catch (error) {
    console.error('[URLoft] Error handling link click:', error);
    sendResponse({ ok: false, error: error.message });
  }
}

// ── Message listener ───────────────────────────────────────────────
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.type === 'UPDATE_BADGE') {
    updateBadge().then(() => sendResponse({ ok: true }));
    return true; // keep port open for async response
  }

  // Scanner feature handlers (Phase 1-3)
  if (message.action === 'enableScanner') {
    _handleEnableScanner(sendResponse);
    return true; // async response
  }

  if (message.action === 'disableScanner') {
    _handleDisableScanner(sendResponse);
    return true; // async response
  }

  if (message.action === 'linkClicked') {
    _handleLinkClicked(message, sendResponse);
    return true; // async response
  }
});

// ── updateBadge ────────────────────────────────────────────────────
/**
 * Recalculate and set the extension icon badge.
 *
 * - No apiKey   → red icon + "!" badge
 * - Day changed → reset counter, clear badge
 * - count > 0  → purple badge with number
 * - count == 0 → clear badge
 */
async function updateBadge() {
  const stored = await _getStorage(['apiKey', 'stats']);
  const apiKey = stored.apiKey || null;
  const stats  = stored.stats  || { ...DEFAULT_STATS };

  if (!apiKey) {
    // Not authenticated — show error badge
    try {
      chrome.action.setIcon({ path: '../icons/icon-error-128.png' });
    } catch { /* icon path might not exist yet */ }
    chrome.action.setBadgeText({ text: '!' });
    chrome.action.setBadgeBackgroundColor({ color: '#ef4444' });
    return;
  }

  // Reset counter if it's a new day
  const today = _today();
  if (stats.lastResetDate !== today) {
    const resetStats = { linksAddedToday: 0, lastResetDate: today };
    await _setStorage({ stats: resetStats });
    // Clear badge
    try {
      chrome.action.setIcon({ path: '../icons/icon-128.png' });
    } catch { /* ignore */ }
    chrome.action.setBadgeText({ text: '' });
    return;
  }

  // Show count badge
  try {
    chrome.action.setIcon({ path: '../icons/icon-128.png' });
  } catch { /* ignore */ }

  const count = stats.linksAddedToday || 0;
  if (count > 0) {
    chrome.action.setBadgeText({ text: String(count) });
    chrome.action.setBadgeBackgroundColor({ color: '#6366f1' });
  } else {
    chrome.action.setBadgeText({ text: '' });
  }
}

// ── Storage helpers ────────────────────────────────────────────────
function _getStorage(keys) {
  return new Promise(resolve => {
    chrome.storage.local.get(keys, result => resolve(result));
  });
}

function _setStorage(data) {
  return new Promise(resolve => {
    chrome.storage.local.set(data, () => resolve());
  });
}

async function _initStorage() {
  const current = await _getStorage(['apiKey', 'userEmail', 'lastValidated', 'stats']);
  const toSet = {};

  if (current.stats === undefined) {
    toSet.stats = { ...DEFAULT_STATS };
  }
  if (current.apiKey === undefined)       toSet.apiKey = null;
  if (current.userEmail === undefined)    toSet.userEmail = null;
  if (current.lastValidated === undefined) toSet.lastValidated = null;

  if (Object.keys(toSet).length > 0) {
    await _setStorage(toSet);
  }
}

function _today() {
  return new Date().toISOString().split('T')[0];
}

// Run badge update on service worker activation
updateBadge();
