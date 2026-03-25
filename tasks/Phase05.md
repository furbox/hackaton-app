# Tasks: Phase 5 - Background Workers

> **Change**: Implement background workers for health checking, reader mode, and Wayback Machine archival  
> **Focus**: Bun native `Worker` + typed message protocol + service-layer boundary (`worker -> service -> db`)

---

## Phase 5: Background Workers

### 5.0 Architecture checkpoint: worker/service boundary contract

- [x] 5.0.1 Create `backend/workers/types.ts` defining `WorkerMessageType` enum (`HEALTH_CHECK`, `READER_MODE`, `WAYBACK`), `WorkerMessage<T>` generic request type, and `WorkerResult<T>` generic response type
- [x] 5.0.2 Document convention in `backend/workers/types.ts` header: workers MUST NOT import from `backend/db/queries/`, `backend/db/connection.ts`, or `bun:sqlite` — all DB writes go via `backend/services/`
- [x] 5.0.3 Extend `backend/scripts/check-route-boundaries.ts` (or create a parallel checker) with worker boundary rule: flag any `import.*db/queries` or `import.*bun:sqlite` inside `backend/workers/`
- [x] 5.0.4 Add a `bun run check:phase5-architecture` script in `backend/package.json` that runs the worker boundary checker

#### 5.0 Architecture checklist (required per new worker file)

- [x] Worker file imports ONLY from `backend/workers/types.ts` and `backend/services/`
- [x] No `bun:sqlite`, `Database`, or `backend/db/` imports anywhere inside `backend/workers/`
- [x] Worker communicates with main thread exclusively via `postMessage` / `self.onmessage`
- [x] Worker uses `.ts` specifiers in all local imports (no `.js` extensions inside workers)
- [x] Main thread never `await`s worker result before responding to HTTP client

#### 5.0 Evidence

- [x] `bun run --cwd backend check:phase5-architecture` passes with zero violations
- [x] `backend/workers/types.ts` exports `WorkerMessage`, `WorkerResult`, `WorkerMessageType`

**Acceptance Criteria**
- Worker boundary rule is machine-verifiable (not just documented)
- All Phase 5 workers conform to the type contract defined in `types.ts`

---

### 5.1 Create `backend/workers/health-checker.worker.ts`

- [x] 5.1.1 Create `backend/workers/health-checker.worker.ts` as a Bun Worker entry file using `self.onmessage` to receive `WorkerMessage<HealthCheckPayload>` (contains `linkId: number`, `url: string`)
- [x] 5.1.2 Perform HTTP HEAD request (with timeout, default 10 s, configurable via `HEALTH_CHECK_TIMEOUT_MS` env var) and capture response `status`; fall back to GET on HEAD failure
- [x] 5.1.3 Map network errors and timeouts to a synthetic status code (e.g. `0` = unreachable, `-1` = timeout) so every result is numeric and DB-safe
- [x] 5.1.4 Add `updateLinkStatusCode(linkId: number, statusCode: number): Phase4ServiceResult<{ updated: boolean }>` method to `backend/services/links.service.ts` for use by the worker result handler in the pool
- [x] 5.1.5 Post `WorkerResult<HealthCheckResult>` back via `self.postMessage` containing `{ linkId, statusCode, checkedAt }`
- [x] 5.1.6 Add configurable periodic sweep: worker accepts a `SWEEP` message type that triggers a full scan of all public links; interval controlled by `HEALTH_CHECK_INTERVAL_MS` env var (default 3 600 000 ms / 1 h)

#### 5.1 Evidence

```bash
# Unit: worker logic in isolation
bun test backend/workers/__tests__/health-checker.worker.test.ts
# Architecture: no db imports in worker
bun run --cwd backend check:phase5-architecture
```

- [x] `bun test test/workers/__tests__/health-checker.worker.test.ts` (backend/) → 5 pass, 0 fail
- [x] `bun test test/services/__tests__/links.service.test.ts` (backend/) → 15 pass, 0 fail
- [x] `bun run check:phase5-architecture` (backend/) → `[PHASE5_BOUNDARY_OK] workers=backend/workers`

