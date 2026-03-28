/**
 * Utility functions for the extension
 * @module utils
 */

/**
 * Validate API key format (urlk_ + at least 24 hex characters)
 * @param {string} key - API key to validate
 * @returns {boolean} True if format is valid
 */
export function isValidApiKeyFormat(key) {
  const pattern = /^urlk_[a-f0-9]{24,}$/;
  return pattern.test(key);
}

/**
 * Show a toast notification
 * @param {string} message - Message to display
 * @param {string} type - Toast type ('success' | 'error' | 'warning' | 'info')
 * @param {number} [duration=3000] - Duration in milliseconds
 */
export function showToast(message, type = 'info', duration = 3000) {
  const toast = document.getElementById('toast');
  if (!toast) return;

  toast.textContent = message;
  toast.className = `toast toast--${type}`;
  toast.hidden = false;

  setTimeout(() => {
    toast.hidden = true;
  }, duration);
}

/**
 * Extract metadata from active tab
 * @returns {Promise<Object|null>} Page metadata or null if unavailable
 */
export async function extractPageMetadata() {
  return new Promise((resolve) => {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0]) {
        const { url, title } = tabs[0];
        resolve({
          url,
          title: title || url,
          description: '',
        });
      } else {
        resolve(null);
      }
    });
  });
}

/**
 * Update badge counter
 * @param {number} count - Count to display
 */
export async function updateBadge(count) {
  const text = count > 0 ? count.toString() : '';
  chrome.action.setBadgeText({ text });
  chrome.action.setBadgeBackgroundColor({ color: '#6366f1' });
}

/**
 * Debounce function execution
 * @param {Function} func - Function to debounce
 * @param {number} wait - Wait time in milliseconds
 * @returns {Function} Debounced function
 */
export function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

/**
 * Escape HTML to prevent XSS
 * @param {string} str - String to escape
 * @returns {string} Escaped string
 */
export function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

/**
 * Format an ISO date string into a human-readable relative time.
 * Examples: "hace 5 minutos", "hace 3 horas", "hace 2 días"
 *
 * @param {string} isoString - ISO 8601 date string
 * @returns {string} Human-readable relative time
 */
export function formatDate(isoString) {
  if (!isoString) return '';
  const diff = Date.now() - new Date(isoString).getTime();
  const minutes = Math.floor(diff / 60_000);
  const hours   = Math.floor(diff / 3_600_000);
  const days    = Math.floor(diff / 86_400_000);

  if (minutes < 1)  return 'ahora';
  if (minutes < 60) return `hace ${minutes} min`;
  if (hours < 24)   return `hace ${hours}h`;
  if (days < 30)    return `hace ${days} día${days > 1 ? 's' : ''}`;
  const months = Math.floor(days / 30);
  return `hace ${months} mes${months > 1 ? 'es' : ''}`;
}

/**
 * Strip HTML tags from a string (basic sanitization).
 *
 * @param {string} str - Raw string potentially containing HTML
 * @returns {string} Plain text
 */
export function sanitizeText(str) {
  if (!str) return '';
  const div = document.createElement('div');
  div.innerHTML = str;
  return div.textContent || div.innerText || '';
}

/**
 * Generate a URL-safe slug from a URL's hostname + path.
 * Max 30 chars, only alphanumeric and hyphens.
 * Example: generateShortCode('https://bun.sh/docs') → 'bun-sh-docs'
 *
 * @param {string} url - Full URL
 * @returns {string} Slug string
 */
export function generateShortCode(url) {
  try {
    const parsed = new URL(url);
    const combined = (parsed.hostname + parsed.pathname)
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
    return combined.slice(0, 30);
  } catch {
    return '';
  }
}
