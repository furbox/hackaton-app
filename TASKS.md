# Tasks: URLoft - Complete Implementation

## Phase 1: Foundation Setup (3 tasks)

- [ ] 1.1 Initialize Bun project with standard structure (`src/backend/`, `src/frontend/`)
- [ ] 1.2 Install Tailwind CSS v4 + `@tailwindcss/vite` and create `app.css` with `@import "tailwindcss"`
- [ ] 1.3 Set up `package.json` with scripts (`dev`, `build`, `test`, `db:setup`)

## Phase 2: Database & Schema (7 tasks)

- [ ] 2.1 Create `src/backend/db/schema.sql` with all tables (users, links, categories, likes, favorites, sessions, audit_logs, api_keys, password_resets)
- [ ] 2.2 Add FTS5 virtual table `links_fts` with title, description, url, content_text columns
- [ ] 2.3 Create SQLite triggers (links_ai, links_ad, links_au) to sync FTS5 with links table
- [ ] 2.4 Create `src/backend/db/connection.ts` with `bun:sqlite` Database wrapper and `PRAGMA foreign_keys=ON`
- [ ] 2.5 Create `src/backend/db/migrations.ts` with schema initialization and WAL mode setup
- [ ] 2.6 Add `src/backend/db/queries.ts` with prepared statements for CRUD operations
- [ ] 2.7 Write `src/backend/db/__tests__/schema.test.ts` using in-memory SQLite to verify tables and triggers

## Phase 3: Authentication Layer (8 tasks)

- [ ] 3.1 Install `better-auth` and configure SQLite adapter for `bun:sqlite` in backend
- [ ] 3.2 Create `src/backend/auth/config.ts` with Better Auth setup (JWT, session options, email verification)
- [ ] 3.3 Create `src/backend/auth/middleware.ts` with session validation and fingerprint checking
- [ ] 3.4 Create auth endpoints: `POST /api/auth/register`, `POST /api/auth/login`, `POST /api/auth/logout`
- [ ] 3.5 Create email verification endpoints: `GET /api/auth/verify/:token`, resend verification email
- [ ] 3.6 Create password reset endpoints: `POST /api/auth/forgot-password`, `POST /api/auth/reset-password`
- [ ] 3.7 Set up Resend email templates in `src/backend/emails/` (verification, password reset)
- [ ] 3.8 Create audit log service to track auth events (login, logout, password_change)

## Phase 4: Core Backend APIs (10 tasks)

- [ ] 4.1 Create `src/backend/services/links.service.ts` with createLink, getLinks, getLinkById, updateLink, deleteLink
- [ ] 4.2 Create `src/backend/routes/api/links.ts` with GET/POST/PUT/DELETE endpoints for links
- [ ] 4.3 Create `src/backend/routes/api/links.ts` with like/favorite toggle endpoints (`POST /:id/like`, `POST /:id/favorite`)
- [ ] 4.4 Create `src/backend/routes/api/links.ts` with preview endpoint (`POST /preview` - OG metadata extraction)
- [ ] 4.5 Create `src/backend/services/categories.service.ts` with CRUD operations
- [ ] 4.6 Create `src/backend/routes/api/categories.ts` with category endpoints
- [ ] 4.7 Create `src/backend/routes/api/stats.ts` with user stats and global stats endpoints
- [ ] 4.8 Create `src/backend/routes/api/users.ts` with profile endpoints (get public profile, update profile, change password)
- [ ] 4.9 Create `src/backend/routes/api/keys.ts` with API key CRUD and hashing logic
- [ ] 4.10 Create short link redirect handler in `src/backend/routes/short.ts` (`GET /s/:code`)

## Phase 5: Background Workers (5 tasks)

- [ ] 5.1 Create `src/backend/workers/health-checker.worker.ts` with periodic link status verification
- [ ] 5.2 Create `src/backend/workers/reader-mode.worker.ts` with text extraction using Readability
- [ ] 5.3 Create `src/backend/workers/wayback.worker.ts` with Internet Archive API integration
- [ ] 5.4 Create `src/backend/workers/pool.ts` to manage worker lifecycle and message passing
- [ ] 5.5 Integrate worker pool with link creation (fire-and-forget pattern with DB updates)

## Phase 6: MCP Server & Web Skill (4 tasks)

- [ ] 6.1 Create `src/backend/mcp/server.ts` with MCP protocol implementation and API key auth
- [ ] 6.2 Implement MCP tools: create_link, get_links, get_link, update_link, delete_link, search_links, get_categories
- [ ] 6.3 Create `src/backend/skill/search.ts` with full-text search using FTS5
- [ ] 6.4 Create `src/backend/skill/extract.ts` with link metadata extraction endpoint

## Phase 7: Frontend - SvelteKit Setup (6 tasks)

- [ ] 7.1 Initialize SvelteKit project in `src/frontend/` with TypeScript and Tailwind
- [ ] 7.2 Create file-based routing structure: `routes/`, `routes/(dashboard)/`, `routes/api/`
- [ ] 7.3 Set up Svelte 5 Runes in `app.html` and configure `$state`, `$derived` stores
- [ ] 7.4 Create shared layout `routes/+layout.svelte` with navigation and auth state
- [ ] 7.5 Create dashboard layout `routes/(dashboard)/+layout.ts` with `ssr=false` for SPA behavior
- [ ] 7.6 Set up SvelteKit server actions for form submissions (createLink, updateProfile, etc.)