**Acceptance Criteria**
- Worker sends `WorkerResult` with numeric `statusCode` for every URL (including failures)
- `links.status_code` is updated via `links.service.ts`, never via direct DB call from worker
- Timeout and unreachable URLs do not crash the worker

---

### 5.2 Create `backend/workers/reader-mode.worker.ts`

- [x] 5.2.1 Create `backend/workers/reader-mode.worker.ts` as a Bun Worker entry file receiving `WorkerMessage<ReaderModePayload>` (`{ linkId: number, url: string }`)
- [x] 5.2.2 Install `@mozilla/readability` (or `@extractus/article-extractor` if Bun-compatible) and add to `backend/package.json`; verify it works under Bun without Node-specific shims
- [x] 5.2.3 Fetch the URL HTML content (with 15 s timeout via `AbortController`), parse with the chosen library, and extract plain-text content (`textContent` field)
- [x] 5.2.4 Handle non-HTML content types (PDF, image, binary): post result with `contentText: null` and deterministic behavior
- [x] 5.2.5 Add `updateLinkContentText(linkId: number, contentText: string | null): Phase4ServiceResult<{ updated: boolean }>` to `backend/services/links.service.ts`
- [x] 5.2.6 Post `WorkerResult<ReaderModeResult>` (`{ linkId, contentText, extractedAt }`) back via `self.postMessage`

#### 5.2 Evidence

```bash
bun test test/workers/__tests__/reader-mode.worker.test.ts
bun test test/services/__tests__/links.service.test.ts
bun run check:phase5-architecture
```

- [x] `bun test test/workers/__tests__/reader-mode.worker.test.ts` (backend/) → 5 pass, 0 fail
- [x] `bun test test/services/__tests__/links.service.test.ts` (backend/) → 18 pass, 0 fail
- [x] `bun run check:phase5-architecture` (backend/) → `[PHASE5_BOUNDARY_OK] workers=backend/workers`

**Acceptance Criteria**
- Extracted text is stored in `links.content_text` via service call; FTS5 triggers fire automatically
- Non-HTML, fetch failures, and timeouts produce `null` content with no crash
- Worker does not import `bun:sqlite` or any db module

---

### 5.3 Create `backend/workers/wayback.worker.ts`

- [x] 5.3.1 Create `backend/workers/wayback.worker.ts` as a Bun Worker entry file receiving `WorkerMessage<WaybackPayload>` (`{ linkId: number, url: string }`)
- [x] 5.3.2 Submit URL to Internet Archive via `POST https://web.archive.org/save/{url}` (or the Save Page Now 2 API) and capture the returned `Content-Location` header as the archive URL
- [x] 5.3.3 Implement exponential backoff retry (max 3 attempts, base 2 s) for HTTP 429 (rate limit) and 5xx responses
- [x] 5.3.4 Add `updateLinkArchiveUrl(linkId: number, archiveUrl: string | null): Promise<void>` to `backend/services/links.service.ts`
- [x] 5.3.5 Post `WorkerResult<WaybackResult>` (`{ linkId, archiveUrl, archivedAt }`) back via `self.postMessage`; set `archiveUrl: null` on permanent failure

#### 5.3 Evidence

```bash
bun test backend/workers/__tests__/wayback.worker.test.ts
bun run --cwd backend check:phase5-architecture
```

- [x] `bun test test/workers/__tests__/wayback.worker.test.ts` (backend/) → 5 pass, 0 fail
- [x] `bun test test/services/__tests__/links.service.test.ts` (backend/) → 21 pass, 0 fail
- [x] `bun run check:phase5-architecture` (backend/) → `[PHASE5_BOUNDARY_OK] workers=backend/workers`

**Acceptance Criteria**
- `links.archive_url` is populated via service call on success
- Rate-limit and transient errors are retried with backoff; permanent failures store `null`
- Worker never writes to DB directly

---

### 5.4 Create `backend/workers/pool.ts` to manage worker lifecycle

