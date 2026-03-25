# Tasks: Phase 4 - Core Backend APIs

> **Change**: Implement core backend APIs for links, categories, stats, users, keys, and short links  
> **Focus**: API routing, service orchestration, and persistence boundaries (`routes -> services -> db`)

---

## Phase 4: Core Backend APIs

### 4.0 Architecture checkpoint: enforce `routes -> services -> db`

- [x] 4.0.1 Audit existing backend handlers to confirm no route imports from `backend/db/queries.ts` or `bun:sqlite` directly
- [x] 4.0.2 Define route/service contracts for Phase 4 modules in this file (payload shape, return shape, error mapping)
- [x] 4.0.3 Add a review checklist per new API file: input validation in route, business rules in service, data access in db layer
- [x] 4.0.4 Verify all new Phase 4 routes are wired via `backend/index.ts` without embedding business logic in the server entrypoint

#### 4.0 Route/Service contract baseline (scope lock: architecture only)

**Scope lock**
- This checkpoint defines architecture gates only.
- No implementation of Phase 4.1-4.10 endpoints/services is allowed in this change.

**Route contract (Phase 4 API surface)**
- Input: parse HTTP params/body/query and validate payload shape.
- Delegation: call exactly one service use case per route action.
- Output: serialize deterministic JSON and map typed service errors.
- Forbidden in route: SQL, `bun:sqlite`, `backend/db/queries`, `getDatabase()`.

**Service contract (Phase 4 use cases)**
- Input: typed arguments from route, never `Request`/`Response`.
- Responsibility: business rules, permission checks, orchestration.
- Persistence: call DB/query helpers from db layer only.
- Output: `Phase4ServiceResult<T>` (success or typed service error).

**Deterministic service error mapping**

| Service code | HTTP status |
|---|---|
| `VALIDATION_ERROR` | `400` |
| `UNAUTHORIZED` | `401` |
| `FORBIDDEN` | `403` |
| `NOT_FOUND` | `404` |
| `CONFLICT` | `409` |
| `INTERNAL` | `500` |

**`backend/index.ts` wiring-only constraints**
- Allowed: route module imports and path delegation.
- Forbidden: DB imports/calls, SQL literals, or business/domain branching.

#### 4.0 Review checklist (required per new API file)

- [ ] Route validates HTTP input and status mapping only.
- [ ] Route delegates business decisions to a service.
- [ ] Service receives typed data (not HTTP framework objects).
- [ ] Service owns business rules and permissions.
- [ ] DB access exists only in db helpers (`backend/db/*`).
- [ ] Route imports do not include `bun:sqlite`, `backend/db/queries`, or `getDatabase()` usage.
- [ ] `backend/index.ts` changes are dispatcher-only for Phase 4 route wiring.

#### 4.0 Evidence checklist

- [x] `backend/routes/api/contracts/service-error.ts` defines `PHASE4_ERROR_HTTP`, error union, and shared mapper.
- [x] `backend/scripts/check-route-boundaries.ts` + config detect forbidden route/index coupling.
- [x] Contract and boundary tests added for deterministic behavior.
- [x] `bun test routes/api/contracts/__tests__/service-error.contract.test.ts scripts/__tests__/check-route-boundaries.test.ts` passes.
- [x] `bun run check:phase4-architecture` passes.

**Acceptance Criteria**
- Route files only orchestrate HTTP concerns (status, parsing, serialization)
- Service files own business rules and call db/query helpers
- No direct route-to-db coupling exists in Phase 4 files

### 4.1 Create `backend/services/links.service.ts` with link CRUD use cases

- [x] 4.1.1 Create `backend/services/links.service.ts` with exported methods: `createLink`, `getLinks`, `getLinkById`, `updateLink`, `deleteLink`
- [x] 4.1.2 Extend `backend/db/queries.ts` with link query helpers required by the service (list filters, ownership checks, detail hydration)
- [x] 4.1.3 Implement ownership/visibility guard logic in service methods (owner can mutate, public/private visibility enforced)
- [x] 4.1.4 Add pagination/sort normalization in service (`likes|views|favorites|recent`) and safe defaults
- [x] 4.1.5 Normalize service error contract (not found, forbidden, conflict, validation) for route mapping

