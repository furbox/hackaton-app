/**
 * Scanner Tab module — handles the "Scanner" tab.
 * Shows list of links found by the scanner on the current page.
 * @module scanner-tab
 */

import { showToast } from '../../popup/js/utils.js';
import * as storage from '../../popup/js/storage.js';

// Module-level state
let _state = null;
let _initialized = false;

/**
 * Initialize the scanner tab.
 * Safe to call on every tab activation — re-renders based on current state.
 *
 * @param {{ apiKey: string|null, scannedLinks: Array }} state
 */
export function initScannerTab(state) {
  _state = state;
  _setup();
  _renderLinks();
  _triggerScanner();
}

/**
 * Update the scanned links display if the scanner tab is currently visible.
 */
export function updateScannedLinks() {
  // Only re-render if we have state and the tab is potentially visible
  // We check for the presence of the scanner list element and if its parent (tab) is not hidden
  const tab = document.getElementById('scanner-tab');
  if (_state && tab && !tab.classList.contains('hidden')) {
    _renderLinks();
  }
}

function _setup() {
  if (_initialized) return;
  _initialized = true;

  // We don't add listeners here anymore because app.js handles the global messaging
  // This keeps scanned links persistent while the popup is open, even if switching tabs.
}

async function _triggerScanner() {
  try {
    // Notify background to enable scanner on the current active tab
    await chrome.runtime.sendMessage({ action: 'enableScanner' });
  } catch (error) {
    console.error('[Scanner Tab] Failed to trigger scanner:', error);
  }
}

function _renderLinks() {
  const listEl = document.getElementById('scanner-list');
  const emptyEl = document.getElementById('scanner-empty');
  const countEl = document.getElementById('scanner-count');

  if (!listEl || !emptyEl || !countEl) return;

  const links = _state.scannedLinks || [];

  // Update count
  countEl.textContent = `${links.length} ${links.length === 1 ? 'link' : 'links'}`;

  // Show/hide empty state
  if (links.length === 0) {
    emptyEl.classList.remove('hidden');
    listEl.innerHTML = '';
    return;
  }

  emptyEl.classList.add('hidden');
  listEl.innerHTML = '';

  // Render each link
  links.forEach((link) => {
    const item = _createLinkItem(link);
    listEl.appendChild(item);
  });
}

function _createLinkItem(link) {
  const item = document.createElement('div');
  item.className = 'scanner-item';

  const title = document.createElement('div');
  title.className = 'scanner-item__title';
  title.textContent = link.title || 'Untitled';
  title.title = link.title || 'Untitled'; // Tooltip

  const url = document.createElement('div');
  url.className = 'scanner-item__url';
  
  // Requirement: truncated URL (max 40 chars)
  const displayUrl = link.url.length > 40 ? link.url.substring(0, 37) + '...' : link.url;
  url.textContent = displayUrl;
  url.title = link.url; // Tooltip

  const addButton = document.createElement('button');
  addButton.className = 'scanner-item__add';
  addButton.textContent = '+';
  addButton.title = 'Guardar este link';
  addButton.addEventListener('click', () => _handleAddLink(link));

  item.appendChild(title);
  item.appendChild(url);
  item.appendChild(addButton);

  return item;
}

/**
 * Handles the [+] button click.
 * Preloads the link data and switches to the "Guardar" tab.
 */
async function _handleAddLink(link) {
  try {
    // Store selected link data for the Guardar tab to pick up
    await storage.set({
      scannerPreloadedData: {
        url: link.url,
        title: link.title || 'Untitled'
      }
    });

    // Programmatically switch to the "Guardar" tab by triggering a click on its nav button
    const saveTabButton = document.querySelector('.nav-tab[data-tab="save"]');
    if (saveTabButton) {
      saveTabButton.click();
    } else {
      console.error('[Scanner Tab] Save tab button not found');
      showToast('No se pudo cambiar a la pestaña de guardado', 'error');
    }
  } catch (error) {
    console.error('[Scanner Tab] Failed to preload link:', error);
    showToast('Error al preparar el link', 'error');
  }
}
