/**
 * URLoft Extension — main app entry point.
 * Handles view routing, tab switching, logout and global 401 interception.
 * @module app
 */

import * as storage from './storage.js';
import { initAuth } from './auth.js';
import { initSaveLink } from './save-link.js';
import { initSearch } from './search.js';
import { initScannerTab, updateScannedLinks } from '../../features/scanner-tab/scanner-tab.js';
import { showToast } from './utils.js';
import { getCategories } from './api.js';

// ── Global app state ───────────────────────────────────────────────
export const state = {
  apiKey: null,
  userEmail: null,
  currentTab: 'save',
  scannedLinks: [],
};

/**
 * Set to true while the user is actively going through the auth flow
 * (i.e. logging in with email/password). During this window, 401 responses
 * from concurrent/stale requests must NOT trigger the "session expired"
 * banner — those errors belong to auth.js, not to the global handler.
 */
export let isAuthenticating = false;

// ── Global 401 event ───────────────────────────────────────────────
/**
 * Dispatch this event from any module when a 401 is received.
 * app.js listens and resets to auth view.
 */
export function emitUnauthorized(message) {
  window.dispatchEvent(new CustomEvent('urloft:unauthorized', { detail: { message } }));
}

// ── Init ───────────────────────────────────────────────────────────
async function init() {
  // Show loading while we check storage
  showView('loading-view');

  try {
    const stored = await storage.get(['apiKey', 'userEmail', 'userId']);
    state.apiKey    = stored.apiKey    || null;
    state.userEmail = stored.userEmail || null;
    state.userId    = stored.userId    || null;

    if (state.apiKey) {
      // Validate the stored session token is still active before showing the app.
      // We probe GET /api/categories — a lightweight authenticated endpoint.
      // This catches expired/revoked tokens without waiting for the user to act.
      try {
        await getCategories(state.apiKey);
        showAppView();
      } catch (err) {
        if (err.code === 'UNAUTHORIZED' || err.status === 401) {
          await _clearSession();
          showAuthView('Sesión expirada. Volvé a iniciar sesión.');
        } else {
          // Network error or server down — show app anyway, let it fail gracefully
          showAppView();
        }
      }
    } else {
      showAuthView();
    }
  } catch (err) {
    console.error('[URLoft] init error:', err);
    showAuthView();
  }
}

// ── View helpers ───────────────────────────────────────────────────
function showView(viewId) {
  document.querySelectorAll('.view').forEach(v => v.classList.add('hidden'));
  const el = document.getElementById(viewId);
  if (el) el.classList.remove('hidden');
}

function showAuthView(expiredMsg = null) {
  showView('auth-view');

  if (expiredMsg) {
    const errorDiv = document.getElementById('auth-error');
    if (errorDiv) {
      errorDiv.textContent = expiredMsg;
      errorDiv.hidden = false;
    }
  }

  // Guard: any 401s fired while the user is typing/submitting a new key
  // must NOT override this view with "Sesión expirada".
  isAuthenticating = true;

  initAuth(
    (data) => {
      isAuthenticating = false;
      state.apiKey    = data.apiKey;
      state.userEmail = data.userEmail || null;
      state.userId    = data.userId || null;
      showAppView();
    },
    () => {
      // Auth failed — reset the guard so future 401s (from a real expired
      // session later) are handled normally by the global listener.
      isAuthenticating = false;
    }
  );
}

function showAppView() {
  showView('app-view');

  // Update header email
  const emailEl = document.getElementById('user-email');
  if (emailEl) {
    emailEl.textContent = state.userEmail || '';
  }

  // Initialize tabs
  _initTabs();

  // Initialize runtime settings
  _initApiBaseUrlSettings();

  // Initialize website button
  _bindWebsiteButton();

  // Initialize the active tab content
  _activateTab(state.currentTab);
}

// ── Tab management ─────────────────────────────────────────────────
function _initTabs() {
  const navTabs = document.querySelectorAll('.nav-tab');
  navTabs.forEach(btn => {
    // Remove any old listeners by replacing with a fresh clone
    const fresh = btn.cloneNode(true);
    btn.parentNode.replaceChild(fresh, btn);
    fresh.addEventListener('click', () => {
      const tab = fresh.dataset.tab;
      _activateTab(tab);
    });
  });
}

function _activateTab(tabName) {
  state.currentTab = tabName;

  // Update nav buttons
  document.querySelectorAll('.nav-tab').forEach(btn => {
    const isActive = btn.dataset.tab === tabName;
    btn.classList.toggle('nav-tab--active', isActive);
    btn.setAttribute('aria-selected', isActive ? 'true' : 'false');
  });

  // Update tab panels
  document.querySelectorAll('.tab-content').forEach(panel => {
    panel.classList.add('hidden');
  });
  const target = document.getElementById(`${tabName}-tab`);
  if (target) target.classList.remove('hidden');

  // Initialize the tab's module
  if (tabName === 'save') {
    // Check for preloaded data from scanner
    storage.get(['scannerPreloadedData']).then((data) => {
      const preloaded = data.scannerPreloadedData || null;
      initSaveLink(state, preloaded);

      // Clear the preloaded data after using it
      if (preloaded) {
        storage.set({ scannerPreloadedData: null });
      }
    });
  } else if (tabName === 'search') {
    initSearch(state);
  } else if (tabName === 'scanner') {
    initScannerTab(state);
  }
}