**4.1 Evidence (Phase 4.1 apply)**
- `bun test backend/db/__tests__/queries.links.test.ts` ✅ pass
- `bun test backend/services/__tests__/links.service.test.ts` ✅ pass
- `bun run --cwd backend check:phase4-architecture` ✅ pass

**Acceptance Criteria**
- All link CRUD operations are exposed through `links.service.ts` only
- Service methods call db helpers and never depend on `Request`/`Response`
- Error results are deterministic and mappable by routes

### 4.2 Create `backend/routes/api/links.ts` with link CRUD endpoints

- [x] 4.2.1 Create `backend/routes/api/links.ts` route handler for `GET /api/links`, `POST /api/links`, `PUT /api/links/:id`, `DELETE /api/links/:id`
- [x] 4.2.2 Add request parsing/validation for query params and JSON bodies in route layer only
- [x] 4.2.3 Call `backend/services/links.service.ts` for each endpoint and map service outcomes to HTTP codes
- [x] 4.2.4 Add auth guard integration for mutating endpoints while allowing public listing/detail as defined by visibility rules
- [x] 4.2.5 Wire `/api/links` dispatcher in `backend/index.ts` to delegate to the new route module

**Acceptance Criteria**
- Route file contains HTTP orchestration only and delegates business rules to service
- CRUD endpoints respond with consistent JSON success/error format
- Main server dispatches `/api/links*` correctly

**4.2 Evidence (Phase 4.2 apply)**
- `bun test backend/routes/api/__tests__/links.test.ts` ✅ pass
- `bun test backend/routes/api/**/__tests__/*.test.ts` ✅ pass
- `bun run --cwd backend check:phase4-architecture` ✅ pass

### 4.3 Add like/favorite toggle endpoints in `backend/routes/api/links.ts`

- [x] 4.3.1 Extend `backend/services/links.service.ts` with `toggleLike` and `toggleFavorite` use cases
- [x] 4.3.2 Extend `backend/db/queries.ts` with idempotent toggle statements and count refresh helpers
- [x] 4.3.3 Add `POST /api/links/:id/like` and `POST /api/links/:id/favorite` handlers in `backend/routes/api/links.ts`
- [x] 4.3.4 Enforce authenticated user context in route before calling toggle service methods
- [x] 4.3.5 Return updated interaction state payload (`liked_by_me`/`favorited_by_me` + counters)

**4.3 Evidence (Phase 4.3 apply)**
- `bun test backend/db/__tests__/queries.links.test.ts` ✅ pass
- `bun test backend/services/__tests__/links.service.test.ts` ✅ pass
- `bun test backend/routes/api/__tests__/links.test.ts` ✅ pass
- `bun run --cwd backend check:phase4-architecture` ✅ pass

**Acceptance Criteria**
- Toggle behavior is idempotent and scoped to the authenticated user
- Routes do not execute SQL directly
- Response payload reflects current toggle state and counts

### 4.4 Add preview endpoint (`POST /api/links/preview`) for OG metadata

- [x] 4.4.1 Add `previewLink` method in `backend/services/links.service.ts` to encapsulate URL validation + metadata extraction orchestration
- [x] 4.4.2 Create or reuse metadata extraction helper under `backend/services/` and call it from service (not from route)
- [x] 4.4.3 Add `POST /api/links/preview` handler in `backend/routes/api/links.ts` with body validation (`url` required)
- [x] 4.4.4 Map preview failures to stable HTTP responses (invalid URL, fetch failure, timeout)
- [x] 4.4.5 Ensure preview endpoint does not persist data unless explicitly required by service contract

