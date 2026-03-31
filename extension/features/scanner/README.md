# URLoft Scanner Feature

## Overview

Content script that injects clickable icons next to links on web pages, allowing users to quickly save links to URLoft without leaving the current page.

## Architecture

```
[Popup Toggle] → [Background SW] → [Content Script]
     ↓              ↓                    ↓
  User Action   executeScript()     Inject Icons
     ↓              ↓                    ↓
[Icon Click] ← chrome.storage.local ← Extract Link Data
     ↓
[Popup Opens] → Pre-filled URL/Title
```

## Files

- **scanner.js** - Content script that finds links and injects icons
- **scanner.css** - Styles for scanner icons (16x16px, z-index 9999)
- **popup-handler.js** - Toggle UI logic and message handling in popup

## Current Status

**Phase 1 (Infrastructure)** ✅ COMPLETE
- Directory structure created
- Placeholder files implemented
- Manifest permissions verified

## Next Phases

- **Phase 2**: Implement content script (link finding, icon injection, click handling)
- **Phase 3**: Add popup UI and integration
- **Phase 4**: Performance optimization (IntersectionObserver)
- **Phase 5**: Testing and verification

## Usage

1. Open popup
2. Enable "Scanner" toggle
3. Icons appear next to all links on the page
4. Click an icon to save the link
5. Popup opens with URL/title pre-filled

## Technical Details

- **Injection Strategy**: `chrome.scripting.executeScript` (on-demand, not auto-load)
- **Icon Positioning**: `position: absolute` to avoid breaking page layouts
- **Data Passing**: `chrome.storage.local` with temporary `scanner_preload` key
- **Performance**: `IntersectionObserver` for lazy loading on pages with 100+ links

## Rollback

To disable the feature without reinstalling:

1. Comment out `content_scripts` in `extension/manifest.json`
2. Or remove the feature directory: `rm -rf extension/features/scanner`

---

**Phase 1 Complete** - Infrastructure foundation ready for implementation.
