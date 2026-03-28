/**
 * Storage module for managing chrome.storage.local
 * @module storage
 */

/**
 * Default storage structure
 * @constant {Object}
 */
export const DEFAULT_API_BASE_URL = 'http://localhost:3000';

const DEFAULT_STORAGE = {
  apiKey: null,
  apiBaseUrl: DEFAULT_API_BASE_URL,
  userEmail: null,
  lastValidated: null,
  stats: {
    linksAddedToday: 0,
    lastResetDate: '',
  },
};

/**
 * Get values from chrome.storage.local
 * @param {string|string[]} keys - Keys to retrieve
 * @returns {Promise<Object>} Storage data
 */
export async function get(keys) {
  return new Promise((resolve) => {
    chrome.storage.local.get(keys, (result) => {
      resolve(result);
    });
  });
}

/**
 * Set values in chrome.storage.local
 * @param {Object} data - Data to store
 * @returns {Promise<void>}
 */
export async function set(data) {
  return new Promise((resolve) => {
    chrome.storage.local.set(data, () => {
      resolve();
    });
  });
}

/**
 * Clear all data from chrome.storage.local
 * @returns {Promise<void>}
 */
export async function clear() {
  return new Promise((resolve) => {
    chrome.storage.local.clear(() => {
      resolve();
    });
  });
}

/**
 * Initialize storage with default values if not present
 * @returns {Promise<void>}
 */
export async function init() {
  const current = await get(Object.keys(DEFAULT_STORAGE));
  const toSet = {};

  for (const [key, value] of Object.entries(DEFAULT_STORAGE)) {
    if (current[key] === undefined) {
      toSet[key] = value;
    }
  }

  if (Object.keys(toSet).length > 0) {
    await set(toSet);
  }
}

/**
 * Get normalized backend base URL from storage (or fallback default).
 * @returns {Promise<string>}
 */
export async function getApiBaseUrl() {
  const stored = await get(['apiBaseUrl']);
  const candidate = typeof stored.apiBaseUrl === 'string' ? stored.apiBaseUrl.trim() : '';

  if (!candidate) {
    return DEFAULT_API_BASE_URL;
  }

  try {
    const parsed = new URL(candidate);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return DEFAULT_API_BASE_URL;
    }

    return candidate.replace(/\/+$/, '') || DEFAULT_API_BASE_URL;
  } catch {
    return DEFAULT_API_BASE_URL;
  }
}