**Acceptance Criteria**
- Preview route validates input and delegates extraction orchestration to service
- Service centralizes metadata extraction logic and error normalization
- Endpoint returns OG payload contract (`title`, `description`, `image`) or typed error

**4.4 Evidence (Phase 4.4 apply)**
- `bun test services/__tests__/link-preview-metadata.test.ts` ✅ pass
- `bun test services/__tests__/links.service.test.ts routes/api/__tests__/links.test.ts` ✅ pass
- `bun run check:phase4-architecture` ✅ pass

### 4.5 Create `backend/services/categories.service.ts` with category CRUD

- [x] 4.5.1 Create `backend/services/categories.service.ts` with methods: `createCategory`, `getCategories`, `updateCategory`, `deleteCategory`
- [x] 4.5.2 Extend `backend/db/queries.ts` with category CRUD + per-user uniqueness checks
- [x] 4.5.3 Implement service-level validation for name/color constraints and duplicate category handling
- [x] 4.5.4 Implement delete strategy in service (hard delete or reassignment flow contract)
- [x] 4.5.5 Define typed service result contracts for route consumption

**4.5 Evidence (Phase 4.5 apply)**
- `bun test backend/services/__tests__/categories.service.test.ts` ✅ pass
- `bun run --cwd backend check:phase4-architecture` ✅ pass

**Acceptance Criteria**
- Category business rules live in service layer
- DB uniqueness and ownership are enforced via service + query helpers
- Service provides consistent outcomes for create/update/delete conflicts

### 4.6 Create `backend/routes/api/categories.ts` with category endpoints

- [x] 4.6.1 Create `backend/routes/api/categories.ts` for `GET /api/categories`, `POST /api/categories`, `PUT /api/categories/:id`, `DELETE /api/categories/:id`
- [x] 4.6.2 Add auth guard requirement for all category endpoints
- [x] 4.6.3 Parse/validate request payloads in route and call `categories.service.ts`
- [x] 4.6.4 Map service errors to HTTP codes (`400`, `404`, `409`) with stable JSON shape
- [x] 4.6.5 Wire `/api/categories*` dispatch in `backend/index.ts`

**Acceptance Criteria**
- Category routes stay thin and service-driven
- Endpoints enforce authenticated ownership
- Server dispatcher resolves category route paths correctly

**4.6 Evidence (Phase 4.6 apply)**
- `bun test backend/routes/api/__tests__/categories.test.ts` ✅ pass (38 tests, 83 expect calls)
- `bun run --cwd backend check:phase4-architecture` ✅ pass
- Server starts without errors and categories routes are wired correctly

### 4.7 Create `backend/routes/api/stats.ts` with user/global stats endpoints

- [x] 4.7.1 Create `backend/services/stats.service.ts` with `getUserStats` and `getGlobalStats`
- [x] 4.7.2 Extend `backend/db/queries.ts` with aggregate queries for user metrics and global counters
- [x] 4.7.3 Create `backend/routes/api/stats.ts` with `GET /api/stats/me` and `GET /api/stats/global`
- [x] 4.7.4 Require authentication for `/api/stats/me` and keep `/api/stats/global` public
- [x] 4.7.5 Wire `/api/stats*` dispatch in `backend/index.ts`

**Acceptance Criteria**
- Stats routes only handle auth/query parsing and delegate aggregation logic
- Aggregations are implemented in db/query layer and consumed through service
- Both endpoints return documented metric fields consistently

**4.7 Evidence (Phase 4.7 apply)**
- `bun test backend/db/__tests__/queries.stats.test.ts` ✅ pass (7 tests, 31 expect calls)
- `bun test backend/services/__tests__/stats.service.test.ts` ✅ pass (7 tests, 31 expect calls)
- `bun test backend/routes/api/__tests__/stats.test.ts` ✅ pass (8 tests, 25 expect calls)
- `bun run check:phase4-architecture` ✅ pass

### 4.8 Create `backend/routes/api/users.ts` with profile endpoints

