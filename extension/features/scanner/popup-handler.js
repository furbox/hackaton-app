/**
 * URLoft Scanner - Popup Handler
 *
 * Manages the scanner toggle UI in the popup and handles
 * communication between the popup and background service worker.
 */

import * as storage from '../../popup/js/storage.js';

const SCANNER_STORAGE_KEY = 'scannerEnabled';

/**
 * Initialize the scanner toggle in the popup.
 * Reads the stored state and sets up event listeners.
 *
 * @param {{ apiKey: string|null }} state - App state (not used directly but kept for consistency)
 */
export async function initScannerToggle(state) {
  const toggle = document.getElementById('scanner-toggle');
  const statusHint = document.getElementById('scanner-status');

  if (!toggle || !statusHint) {
    console.warn('[URLoft Scanner] Toggle UI elements not found');
    return;
  }

  // Load the stored state (default to OFF/false)
  const stored = await storage.get([SCANNER_STORAGE_KEY]);
  const isEnabled = stored[SCANNER_STORAGE_KEY] === true;

  // Set the initial toggle state
  toggle.checked = isEnabled;
  _updateStatusHint(isEnabled, statusHint);

  // Sync the actual scanner state with the toggle
  await _syncScannerState(isEnabled);

  // Listen for toggle changes
  toggle.addEventListener('change', async (event) => {
    const newState = event.target.checked;
    console.log('[URLoft Scanner] Toggle changed:', newState);

    // Save to storage
    await storage.set({ [SCANNER_STORAGE_KEY]: newState });

    // Update status hint
    _updateStatusHint(newState, statusHint);

    // Sync with background service worker
    await _syncScannerState(newState);
  });
}

/**
 * Update the status hint text based on scanner state.
 *
 * @param {boolean} isEnabled - Whether the scanner is enabled
 * @param {HTMLElement} statusHint - The status hint element
 */
function _updateStatusHint(isEnabled, statusHint) {
  if (isEnabled) {
    statusHint.textContent = 'Scanner activado - los links muestran iconos';
    statusHint.style.color = 'var(--color-success)';
  } else {
    statusHint.textContent = 'Activá para detectar links en la página';
    statusHint.style.color = 'var(--text-muted)';
  }
}

/**
 * Send a message to the background service worker to enable/disable the scanner.
 *
 * @param {boolean} isEnabled - Whether the scanner should be enabled
 */
async function _syncScannerState(isEnabled) {
  try {
    const action = isEnabled ? 'enableScanner' : 'disableScanner';

    await chrome.runtime.sendMessage({
      action,
      source: 'popup'
    });

    console.log('[URLoft Scanner] Sent message to background:', action);
  } catch (error) {
    console.error('[URLoft Scanner] Failed to send message to background:', error);
  }
}
