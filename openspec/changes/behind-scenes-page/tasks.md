# Tasks: Behind the Scenes Page

## Phase 1: Data Layer (Foundation)

- [ ] 1.1 Create `frontend-bun-ejs/public/videos.json` with example data structure (hero, featured: null, videos[ ])
- [ ] 1.2 Add 2-3 example YouTube video objects with id, title, description, duration fields
- [ ] 1.3 Validate JSON format using JSON schema from design document

## Phase 2: Controller Layer

- [ ] 2.1 Create `frontend-bun-ejs/src/controllers/behind-scenes.controller.ts`
- [ ] 2.2 Import `renderPage`, `getSession` (from renderer.ts, middleware/session.ts)
- [ ] 2.3 Import `getFlash` (from utils/flash.ts)
- [ ] 2.4 Export `behindScenesController` async function accepting `Request` parameter
- [ ] 2.5 Get session user via `await getSession(request)`
- [ ] 2.6 Get flash messages via `getFlash(request)`
- [ ] 2.7 Return `renderPage("behind-scenes", { user, flash })` with data object

## Phase 3: View Layer (Template)

- [ ] 3.1 Create `frontend-bun-ejs/views/pages/behind-scenes.ejs` template
- [ ] 3.2 Add Alpine.js `x-data` component with reactive state (hero, featured, videos, loading, error, selectedVideo)
- [ ] 3.3 Implement `async init()` method to fetch `/public/videos.json` with try/catch
- [ ] 3.4 Add loading state UI with spinner (x-show="loading")
- [ ] 3.5 Add error state UI with retry button (x-show="error")
- [ ] 3.6 Build hero section displaying hero.title and hero.description
- [ ] 3.7 Build featured video section (x-show="hasFeatured") with 16:9 iframe
- [ ] 3.8 Build video grid with `grid-cols-1 sm:grid-cols-2 lg:grid-cols-3` responsive layout
- [ ] 3.9 Create video card component with thumbnail, play button overlay, title, description
- [ ] 3.10 Add click handler to open video in modal/overlay (selectedVideo state)
- [ ] 3.11 Add lazy loading to thumbnail images (`loading="lazy"`)
- [ ] 3.12 Apply existing UI classes (ui-card, ui-btn-primary, text-* colors)

## Phase 4: Routing (Integration)

- [ ] 4.1 Add import to `frontend-bun-ejs/index.ts`: `import { behindScenesController } from "./src/controllers/behind-scenes.controller.ts"`
- [ ] 4.2 Register route after explore route (line ~69): `addRoute("GET", "/como-lo-hice", behindScenesController)`
- [ ] 4.3 Verify route appears in startup logs (registered routes list)

## Phase 5: Navigation (Desktop + Mobile)

- [ ] 5.1 Add desktop nav link in `views/partials/nav.ejs` after Explore link (line ~21): `<a href="/como-lo-hice" class="text-text-secondary...">Cómo lo hice</a>`
- [ ] 5.2 Add mobile nav link in `views/partials/nav.ejs` after Explore link (line ~99): `<a href="/como-lo-hice"...>Cómo lo hice</a>`
- [ ] 5.3 Verify links appear in both desktop and mobile menus

## Phase 6: Testing (Verification)

- [ ] 6.1 Start dev server and navigate to `/como-lo-hice` — verify 200 OK response
- [ ] 6.2 Check browser console for successful `/public/videos.json` fetch (200 OK)
- [ ] 6.3 Verify hero section displays title and description from JSON
- [ ] 6.4 Verify featured video section renders correctly (if featured != null)
- [ ] 6.5 Verify video grid displays all videos from JSON array
- [ ] 6.6 Click video card thumbnail — verify video plays in modal/overlay
- [ ] 6.7 Test YouTube iframe embed loads and plays video correctly
- [ ] 6.8 Test responsive layout on mobile (375px), tablet (768px), desktop (1024px+)
- [ ] 6.9 Test loading state — simulate slow network in DevTools (Network tab → Throttling)
- [ ] 6.10 Test error state — temporarily break JSON (malformed) and verify error message appears
- [ ] 6.11 Test missing JSON — delete videos.json and verify user-friendly error (not blank screen)
- [ ] 6.12 Run Lighthouse audit for accessibility (keyboard nav, ARIA labels)
- [ ] 6.13 Test nav link click in both desktop and mobile views
- [ ] 6.14 Verify page works without authentication (public route)

## Phase 7: Polish (Optional)

- [ ] 7.1 Add `$schema` property to videos.json for IDE autocomplete
- [ ] 7.2 Add duration field display on video cards
- [ ] 7.3 Test with empty videos array — verify empty state message displays
- [ ] 7.4 Verify YouTube privacy-enhanced mode toggle works (if config.privacyEnhanced set)

---

**Total Tasks**: 35 tasks across 7 phases  
**Estimated Time**: 2-3 hours (depending on familiarity with Alpine.js)  
**Dependencies**: Phase 1 must complete before Phase 3 (template needs JSON). Phase 4 depends on Phase 2. Phase 6 requires all previous phases.