- [x] 4.8.1 Create `backend/services/users.service.ts` with methods: `getPublicProfile`, `updateProfile`, `changePassword`
- [x] 4.8.2 Extend `backend/db/queries.ts` with profile read/update and password update helpers
- [x] 4.8.3 Create `backend/routes/api/users.ts` with endpoints: `GET /api/users/:username`, `PUT /api/users/me`, `PUT /api/users/me/password`
- [x] 4.8.4 Add auth guard for `/me` endpoints and keep public profile endpoint unauthenticated
- [x] 4.8.5 Add password change validation (current/new password contract) in route and delegate policy checks to service
- [x] 4.8.6 Wire `/api/users*` dispatch in `backend/index.ts`

**4.8 Evidence (Phase 4.8 apply)**
- `bun test backend/services/__tests__/users.service.test.ts` ✅ pass
- `bun test backend/routes/api/__tests__/users.test.ts` ✅ pass
- `bun run check:phase4-architecture` ✅ pass

**Acceptance Criteria**
- Public and private profile flows are clearly separated by route auth policy
- Password change business rules execute in service, not route
- User routes return consistent profile/password response contracts

### 4.9 Create `backend/routes/api/keys.ts` with API key CRUD + hashing logic

- [x] 4.9.1 Create `backend/services/api-keys.service.ts` with methods: `listKeys`, `createKey`, `revokeKey`
- [x] 4.9.2 Implement key generation + hashing in service using secure random generation and one-way hash persistence
- [x] 4.9.3 Extend `backend/db/queries.ts` with API key insert/list/revoke helpers and `key_prefix` lookup fields
- [x] 4.9.4 Create `backend/routes/api/keys.ts` for `GET /api/keys`, `POST /api/keys`, `DELETE /api/keys/:id`
- [x] 4.9.5 Ensure route returns raw key only on creation and never on list/read paths
- [x] 4.9.6 Wire `/api/keys*` dispatch in `backend/index.ts`

**4.9 Evidence (Phase 4.9 apply)**
- `bun test backend/db/__tests__/queries.api-keys.test.ts` ✅ pass (11 tests, 21 expect calls)
- `bun test backend/services/__tests__/api-keys.service.test.ts` ✅ pass (14 tests, 28 expect calls)
- `bun test backend/routes/api/__tests__/keys.test.ts` ✅ pass (16 tests, 36 expect calls)
- `bun run check:phase4-architecture` ✅ pass

**Acceptance Criteria**
- API keys are stored hashed with prefix metadata only
- Raw key value is exposed once at creation and never persisted in plaintext
- Key routes are authenticated and service-mediated

### 4.10 Create short link redirect handler in `backend/routes/short.ts`

- [ ] 4.10.1 Create `backend/services/short-links.service.ts` with `resolveShortCode` use case
- [ ] 4.10.2 Extend `backend/db/queries.ts` with short-code lookup + atomic view increment helper
- [ ] 4.10.3 Create `backend/routes/short.ts` with `GET /s/:code` handler delegating to short-links service
- [ ] 4.10.4 Return HTTP redirect response on success and 404 response when code is missing/invalid
- [ ] 4.10.5 Wire `/s/*` dispatch in `backend/index.ts` without leaking redirect logic into server entrypoint

**Acceptance Criteria**
- Redirect flow resolves via service and db helper chain (`route -> service -> db`)
- Views increment only for valid resolved short codes
- Invalid codes return deterministic 404 behavior

---

## Implementation Order

**Execute sequentially**: 4.0 -> 4.1 -> 4.2 -> 4.3 -> 4.4 -> 4.5 -> 4.6 -> 4.7 -> 4.8 -> 4.9 -> 4.10  
**Parallelizable after 4.0**: 4.5/4.6, 4.7, 4.8, 4.9, and 4.10 can progress in parallel if route wiring conflicts are coordinated.

---

**Total Tasks**: 56 sub-tasks across 11 parent tasks  
**Dependencies**: Phase 3 complete (auth middleware, audit logging, admin foundation)
