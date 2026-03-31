/**
 * URLoft Scanner - Content Script (Scanner V2)
 *
 * Scans for <a> elements on the page and sends them to the popup/background.
 * No UI elements are injected into the page.
 */

console.log('[URLoft Scanner] Content script V2 loaded');

/**
 * GUARD: Prevent multiple injections and listeners
 * This ensures the state (allKnownLinks) persists for the page session
 * even if the popup is closed and reopened (which triggers re-injection).
 */
if (typeof window.urloftScannerInjected === 'undefined') {
  window.urloftScannerInjected = true;

  // =============================================================================
  // STATE
  // =============================================================================

  let isScannerActive = false;
  let mutationObserver = null;
  let mutationDebounceTimer = null;
  const allKnownLinks = []; // Store all unique links found in this session
  const allKnownUrls = new Set(); // Fast lookup for uniqueness
  const MAX_LINKS = 10000; // Large limit as per instructions
  const MUTATION_DEBOUNCE_MS = 500; // ms to debounce DOM changes

  // =============================================================================
  // LINK FINDING ALGORITHM
  // =============================================================================

  /**
   * Check if a URL has a valid HTTP/HTTPS protocol
   */
  function isValidHttpUrl(url) {
    try {
      const parsed = new URL(url);
      return parsed.protocol === 'http:' || parsed.protocol === 'https:';
    } catch {
      return false;
    }
  }

  /**
   * Find all valid links on the page that haven't been discovered yet
   * Updates the global state (allKnownLinks, allKnownUrls)
   * Returns ONLY the newly discovered link objects for messaging
   */
  function findLinks() {
    const newLinks = [];
    const linkElements = document.querySelectorAll('a[href]');
    const seenInThisPass = new Set(); // To avoid duplicates in the same DOM pass

    for (const link of linkElements) {
      // Safety limit to avoid browser hangs on extremely dense pages
      if (allKnownUrls.size >= MAX_LINKS) break;

      const url = link.href;
      
      // Skip if:
      // 1. Not http/https
      // 2. Already seen in this pass (duplicated on page)
      // 3. Already known from previous scans in this session
      if (!isValidHttpUrl(url) || seenInThisPass.has(url) || allKnownUrls.has(url)) continue;

      const title = link.textContent.trim() || link.title || link.getAttribute('aria-label') || 'Untitled';
      const linkObj = { url, title };
      
      newLinks.push(linkObj);
      seenInThisPass.add(url);
      
      // Track globally for this page session
      allKnownUrls.add(url);
      allKnownLinks.push(linkObj);
    }

    if (newLinks.length > 0) {
      console.log(`[URLoft Scanner] Discovered ${newLinks.length} new valid links (Total: ${allKnownLinks.length})`);
    }
    return newLinks;
  }

  // =============================================================================
  // MESSAGING
  // =============================================================================

  /**
   * Send found links to the popup/background
   */
  function sendLinks(links, type = 'linksFound') {
    if (links.length === 0) return;

    chrome.runtime.sendMessage({
      action: type,
      data: { links }
    }).catch((error) => {
      // This is common if the popup is closed
      console.debug('[URLoft Scanner] Failed to send links (port closed):', error.message);
    });
  }

  // =============================================================================
  // OBSERVERS
  // =============================================================================

  /**
   * Setup MutationObserver for infinite scroll/dynamic content
   */
  function setupMutationObserver() {
    if (mutationObserver) mutationObserver.disconnect();

    mutationObserver = new MutationObserver((mutations) => {
      if (mutationDebounceTimer) clearTimeout(mutationDebounceTimer);

      mutationDebounceTimer = setTimeout(() => {
        // Check if any mutations added new anchor elements
        const hasAddedNodes = mutations.some(mutation => {
          return Array.from(mutation.addedNodes).some(node => {
            if (node.nodeType === Node.ELEMENT_NODE) {
              return node.tagName === 'A' || node.querySelectorAll?.('a[href]').length > 0;
            }
            return false;
          });
        });

        if (hasAddedNodes) {
          // Only call findLinks() if we suspect there are new anchor elements
          const newLinks = findLinks();
          if (newLinks.length > 0) {
            sendLinks(newLinks, 'newLinks');
          }
        }
      }, MUTATION_DEBOUNCE_MS);
    });

    mutationObserver.observe(document.body, {
      childList: true,
      subtree: true
    });
  }

  // =============================================================================
  // MAIN FUNCTIONS
  // =============================================================================

  function startScanner() {
    if (!isScannerActive) {
      console.log('[URLoft Scanner] Starting scanner...');
      isScannerActive = true;
      setupMutationObserver();
    }

    // Perform a scan to pick up any new links since the last scan
    findLinks();

    // Send the FULL list of known links to the popup (repopulates state if reopened)
    sendLinks(allKnownLinks, 'linksFound');
  }

  function stopScanner() {
    if (!isScannerActive) return;

    console.log('[URLoft Scanner] Stopping scanner...');
    isScannerActive = false;

    if (mutationObserver) {
      mutationObserver.disconnect();
      mutationObserver = null;
    }

    if (mutationDebounceTimer) {
      clearTimeout(mutationDebounceTimer);
      mutationDebounceTimer = null;
    }
  }

  // =============================================================================
  // MESSAGE LISTENER
  // =============================================================================

  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    switch (message.action) {
      case 'startScanner':
        startScanner();
        sendResponse({ success: true, active: true });
        break;

      case 'stopScanner':
        stopScanner();
        sendResponse({ success: true, active: false });
        break;

      case 'getScannerStatus':
        sendResponse({ success: true, active: isScannerActive });
        break;

      default:
        sendResponse({ success: false, error: 'Unknown action' });
    }
    return true;
  });

  console.log('[URLoft Scanner] Content script ready');
} else {
  console.log('[URLoft Scanner] Content script already active for this tab');
}