- [x] 5.4.1 Create `backend/workers/pool.ts` exporting a `WorkerPool` class (or singleton) that instantiates the three workers using `new Worker(new URL('./health-checker.worker.ts', import.meta.url))` syntax compatible with Bun
- [x] 5.4.2 Implement `dispatch(message: WorkerMessage<unknown>): void` method that routes messages to the correct worker based on `message.type` (`HEALTH_CHECK` → health worker, `READER_MODE` → reader worker, `WAYBACK` → wayback worker)
- [x] 5.4.3 Attach `onmessage` handlers on each worker instance: receive `WorkerResult`, call the appropriate service method (e.g. `links.service.updateLinkStatusCode`) in the main thread, log errors
- [x] 5.4.4 Implement basic crash recovery: attach `onerror` handler per worker; on unhandled error, log and restart the worker after 5 s delay
- [x] 5.4.5 Export a `shutdown(): Promise<void>` method that terminates all workers gracefully (`worker.terminate()`)
- [x] 5.4.6 Export pool as lazy singleton — initialize once at server startup in `backend/index.ts` and reuse across requests

#### 5.4 Evidence

```bash
bun test backend/workers/__tests__/pool.test.ts
# Start server and verify 3 workers spawn without error
bun run --cwd backend dev
```

- [x] `bun test test/workers/__tests__/pool.test.ts` (backend/) → 5 pass, 0 fail
- [x] `bun run check:phase5-architecture` (backend/) → `[PHASE5_BOUNDARY_OK] workers=backend/workers`

**Acceptance Criteria**
- Pool routes dispatched messages to the correct worker
- Worker crashes are caught and the worker is restarted automatically
- `shutdown()` terminates all workers cleanly (no dangling processes)

---

### 5.5 Integrate worker pool with link creation (fire-and-forget)

- [x] 5.5.1 Import and call `workerPool.dispatch()` at the end of `createLink` in `backend/services/links.service.ts` — dispatch three messages: `HEALTH_CHECK`, `READER_MODE`, `WAYBACK` — each with `{ linkId, url }`
- [x] 5.5.2 Ensure `createLink` does NOT await any worker response; dispatch must be fully fire-and-forget (synchronous `dispatch` call, no `Promise` returned from workers to the service)
- [x] 5.5.3 Guard dispatch with a check: only dispatch if `workerPool` is initialized (avoid crashes in test environments where pool is not started)
- [x] 5.5.4 Verify `POST /api/links` response time is not affected by worker dispatch — HTTP response must return before any worker I/O begins
- [x] 5.5.5 Add integration test `backend/workers/__tests__/integration.test.ts` that mocks `workerPool.dispatch` and asserts it is called with the three expected message types after a `createLink` call

#### 5.5 Evidence

```bash
bun test backend/workers/__tests__/integration.test.ts
bun test backend/services/__tests__/links.service.test.ts
# Verify HTTP response is immediate
curl -X POST http://localhost:3000/api/links -d '{"url":"...","title":"..."}' -w "\nTime: %{time_total}s\n"
```

- [x] `bun test test/workers/__tests__/integration.test.ts` (backend/) → 2 pass, 0 fail
- [x] `bun test test/services/__tests__/links.service.test.ts` (backend/) → 21 pass, 0 fail
- [x] `bun run check:phase5-architecture` (backend/) → `[PHASE5_BOUNDARY_OK] workers=backend/workers`

**Acceptance Criteria**
- `createLink` returns to caller before any worker I/O starts
- All three worker jobs are dispatched for every new link
- No worker import leaks into route files (boundary check passes)

---

## Implementation Order

**Execute sequentially**: 5.0 → 5.1 → 5.2 → 5.3 → 5.4 → 5.5

**Rationale**:
- `5.0` must be first — defines `WorkerMessage`/`WorkerResult` types that all workers consume
- `5.1–5.3` can proceed in parallel once types are defined, but each adds a service method that `5.4` depends on
- `5.4` (pool) wires the three workers — requires all three worker files to exist
- `5.5` (integration) is last — depends on pool + `links.service.ts` service methods added in 5.1–5.3

**Test-first guidance per worker**:
Write the `__tests__/*.test.ts` mock before implementing the worker file — use `mock()` from `bun:test` to stub HTTP calls and service methods.

---

**Total Sub-Tasks**: 30 across 6 parent tasks  
**Dependencies**: Phase 4 complete (`links.service.ts` with `createLink` already implemented)
