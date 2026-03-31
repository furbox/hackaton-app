# Proposal: Scanner V2 - Dedicated Scanner Tab

## Intent

Move scanner from inline icon injection to a dedicated tab in the popup. Solves CSS conflicts, debounce lag, and page design interference issues from V1.

## Scope

### In Scope
- New "Scanner" tab next to "Guardar" and "Mis Links"
- Content script only reads/scans links (no UI injection)
- Real-time link updates via MutationObserver → messaging → popup
- List displays: title, URL preview, [+] button
- Click [+] opens "Guardar" tab with preloaded data
- Works on any HTTP/HTTPS page

### Out of Scope
- Icon injection in page
- CSS injection in page
- Background service worker changes (except messaging)

## Approach

1. **Content Script V2**: Remove icon/CSS injection. Only find links and send messages to background.
2. **Real-time Messaging**: Content script → background → popup via chrome.runtime.onMessage.
3. **Scanner Tab UI**: New popup tab showing detected links with [+] save button.
4. **Save Flow**: Click [+] saves URL to storage as `scannerPreloadedData` and switches to "Guardar" tab.

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `extension/popup/html/popup.html` | Modified | Add Scanner tab and content |
| `extension/popup/css/popup.css` | Modified | Scanner tab styles |
| `extension/popup/js/app.js` | Modified | Tab logic + Scanner tab |
| `extension/features/scanner/scanner.js` | Modified | Remove UI injection, scan only |
| `extension/background/service-worker.js` | Modified | Real-time link messages |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Performance with many tabs | Medium | Limit to 50 links like V1 |
| Messaging lag | Low | Direct chrome.runtime.sendMessage |
| Memory leaks in MutationObserver | Low | Proper disconnect on disable |

## Rollback Plan

1. Revert `scanner.js` to previous version with icon injection
2. Remove Scanner tab from popup
3. Restore toggle in settings panel

## Dependencies

None

## Success Criteria

- [ ] Scanner tab visible and functional in popup
- [ ] Content script does not inject CSS into page
- [ ] Links update in real-time when navigating
- [ ] Click [+] opens Guardar with preloaded data
- [ ] No CSS conflicts with external pages
