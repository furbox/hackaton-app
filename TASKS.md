# Tasks: URLoft - Complete Implementation

> Parent roadmap only. Detailed execution/progress lives in `tasks/Phase01.md`, `tasks/Phase02.md`, `tasks/Phase03.md`, `tasks/Phase04.md`, `tasks/Phase05.md`, `tasks/Phase06.md`.
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

## Phase 5: Background Workers (6 tasks) ✅

- [x] 5.0 Architecture checkpoint: workers coordinan con servicios sin saltar la capa de negocio
- [x] 5.1 Create `backend/workers/health-checker.worker.ts` with periodic link status verification
- [x] 5.2 Create `backend/workers/reader-mode.worker.ts` with text extraction using Readability
- [x] 5.3 Create `backend/workers/wayback.worker.ts` with Internet Archive API integration
- [x] 5.4 Create `backend/workers/pool.ts` to manage worker lifecycle and message passing
- [x] 5.5 Integrate worker pool with link creation (fire-and-forget pattern with DB updates)

## Phase 6: MCP Server & Web Skill (4 tasks) ✅

- [x] 6.1 Create `backend/mcp/server.ts` with MCP protocol implementation and API key auth
- [x] 6.2 Implement MCP tools: create_link, get_links, get_link, update_link, delete_link, search_links, get_categories
- [x] 6.3 Create `backend/skill/search.ts` with full-text search using FTS5
- [x] 6.4 Create `backend/skill/extract.ts` with link metadata extraction endpoint

## Phase 7-10: Frontend SvelteKit ❌ IGNORED

> **⚠️ DECISIÓN DE ARQUITECTURA:** El frontend SvelteKit ha sido reemplazado por **frontend-bun-ejs** (Bun + EJS + Tailwind).
>
> Las tareas de frontend ahora viven en **`TASKS_FRONTEND.md`**.
>
> **Razón:** Para el hackatón priorizamos velocidad de desarrollo y simplicidad. Bun + EJS nos permite:
> - Zero-config build (Bun sirve estáticos directamente)
> - Templates HTML simples y fáciles de modificar
> - Integración directa con Tailwind vía CDN
> - Menor curva de aprendizaje para presentaciones/demos
>
> **Estado del frontend SvelteKit:** Archivado en `frontend/` pero no activo. Puede reactivarse en el futuro si se desea migrar.

- [ ] 7.1 ❌ IGNORED - See `TASKS_FRONTEND.md` for EJS frontend tasks
- [ ] 7.2 ❌ IGNORED - See `TASKS_FRONTEND.md` for EJS frontend tasks
- [ ] 7.3 ❌ IGNORED - See `TASKS_FRONTEND.md` for EJS frontend tasks
- [ ] 7.4 ❌ IGNORED - See `TASKS_FRONTEND.md` for EJS frontend tasks
- [ ] 7.5 ❌ IGNORED - See `TASKS_FRONTEND.md` for EJS frontend tasks
- [ ] 7.6 ❌ IGNORED - See `TASKS_FRONTEND.md` for EJS frontend tasks
- [ ] 8.1 ❌ IGNORED - See `TASKS_FRONTEND.md` for EJS frontend tasks
- [ ] 8.2 ❌ IGNORED - See `TASKS_FRONTEND.md` for EJS frontend tasks
- [ ] 8.3 ❌ IGNORED - See `TASKS_FRONTEND.md` for EJS frontend tasks
- [ ] 8.4 ❌ IGNORED - See `TASKS_FRONTEND.md` for EJS frontend tasks
- [ ] 8.5 ❌ IGNORED - See `TASKS_FRONTEND.md` for EJS frontend tasks
- [ ] 9.1 ❌ IGNORED - See `TASKS_FRONTEND.md` for EJS frontend tasks
- [ ] 9.2 ❌ IGNORED - See `TASKS_FRONTEND.md` for EJS frontend tasks
- [ ] 9.3 ❌ IGNORED - See `TASKS_FRONTEND.md` for EJS frontend tasks
- [ ] 9.4 ❌ IGNORED - See `TASKS_FRONTEND.md` for EJS frontend tasks
- [ ] 9.5 ❌ IGNORED - See `TASKS_FRONTEND.md` for EJS frontend tasks
- [ ] 9.6 ❌ IGNORED - See `TASKS_FRONTEND.md` for EJS frontend tasks
- [ ] 9.7 ❌ IGNORED - See `TASKS_FRONTEND.md` for EJS frontend tasks
- [ ] 10.1 ❌ IGNORED - See `TASKS_FRONTEND.md` for EJS frontend tasks
- [ ] 10.2 ❌ IGNORED - See `TASKS_FRONTEND.md` for EJS frontend tasks
- [ ] 10.3 ❌ IGNORED - See `TASKS_FRONTEND.md` for EJS frontend tasks
- [ ] 10.4 ❌ IGNORED - See `TASKS_FRONTEND.md` for EJS frontend tasks
- [ ] 10.5 ❌ IGNORED - See `TASKS_FRONTEND.md` for EJS frontend tasks
- [ ] 10.6 ❌ IGNORED - See `TASKS_FRONTEND.md` for EJS frontend tasks

