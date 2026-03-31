# Tasks: Scanner de Links - Chrome Extension

## Phase 1: Infrastructure (Foundation)

- [ ] 1.1 Create `extension/features/scanner/` directory structure (scanner.js, scanner.css, popup-handler.js)
  - Create empty feature module following Feature-First convention
  - Verify directory exists and is empty

- [ ] 1.2 Update `extension/manifest.json` - Add scripting permission (already present, verify)
  - Confirm `"scripting"` in permissions array (line 6)
  - No new permissions needed

- [ ] 1.3 Add message handlers in `extension/background/service-worker.js`
  - Add handlers for `enableScanner`, `disableScanner`, `linkClicked` actions
  - Implement `chrome.scripting.executeScript` calls for injection/removal
  - Add `chrome.storage.local` calls for preload data
  - Test: messages from popup/content script are logged

## Phase 2: Content Script (Core)

- [ ] 2.1 Implement `scanner.js` - Link finding algorithm
  - Query all `a[href]` elements with protocol validation (http/https only)
  - Filter out chrome://, edge://, about:, javascript:, mailto:
  - Skip links without href or empty href
  - Test: console.log shows correct link count on http/https pages

- [ ] 2.2 Implement `scanner.js` - Icon injection logic
  - Create 16x16px span element with class `url-scanner-icon`
  - Position absolute with z-index 9999, positioned near link
  - Append icon to DOM without modifying `<a>` element structure
  - Test: icons appear on all valid links without breaking layout

- [ ] 2.3 Implement `scanner.js` - Click handler & messaging
  - Add click listener to each icon
  - Extract { url, title } from parent `<a>` element
  - Send `linkClicked` message to background with extracted data
  - Test: clicking icon logs message to background console

- [ ] 2.4 Create `scanner.css` - Icon styles (default, hover, active)
  - Define `.url-scanner-icon` base styles (16x16px, #6366f1, rounded)
  - Add hover states (scale, opacity change)
  - Ensure high z-index (9999+) and visibility on all backgrounds
  - Test: icons are visible on light/dark pages

## Phase 3: Popup Integration (UI)

- [ ] 3.1 Add toggle UI in `extension/popup/html/popup.html`
  - Add scanner toggle switch below Backend URL in settings panel (after line 96)
  - Use `<label class="form-checkbox">` pattern matching existing checkboxes
  - Test: toggle appears in popup settings section

- [ ] 3.2 Create `extension/features/scanner/popup-handler.js`
  - Export `initScannerToggle()` function
  - Listen for toggle change events
  - Send `enableScanner` / `disableScanner` messages to background
  - Listen for `linkClicked` messages from background
  - Save preload data to `chrome.storage.local` with key `scanner_preload`
  - Test: toggle sends correct message on change

- [ ] 3.3 Update `extension/popup/js/app.js` - Initialize scanner feature
  - Import `initScannerToggle` from `../features/scanner/popup-handler.js`
  - Call `initScannerToggle()` during app initialization
  - Test: scanner toggle is initialized on popup load

- [ ] 3.4 Update `extension/popup/js/save-link.js` - Accept preloaded data
  - In `_init()` function, check `chrome.storage.local.get(['scanner_preload'])`
  - If preload exists, populate urlInput and titleInput
  - Clear `scanner_preload` from storage after consuming
  - Test: clicking icon then opening popup shows preloaded URL/title

## Phase 4: Performance & Edge Cases

- [x] 4.1 Implement `IntersectionObserver` for lazy loading (optional optimization)
  - Wrap icon injection in IntersectionObserver to only load visible icons
  - Unobserve icons after they enter viewport
  - Test: scroll triggers icon appearance on large pages (100+ links)

- [x] 4.2 Add protocol validation in `scanner.js`
  - Reject links with protocols: chrome://, edge://, about:, javascript:, mailto:, data:, file:
  - Accept only http:// and https://
  - Test: no icons appear on chrome://settings or edge://downloads

- [x] 4.3 Add cleanup logic for scanner deactivation
  - In `disableScanner` handler, remove all `.url-scanner-icon` elements
  - Remove all event listeners to prevent memory leaks
  - Test: toggle OFF removes all icons from page

- [x] 4.4 Handle SPA navigation with `MutationObserver` (optional)
  - Observe DOM changes for dynamically added `<a>` elements
  - Inject icons into new links when detected
  - Disconnect observer on disable
  - Test: infinite scroll pages show icons on new content

## Phase 5: Testing & Verification

- [ ] 5.1 Manual testing - Activation/deactivation flow
  - Toggle ON → icons appear on http/https pages
  - Toggle OFF → all icons disappear
  - No icons on chrome://, edge://, about:blank
  - Multiple ON/OFF cycles work without memory leaks

- [ ] 5.2 Manual testing - Click & preload flow
  - Click icon → popup opens with URL/title pre-filled
  - Form is editable (not auto-saved)
  - Can change category, description, public flag
  - Submit saves link successfully

- [ ] 5.3 Manual testing - Edge cases
  - Page with 100+ links → icons load without lag (< 500ms)
  - Page with no links → no errors, scanner state remains active
  - Links with empty href → no icon injected
  - Links inside shadow DOM → graceful skip (no errors)
  - Multiple rapid toggle clicks → no duplicate icons or crashes

## Summary

**Total Tasks**: 21 (5 phases)
**Estimated Time**: 4-6 hours (assuming familiarity with Chrome Extension API)
**Files Created**: 3 new files
**Files Modified**: 6 existing files
**Risk Level**: Low (feature toggle allows instant rollback)

### Implementation Order Recommendation

1. **Phase 1** must be completed first (foundation for all other work)
2. **Phase 2** can be done in parallel with **Phase 3** (content script and popup UI are independent)
3. **Phase 4** depends on **Phase 2** (optimization built on core injection logic)
4. **Phase 5** validates all previous work

### Critical Path

1.1 → 1.3 → 2.2 → 3.4 → 5.2 (minimum viable feature)

### Rollback Strategy

If any task fails, comment out the feature flag in `manifest.json` (1.2) or revert changes to `service-worker.js` (1.3).
