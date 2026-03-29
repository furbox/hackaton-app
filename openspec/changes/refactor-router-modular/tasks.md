# Tasks: Refactor Router Modular

## Phase 1: Foundation (Types & Helper)

- [x] 1.1 Create directory `frontend-bun-ejs/src/routes/` if not exists
- [x] 1.2 Create `frontend-bun-ejs/src/routes/index.ts` with `RouteDefinition` type and `registerRoutes()` helper
- [x] 1.3 Add duplicate detection logic in `registerRoutes()` using `listRoutes()`
- [x] 1.4 Write unit test: `registerRoutes` calls `addRoute` for each definition with correct params
- [x] 1.5 Write unit test: `registerRoutes` logs warning for duplicate routes

## Phase 2: Route Modules Creation

- [x] 2.1 Create `frontend-bun-ejs/src/routes/public.routes.ts` with `publicRoutes` array (home, explore, profiles)
- [x] 2.2 Create `frontend-bun-ejs/src/routes/auth.routes.ts` with `authRoutes` array (login, register, password reset)
- [x] 2.3 Create `frontend-bun-ejs/src/routes/dashboard.routes.ts` with `dashboardRoutes` array (links, categories, keys, favorites)
- [x] 2.4 Create `frontend-bun-ejs/src/routes/api.routes.ts` with `apiRoutes` array (HTMX partials, short links, web skill)
- [x] 2.5 Add re-exports in `routes/index.ts` for all 4 modules

## Phase 3: Entry Point Migration (Incremental)

- [x] 3.1 Replace public routes block in `index.ts` with `registerRoutes(publicRoutes)`
- [x] 3.2 Verify server starts and public routes work (`/`, `/explore`, `/u/:username`)
- [x] 3.3 Replace auth routes block in `index.ts` with `registerRoutes(authRoutes)`
- [x] 3.4 Verify auth routes work (`/auth/login`, `/auth/register`, `/auth/forgot-password`)
- [x] 3.5 Replace dashboard routes block in `index.ts` with `registerRoutes(dashboardRoutes)`
- [x] 3.6 Verify dashboard routes work (`/dashboard/*` authenticated routes)
- [x] 3.7 Replace api routes block in `index.ts` with `registerRoutes(apiRoutes)`
- [x] 3.8 Verify api routes work (`/api/*`, HTMX endpoints, short links)
- [x] 3.9 Remove orphaned controller imports from `index.ts` (cleanup 60+ imports)

## Phase 4: Testing & Validation

- [x] 4.1 Write integration test: verify all 50+ routes are registered using `listRoutes()`
- [x] 4.2 Write integration test: verify static routes are registered before dynamic routes (order preservation)
- [x] 4.3 Run full test suite: `bun test` to ensure no regressions
- [x] 4.4 Smoke test: `bun run dev` starts without errors and logs route registration
- [x] 4.5 Manual test: verify critical user flows (register → login → create link → view profile)

## Phase 5: Cleanup & Documentation

- [x] 5.1 Add inline comments to `routes/index.ts` explaining the registration flow
- [x] 5.2 Update `AGENTS.md` or relevant docs to reference new routing structure
- [x] 5.3 Verify no console warnings or errors in development mode
- [x] 5.4 Git commit with conventional commit format: `refactor(router): migrate to modular route definitions`