// ── Logout ─────────────────────────────────────────────────────────
function _bindLogout() {
  const btn = document.getElementById('logout-btn');
  if (!btn) return;

  btn.addEventListener('click', async () => {
    if (!confirm('¿Cerrar sesión?')) return;
    await _clearSession();
    showAuthView();
  });
}

// ── Website button ───────────────────────────────────────────────────
function _bindWebsiteButton() {
  const btn = document.getElementById('website-btn');
  if (!btn) return;

  btn.addEventListener('click', async () => {
    if (typeof chrome !== 'undefined' && chrome.tabs) {
      // Open in new tab
      await chrome.tabs.create({ url: 'https://urloft.site' });
      // Close the popup
      window.close();
    } else {
      // Fallback for testing
      window.open('https://urloft.site', '_blank');
    }
  });
}

async function _clearSession() {
  await storage.clear();
  state.apiKey    = null;
  state.userEmail = null;
}

// ── API URL settings ───────────────────────────────────────────────
function _normalizeApiBaseUrl(value) {
  const trimmed = (value || '').trim();
  if (!trimmed) return null;

  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return null;
    }

    return trimmed.replace(/\/+$/, '');
  } catch {
    return null;
  }
}

function _setApiUrlStatus(message, type = 'success') {
  const status = document.getElementById('api-url-status');
  if (!status) return;

  status.textContent = message;
  status.className = `settings-status settings-status--${type}`;
  status.hidden = false;
}

function _bindFreshClick(el, handler) {
  if (!el || !el.parentNode) return el;
  const fresh = el.cloneNode(true);
  el.parentNode.replaceChild(fresh, el);
  fresh.addEventListener('click', handler);
  return fresh;
}

async function _initApiBaseUrlSettings() {
  const input = document.getElementById('api-base-url-input');
  const saveBtn = document.getElementById('save-api-url-btn');
  const resetBtn = document.getElementById('reset-api-url-btn');

  if (!input || !saveBtn || !resetBtn) return;

  const currentBaseUrl = await storage.getApiBaseUrl();
  input.value = currentBaseUrl;

  _setApiUrlStatus(`Backend actual: ${currentBaseUrl}`);

  _bindFreshClick(saveBtn, async () => {
    const normalized = _normalizeApiBaseUrl(input.value);

    if (!normalized) {
      _setApiUrlStatus('URL inválida. Usá una URL absoluta con http:// o https://', 'error');
      showToast('URL inválida de backend', 'error');
      return;
    }

    await storage.set({ apiBaseUrl: normalized });
    input.value = normalized;
    _setApiUrlStatus('Backend URL guardada correctamente.', 'success');
    showToast('Backend URL actualizada', 'success');
  });

  _bindFreshClick(resetBtn, async () => {
    await storage.set({ apiBaseUrl: storage.DEFAULT_API_BASE_URL });
    input.value = storage.DEFAULT_API_BASE_URL;
    _setApiUrlStatus('Backend URL restablecida al valor por defecto.', 'success');
    showToast('Backend URL reseteada', 'info');
  });
}

// ── Global 401 listener ────────────────────────────────────────────
window.addEventListener('urloft:unauthorized', async (e) => {
  // Ignore 401s that arrive while the user is actively authenticating.
  // Those errors are already handled by auth.js (shows "Email o contraseña incorrectos.").
  // Letting them through would overwrite that message with "Sesión expirada".
  if (isAuthenticating) return;

  await _clearSession();
  showAuthView(e.detail?.message || 'Tu sesión expiró. Volvé a iniciar sesión.');
  showToast('Sesión expirada. Volvé a conectarte.', 'warning');
});

// ── Scanner Messaging ──────────────────────────────────────────────
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'linksFound' || message.action === 'newLinks') {
    const incomingLinks = message.data?.links || [];
    
    if (message.action === 'linksFound') {
      // Full reset for initial scan
      state.scannedLinks = incomingLinks;
    } else {
      // Append only unique links for updates
      const existingUrls = new Set(state.scannedLinks.map(l => l.url));
      const uniqueNewLinks = incomingLinks.filter(l => !existingUrls.has(l.url));
      if (uniqueNewLinks.length > 0) {
        state.scannedLinks = [...state.scannedLinks, ...uniqueNewLinks];
      }
    }
    
    // Update the Scanner tab UI if it's currently loaded
    updateScannedLinks();
    
    if (sendResponse) sendResponse({ success: true });
  }
  return true;
});

// ── Start ──────────────────────────────────────────────────────────
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    _bindLogout();
    init();
  });
} else {
  _bindLogout();
  init();
}