## Phase 11: Chrome Extension (4 tasks)

> **⚠️ NOTA:** Originalmente planeado con Svelte, ahora usaremos HTML/JS vanilla o Alpine.js para el popup.

- [ ] 11.1 Create `extension/manifest.json` with permissions (activeTab, storage) and background service worker
- [ ] 11.2 Create `extension/popup/` with HTML/CSS/JS popup (save button, category selector, API key input)
- [ ] 11.3 Create `extension/background/service-worker.ts` with tab metadata extraction
- [ ] 11.4 Build extension with `bun run ext:build` script

## Phase 12: PWA Configuration (3 tasks)

> **⚠️ NOTA:** PWA se implementa en `frontend-bun-ejs/` (no en el frontend SvelteKit archivado).

- [ ] 12.1 Create `frontend-bun-ejs/public/manifest.json` with app name, icons, colors, and display mode
- [ ] 12.2 Create `frontend-bun-ejs/public/sw.js` service worker with offline support and asset caching
- [ ] 12.3 Add PWA install prompt logic in EJS templates with beforeinstallprompt event

## Phase 13: Security & Rate Limiting (4 tasks)

- [ ] 13.1 Create `backend/middleware/rate-limit.ts` with IP-based limiting using in-memory Map
- [ ] 13.2 Create API key rate limiter with per-key quotas and Redis-like in-memory storage
- [ ] 13.3 Add security headers (CORS, CSP, X-Frame-Options) in server middleware
- [ ] 13.4 Implement session fingerprint validation (IP + User-Agent hash) in auth middleware

## Phase 14: Testing Suite (5 tasks)

> **⚠️ NOTA:** Testing de componentes Svelte reemplazado por testing de templates EJS (si aplica).

- [ ] 14.1 Write `backend/__tests__/auth.test.ts` with register, login, logout flows
- [ ] 14.2 Write `backend/__tests__/links.test.ts` with CRUD and pagination tests
- [ ] 14.3 Write `backend/__tests__/workers.test.ts` with mock worker messaging
- [ ] 14.4 Smoke tests for EJS frontend (manual or with Playwright)
- [ ] 14.5 Set up Playwright E2E tests for critical flows (register → create link → verify in dashboard)

## Phase 15: Deployment & Build (4 tasks)

- [ ] 15.1 Verify `backend/bun.lock` and `frontend-bun-ejs/bun.lock` are committed and dependencies resolve correctly
- [ ] 15.2 Ensure frontend-bun-ejs dev command works (`frontend-bun-ejs/package.json` → `bun run dev`)
- [ ] 15.3 Create `.env.example` with all required variables (`BETTER_AUTH_SECRET`, `BETTER_AUTH_URL`, `TRUST_PROXY`, `RESEND_API_KEY`, `DATABASE_URL`)
- [ ] 15.4 Write deployment scripts for Railway/Fly.io with health check and startup commands

**Total Tasks: 88** (24 frontend tasks archived, see `TASKS_FRONTEND.md` for EJS tasks)

---

## Implementation Order

**Critical Path (Backend):** Phase 1 → Phase 2 → Phase 3 → Phase 4 ✅ COMPLETO

**Critical Path (Frontend):** Ver `TASKS_FRONTEND.md` para roadmap completo de `frontend-bun-ejs/`

**Parallelizable:**
- Phase 5 (Workers) can run parallel to Phase 4
- Phase 11 (Extension) and Phase 12 (PWA) are independent
- Phase 14 (Testing) should run alongside each phase

**Dependencies:**
- Phase 3 (Auth) must complete before Phase 4 (Core APIs)
- Phase 2 (DB) must complete before Phase 3
- Phase 4 (Backend APIs) must partially complete before Frontend integration
