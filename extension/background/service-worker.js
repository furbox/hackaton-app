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

// ── Message listener ───────────────────────────────────────────────
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.type === 'UPDATE_BADGE') {
    updateBadge().then(() => sendResponse({ ok: true }));
    return true; // keep port open for async response
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
      chrome.action.setIcon({ path: { 128: 'icons/icon-error-128.png' } });
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
      chrome.action.setIcon({ path: { 128: 'icons/icon-128.png' } });
    } catch { /* ignore */ }
    chrome.action.setBadgeText({ text: '' });
    return;
  }

  // Show count badge
  try {
    chrome.action.setIcon({ path: { 128: 'icons/icon-128.png' } });
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
