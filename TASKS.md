# Tasks: URLoft - Complete Implementation

> Parent roadmap only. Detailed execution/progress lives in `tasks/Phase01.md`, `tasks/Phase02.md`, `tasks/Phase03.md`, `tasks/Phase04.md`.
> Status below is synchronized with those phase files.

## Architecture Guardrails

- Backend estándar obligatorio: **Feature-First + Layered Modular** en Bun, manteniendo monolito modular.
- Flujo requerido en nuevas features backend: **`Route (HTTP) -> Service (use case/lógica de negocio) -> Repository/DB (persistencia)`**.
- Evitar MVC pesado para backend API-first: no mezclar reglas de negocio en handlers HTTP ni acoplar servicios a rendering.

## Phase 1: Foundation Setup (3 tasks) ✅

- [x] 1.1 Initialize Bun project with standard structure (`backend/`, `frontend/`)
- [x] 1.2 Install Tailwind CSS v4 + `@tailwindcss/vite` and create `app.css` with `@import "tailwindcss"`
- [x] 1.3 Set up `package.json` with scripts (`dev`, `test`, `db:setup`)

## Phase 2: Database & Schema (7 tasks) ✅

- [x] 2.1 Create `backend/db/schema.sql` with all tables (users, links, categories, likes, favorites, sessions, audit_logs, api_keys, password_resets)
- [x] 2.2 Add FTS5 virtual table `links_fts` with title, description, url, content_text columns
- [x] 2.3 Create SQLite triggers (links_ai, links_ad, links_au) to sync FTS5 with links table
- [x] 2.4 Create `backend/db/connection.ts` with `bun:sqlite` Database wrapper and `PRAGMA foreign_keys=ON`
- [x] 2.5 Create `backend/db/migrations.ts` with schema initialization and WAL mode setup
- [x] 2.6 Add `backend/db/queries.ts` with prepared statements for CRUD operations
- [x] 2.7 Write `backend/db/__tests__/schema.test.ts` using in-memory SQLite to verify tables and triggers

## Phase 3: Authentication Layer (11 tasks) ✅

- [x] 3.1 Install `better-auth` and configure native `bun:sqlite` integration in backend
- [x] 3.2 Create `backend/auth/config.ts` with Better Auth setup (stateful sessions + email verification)
- [x] 3.3 Create `backend/auth/middleware.ts` with session validation and fingerprint checking
- [x] 3.4 Create auth endpoints: `POST /api/auth/register`, `POST /api/auth/login`, `POST /api/auth/logout`
- [x] 3.5 Create email verification endpoints: `GET /api/auth/verify/:token`, resend verification email
- [x] 3.6 Create password reset endpoints: `POST /api/auth/forgot-password`, `POST /api/auth/reset-password`
- [x] 3.7 Set up Resend email templates in `backend/emails/` (verification, password reset)
- [x] 3.8 Create audit log service to track auth events (login, logout, password_change)
- [x] 3.9 Consolidate auth test suite and DB verification coverage
- [x] 3.10 Set up admin plugin integration (role management, ban/unban, impersonation)
- [x] 3.11 Apply admin schema migration and initial admin bootstrap strategy

## Phase 4: Core Backend APIs (11 tasks) ✅

- [x] 4.0 Architecture checkpoint: validar boundary `routes -> services -> db` antes de abrir nuevos endpoints
- [x] 4.1 Create `backend/services/links.service.ts` with createLink, getLinks, getLinkById, updateLink, deleteLink
- [x] 4.2 Create `backend/routes/api/links.ts` with GET/POST/PUT/DELETE endpoints for links
- [x] 4.3 Create `backend/routes/api/links.ts` with like/favorite toggle endpoints (`POST /:id/like`, `POST /:id/favorite`)
- [x] 4.4 Create `backend/routes/api/links.ts` with preview endpoint (`POST /preview` - OG metadata extraction)
- [x] 4.5 Create `backend/services/categories.service.ts` with CRUD operations
- [x] 4.6 Create `backend/routes/api/categories.ts` with category endpoints
- [x] 4.7 Create `backend/routes/api/stats.ts` with user stats and global stats endpoints
- [x] 4.8 Create `backend/routes/api/users.ts` with profile endpoints (get public profile, update profile, change password)
- [x] 4.9 Create `backend/routes/api/keys.ts` with API key CRUD and hashing logic
- [x] 4.10 Create short link redirect handler in `backend/routes/api/short.ts` (`GET /api/s/:code`)

## Phase 5: Background Workers (6 tasks)

- [ ] 5.0 Architecture checkpoint: workers coordinan con servicios sin saltar la capa de negocio
- [ ] 5.1 Create `backend/workers/health-checker.worker.ts` with periodic link status verification
- [ ] 5.2 Create `backend/workers/reader-mode.worker.ts` with text extraction using Readability
- [ ] 5.3 Create `backend/workers/wayback.worker.ts` with Internet Archive API integration
- [ ] 5.4 Create `backend/workers/pool.ts` to manage worker lifecycle and message passing
- [ ] 5.5 Integrate worker pool with link creation (fire-and-forget pattern with DB updates)

## Phase 6: MCP Server & Web Skill (4 tasks)

- [ ] 6.1 Create `backend/mcp/server.ts` with MCP protocol implementation and API key auth
- [ ] 6.2 Implement MCP tools: create_link, get_links, get_link, update_link, delete_link, search_links, get_categories
- [ ] 6.3 Create `backend/skill/search.ts` with full-text search using FTS5
- [ ] 6.4 Create `backend/skill/extract.ts` with link metadata extraction endpoint

## Phase 7: Frontend - SvelteKit Setup (6 tasks)

- [ ] 7.1 Initialize SvelteKit project in `frontend/` with TypeScript and Tailwind
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

- [ ] 13.1 Create `backend/middleware/rate-limit.ts` with IP-based limiting using in-memory Map
- [ ] 13.2 Create API key rate limiter with per-key quotas and Redis-like in-memory storage
- [ ] 13.3 Add security headers (CORS, CSP, X-Frame-Options) in server middleware
- [ ] 13.4 Implement session fingerprint validation (IP + User-Agent hash) in auth middleware

## Phase 14: Testing Suite (5 tasks)

- [ ] 14.1 Write `backend/__tests__/auth.test.ts` with register, login, logout flows
- [ ] 14.2 Write `backend/__tests__/links.test.ts` with CRUD and pagination tests
- [ ] 14.3 Write `backend/__tests__/workers.test.ts` with mock worker messaging
- [ ] 14.4 Install Vitest + `@testing-library/svelte` and write component tests for LinkCard, SearchBar
- [ ] 14.5 Set up Playwright E2E tests for critical flows (register → create link → verify in dashboard)

## Phase 15: Deployment & Build (4 tasks)

- [ ] 15.1 Verify `backend/bun.lock` and `frontend/bun.lock` are committed and dependencies resolve correctly
- [ ] 15.2 Ensure frontend build command exists (`frontend/package.json` → `bun run build`) for production bundle
- [ ] 15.3 Create `.env.example` with all required variables (`BETTER_AUTH_SECRET`, `BETTER_AUTH_URL`, `TRUST_PROXY`, `RESEND_API_KEY`, `DATABASE_URL`)
- [ ] 15.4 Write deployment scripts for Railway/Fly.io with health check and startup commands

**Total Tasks: 88**

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