## Phase 8: Frontend - Public Pages (5 tasks)

- [ ] 8.1 Create `routes/+page.svelte` (Home) with hero section, featured links, top users, global stats
- [ ] 8.2 Create `routes/explore/+page.svelte` with search, filters, and link cards
- [ ] 8.3 Create `routes/u/[username]/+page.svelte` for public user profiles
- [ ] 8.4 Create `routes/auth/login/+page.svelte` and `routes/auth/register/+page.svelte` with forms
- [ ] 8.5 Create auth flow pages: verify, forgot-password, reset-password

## Phase 9: Frontend - Dashboard Pages (7 tasks)

- [ ] 9.1 Create `routes/(dashboard)/+page.svelte` (Dashboard home) with stats summary
- [ ] 9.2 Create `routes/(dashboard)/links/+page.svelte` with CRUD table and filters
- [ ] 9.3 Create `routes/(dashboard)/categories/+page.svelte` with category CRUD UI
- [ ] 9.4 Create `routes/(dashboard)/keys/+page.svelte` with API key management
- [ ] 9.5 Create `routes/(dashboard)/favorites/+page.svelte` with favorited links
- [ ] 9.6 Create `routes/(dashboard)/profile/+page.svelte` with profile editing
- [ ] 9.7 Create `routes/(dashboard)/import/+page.svelte` with bookmark HTML upload

## Phase 10: Frontend Components (6 tasks)

- [ ] 10.1 Create `LinkCard.svelte` with OG image, title, description, stats, like/favorite buttons
- [ ] 10.2 Create `SearchBar.svelte` with debounced input and filter dropdown
- [ ] 10.3 Create `CategoryBadge.svelte` with color display and link filtering
- [ ] 10.4 Create `UserAvatar.svelte` with fallback initials and profile link
- [ ] 10.5 Create `StatCard.svelte` for dashboard stats display
- [ ] 10.6 Create `Modal.svelte` and `Toast.svelte` for feedback dialogs

## Phase 11: Chrome Extension (4 tasks)

- [ ] 11.1 Create `extension/manifest.json` with permissions (activeTab, storage) and background service worker
- [ ] 11.2 Create `extension/popup/App.svelte` with save button, category selector, and API key input
- [ ] 11.3 Create `extension/background/service-worker.ts` with tab metadata extraction
- [ ] 11.4 Build extension with `bun run ext:build` script using Vite

## Phase 12: PWA Configuration (3 tasks)

- [ ] 12.1 Create `public/manifest.json` with app name, icons, colors, and display mode
- [ ] 12.2 Create `public/sw.js` service worker with offline support and asset caching
- [ ] 12.3 Add PWA install prompt logic in frontend with beforeinstallprompt event

## Phase 13: Security & Rate Limiting (4 tasks)

- [ ] 13.1 Create `src/backend/middleware/rate-limit.ts` with IP-based limiting using in-memory Map
- [ ] 13.2 Create API key rate limiter with per-key quotas and Redis-like in-memory storage
- [ ] 13.3 Add security headers (CORS, CSP, X-Frame-Options) in server middleware
- [ ] 13.4 Implement session fingerprint validation (IP + User-Agent hash) in auth middleware

## Phase 14: Testing Suite (5 tasks)

- [ ] 14.1 Write `src/backend/__tests__/auth.test.ts` with register, login, logout flows
- [ ] 14.2 Write `src/backend/__tests__/links.test.ts` with CRUD and pagination tests
- [ ] 14.3 Write `src/backend/__tests__/workers.test.ts` with mock worker messaging
- [ ] 14.4 Install Vitest + `@testing-library/svelte` and write component tests for LinkCard, SearchBar
- [ ] 14.5 Set up Playwright E2E tests for critical flows (register → create link → verify in dashboard)

## Phase 15: Deployment & Build (4 tasks)

- [ ] 15.1 Create `bun.lockb` and verify workspace dependencies resolve correctly
- [ ] 15.2 Add `bun run build` script to compile SvelteKit and prepare production bundle
- [ ] 15.3 Create `.env.example` with all required variables (JWT_SECRET, RESEND_API_KEY, DATABASE_URL)
- [ ] 15.4 Write deployment scripts for Railway/Fly.io with health check and startup commands

**Total Tasks: 85**

---

## Implementation Order

**Critical Path:** Phase 1 → Phase 2 → Phase 3 → Phase 4 → Phase 7 → Phase 8 → Phase 9

**Parallelizable:**
- Phase 5 (Workers) can run parallel to Phase 4
- Phase 10 (Components) can start during Phase 8
- Phase 11 (Extension) and Phase 12 (PWA) are independent
- Phase 14 (Testing) should run alongside each phase

**Dependencies:**
- Phase 3 (Auth) must complete before Phase 4 (Core APIs)
- Phase 2 (DB) must complete before Phase 3
- Phase 4 (Backend APIs) must partially complete before Phase 7 (Frontend integration)
- Phase 7 (Frontend setup) must complete before Phase 8 and 9 (Pages)
