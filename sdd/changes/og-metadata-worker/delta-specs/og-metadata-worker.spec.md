# OG Metadata Worker - Specifications

**Change**: `og-metadata-worker`
**Status**: Draft
**Version**: 1.0.0
**Last Updated**: 2026-04-08

---

## 1. Overview

### 1.1 Purpose
Add a background worker to automatically extract Open Graph (OG) metadata for all links after creation, ensuring rich link previews without blocking the user experience.

### 1.2 Scope
- Create `og-metadata.worker.ts` following existing worker pattern
- Integrate with WorkerPool for lifecycle management
- Extract `og:title`, `og:description`, and `og:image` from target URLs
- Update links table with extracted metadata asynchronously
- Reuse existing `extractLinkPreviewMetadata()` service function

### 1.3 Approach
Fire-and-forget worker dispatched after link creation (same pattern as health-checker, reader-mode, and wayback workers).

---

## 2. Functional Requirements

### FR-1: Worker Registration
- The OG metadata worker MUST be registered in the WorkerPool as a 4th worker type
- Worker type enum MUST include `OG_METADATA = "OG_METADATA"`
- Worker pool MUST initialize and manage the og-metadata worker lifecycle

### FR-2: Message Dispatch
- The worker MUST receive messages with type `WorkerMessageType.OG_METADATA`
- Payload MUST include:
  - `linkId: number` — ID of the link to process
  - `url: string` — Target URL to fetch metadata from
- Message MUST include a unique `correlationId` for tracking

### FR-3: Metadata Extraction
- Worker MUST fetch the target URL with a configurable timeout (default: 5000ms)
- Worker MUST parse HTML response to extract OG meta tags:
  - `og:title` → `og_title` database column
  - `og:description` → `og_description` database column
  - `og:image` → `og_image` database column
- Worker MUST support both `property="og:*"` and `name="og:*"` attribute variants
- Worker MUST handle both attribute-first and content-first meta tag formats

### FR-4: Database Update
- Worker pool MUST handle worker results and call `updateLinkOgMetadata(linkId, ogTitle, ogDescription, ogImage)`
- Update function MUST be idempotent (safe to call multiple times)
- Update function MUST use `updateLinkByOwner()` or direct SQL UPDATE

### FR-5: Integration with Link Creation
- `dispatchCreateLinkWorkers()` MUST include OG metadata job
- Worker MUST be dispatched immediately after link creation
- Dispatch MUST NOT block the create link response (fire-and-forget)
- Worker failures MUST NOT prevent link creation from succeeding

### FR-6: Result Handling
- Worker MUST return structured result with:
  - `linkId: number`
  - `ogTitle: string | null`
  - `ogDescription: string | null`
  - `ogImage: string | null`
  - `extractedAt: string` (ISO 8601 timestamp)
- Worker pool MUST validate result payload before processing
- Worker pool MUST log successful completions with duration tracking

---

## 3. Non-Functional Requirements

### NFR-1: Performance
- Default timeout: 5000ms (5 seconds) per URL
- Timeout MUST be configurable via environment variable `OG_METADATA_TIMEOUT_MS`
- Worker MUST NOT block main thread
- Extraction SHOULD complete within 10 seconds for 95% of URLs

### NFR-2: Reliability
- Worker MUST handle network failures gracefully (return null values)
- Worker MUST implement retry logic for transient failures (max 2 attempts)
- Worker crashes MUST NOT crash the main process (worker pool restarts workers)
- Worker pool MUST track metrics: dispatched, completed, failed

### NFR-3: Error Handling
- Invalid URLs MUST result in null metadata values (no error thrown)
- HTTP 404 responses MUST result in null metadata values
- Timeout errors MUST result in null metadata values
- Malformed HTML MUST be handled gracefully (regex parsing)
- All errors MUST be logged with correlationId for debugging

### NFR-4: Observability
- Worker MUST emit log messages for:
  - Job dispatch (correlationId, linkId, url)
  - Job completion (correlationId, duration, metadata found)
  - Job failure (correlationId, error reason)
- Worker pool MUST expose metrics for monitoring
- Logs MUST follow structured format for log aggregation

### NFR-5: Security
- Worker MUST follow redirects (max 5 hops)
- Worker MUST NOT execute JavaScript from target URLs
- Worker MUST respect `robots.txt` (optional, future enhancement)
- Worker MUST sanitize extracted values to prevent XSS

---

## 4. User-Facing Scenarios

### S-1: Link Created from Extension
**Given** A user creates a link via the Chrome Extension
**When** The link is saved without OG metadata
**Then** The OG metadata worker is dispatched in background
**And** Metadata is extracted within 10 seconds
**And** Link preview displays rich card with title, description, and image

### S-2: Link Created from Dashboard
**Given** A user creates a link from the dashboard
**When** The link is saved with empty OG fields
**Then** The worker fetches metadata from the target URL
**And** The next page refresh shows the updated metadata
**And** The user sees "Metadata extracted successfully" (optional toast)

### S-3: Link Created with Manual Metadata
**Given** A user creates a link and manually enters OG metadata
**When** The link is saved with populated og_title, og_description, og_image
**Then** The worker is still dispatched (idempotent)
**And** Auto-extracted metadata overwrites manual entries (design decision)
**Alternative**: Worker checks if metadata exists and skips extraction

### S-4: Bulk Import from Browser
**Given** A user imports 100 bookmarks from Chrome/Firefox
**When** All links are created in batch
**Then** 100 OG metadata workers are dispatched
**And** Workers process links concurrently (pool manages load)
**And** All metadata is extracted within 2 minutes

---

## 5. Technical Scenarios

### TS-1: Happy Path — Successful Extraction
**Input**:
```json
{
  "type": "OG_METADATA",
  "correlationId": "og-metadata-123-1712580000000",
  "payload": {
    "linkId": 123,
    "url": "https://example.com/article"
  }
}
```

**Expected Flow**:
1. Worker receives message
2. Fetches URL with 5s timeout
3. Parses HTML response
4. Extracts OG tags:
   - `og:title`: "Amazing Article"
   - `og:description`: "This is a great article about..."
   - `og:image`: "https://example.com/cover.jpg"
5. Returns result:
```json
{
  "type": "OG_METADATA",
  "correlationId": "og-metadata-123-1712580000000",
  "status": "ok",
  "data": {
    "linkId": 123,
    "ogTitle": "Amazing Article",
    "ogDescription": "This is a great article about...",
    "ogImage": "https://example.com/cover.jpg",
    "extractedAt": "2026-04-08T12:00:00.000Z"
  }
}
```
6. Worker pool calls `updateLinkOgMetadata(123, "Amazing Article", "...", "https://example.com/cover.jpg")`
7. Database is updated
8. Log: "[worker-pool] og worker job completed (duration: 1234ms)"

### TS-2: Timeout Scenario
**Input**: URL takes > 5 seconds to respond

**Expected Flow**:
1. Worker initiates fetch with 5s timeout
2. Timeout fires after 5s
3. AbortController aborts the fetch
4. Worker catches AbortError
5. Returns result with null values:
```json
{
  "type": "OG_METADATA",
  "correlationId": "og-metadata-123-1712580000000",
  "status": "ok",
  "data": {
    "linkId": 123,
    "ogTitle": null,
    "ogDescription": null,
    "ogImage": null,
    "extractedAt": "2026-04-08T12:00:05.000Z"
  }
}
```
6. Database is updated with NULL values
7. Log: "[worker-pool] og worker job completed (duration: 5000ms)"

### TS-3: 404 Not Found
**Input**: URL returns HTTP 404

**Expected Flow**:
1. Worker fetches URL
2. Response status is 404
3. Worker checks `response.ok` (false)
4. Returns null values (same as timeout)
5. Database updated with NULL values
6. Log: "[og-metadata-worker] URL returned 404 for link 123"

### TS-4: Malformed HTML
**Input**: URL returns HTML without OG tags

**Expected Flow**:
1. Worker fetches URL successfully
2. Parses HTML with regex
3. No OG tags found
4. Returns null values for all fields
5. Database updated with NULL values
6. Log: "[og-metadata-worker] No OG metadata found for link 123"

### TS-5: Worker Crash
**Input**: Worker throws unhandled exception

**Expected Flow**:
1. Worker crashes during extraction
2. Worker pool detects crash via `onerror` handler
3. Worker pool logs error
4. Worker pool restarts worker after 5s delay
5. Job is NOT retried (fire-and-forget)
6. Log: "[worker-pool] og worker crashed — restarting in 5s"

### TS-6: Metadata Already Exists
**Input**: Link created with manual OG metadata

**Expected Flow**:
1. User creates link with `ogTitle: "My Custom Title"`
2. Link is saved to database with custom metadata
3. Worker is dispatched
4. Worker extracts metadata from URL
5. Worker returns `ogTitle: "Original Page Title"`
6. Database is UPDATED (overwrites custom title)

**Design Decision**: Should worker skip extraction if metadata exists?
- **Option A**: Always overwrite (simpler, ensures metadata is fresh)
- **Option B**: Skip if `og_title IS NOT NULL` (preserves manual edits)
- **Recommendation**: Option A for MVP, Option B as enhancement

---

## 6. Edge Cases

### EC-1: Non-HTML Content
**Input**: URL returns PDF, image, or video

**Expected Behavior**:
- Check `Content-Type` header
- If not `text/html` or `application/xhtml+xml`, return null values immediately
- DO NOT attempt to parse binary content

### EC-2: Relative OG Image URL
**Input**: `og:image` is `/path/to/image.jpg` (relative)

**Expected Behavior**:
- Resolve relative URLs against the base URL
- Return absolute URL: `https://example.com/path/to/image.jpg`
- Handle protocol-relative URLs: `//cdn.example.com/image.jpg`

### EC-3: Unicode and Special Characters
**Input**: OG title contains emojis, accented characters

**Expected Behavior**:
- Preserve all Unicode characters in extracted values
- Sanitize only for SQL injection (parameterized queries handle this)
- DO NOT HTML-encode values (database stores raw text)

### EC-4: Empty OG Values
**Input**: `og:title=""` (empty string)

**Expected Behavior**:
- Normalize empty strings to `null`
- Do not store empty strings in database

### EC-5: Multiple OG Tags
**Input**: HTML has multiple `og:title` tags

**Expected Behavior**:
- Return the FIRST match (regex behavior)
- Future enhancement: merge or validate duplicates

### EC-6: Malformed URL
**Input**: URL is `not-a-url` or `htp://missing-protocol`

**Expected Behavior**:
- Validate URL before fetching
- If invalid, return null values immediately
- Log: "[og-metadata-worker] Invalid URL for link 123"

### EC-7: URL with Fragment
**Input**: URL is `https://example.com#section`

**Expected Behavior**:
- Fragment is included in the fetch request (browser behavior)
- Most servers ignore fragments, but worker should preserve it

### EC-8: URL with Query Parameters
**Input**: URL is `https://example.com?utm_source=twitter`

**Expected Behavior**:
- Fetch the exact URL with parameters
- OG metadata might vary based on query params (correct behavior)

---

## 7. Database Schema

### Links Table (Existing Columns)
```sql
ALTER TABLE links ADD COLUMN og_title TEXT;
ALTER TABLE links ADD COLUMN og_description TEXT;
ALTER TABLE links ADD COLUMN og_image TEXT;
```

**Note**: Columns already exist — no migration needed.

### Update Function Signature
```typescript
export function updateLinkOgMetadata(
  linkId: number,
  ogTitle: string | null,
  ogDescription: string | null,
  ogImage: string | null
): Phase4ServiceResult<void>;
```

---

## 8. API Changes

### No API Changes Required
This is a background worker with no new endpoints. Existing endpoints remain unchanged:
- `POST /api/links` — No changes (worker dispatched internally)
- `PUT /api/links/:id` — No changes (worker dispatched if URL changes)
- `GET /api/links/:id` — No changes (returns updated metadata when available)

---

## 9. Testing Requirements

### Unit Tests
1. **Worker Logic** (`og-metadata.worker.test.ts`):
   - Test successful OG extraction with mock HTML
   - Test timeout scenario with AbortController
   - Test 404 response handling
   - Test malformed HTML parsing
   - Test empty/null value normalization
   - Test relative URL resolution
   - Test retry logic for transient failures

2. **Service Function** (`links.service.test.ts`):
   - Test `updateLinkOgMetadata()` with valid data
   - Test `updateLinkOgMetadata()` with null values
   - Test idempotency (multiple calls with same data)
   - Test database error handling

3. **Worker Pool Integration** (`pool.test.ts`):
   - Test OG message dispatch
   - Test result handling and validation
   - Test worker crash and restart
   - Test metrics tracking

### Integration Tests
1. **End-to-End Flow**:
   - Create link via API
   - Verify worker is dispatched
   - Wait for worker completion (max 10s)
   - Fetch link via API
   - Verify OG metadata is populated

2. **Error Scenarios**:
   - Create link with invalid URL
   - Verify worker returns null values
   - Verify database columns are NULL
   - Verify no crashes or errors

### Manual Testing
1. Create link from extension
2. Open dashboard after 5 seconds
3. Verify link card shows OG metadata
4. Test with various URLs:
   - Twitter/X post
   - YouTube video
   - News article
   - PDF file
   - Broken URL

---

## 10. Rollout Plan

### Phase 1: Development (Day 1)
1. Create `og-metadata.worker.ts`
2. Add `OG_METADATA` to `WorkerMessageType` enum
3. Create `updateLinkOgMetadata()` service function
4. Write unit tests

### Phase 2: Integration (Day 1-2)
1. Add og worker to WorkerPool
2. Add og job to `dispatchCreateLinkWorkers()`
3. Add result handling in pool
4. Write integration tests

### Phase 3: Testing (Day 2)
1. Manual testing with real URLs
2. Performance testing (100 concurrent workers)
3. Error scenario testing
4. Fix bugs

### Phase 4: Deployment (Day 2-3)
1. Deploy to staging
2. Monitor logs and metrics
3. Deploy to production
4. Monitor for 24 hours

---

## 11. Monitoring and Metrics

### Key Metrics
- `og_worker.dispatched_total` — Counter of jobs dispatched
- `og_worker.completed_total` — Counter of successful completions
- `og_worker.failed_total` — Counter of failures
- `og_worker.duration_seconds` — Histogram of job duration
- `og_worker.metadata_found_total` — Counter of links with any OG metadata found

### Alerts
- **High Failure Rate**: If failure rate > 50% for 5 minutes
- **High Duration**: If p95 duration > 10 seconds
- **Worker Crash Loop**: If worker restarts > 3 times in 1 minute

### Logging
- Structured JSON logs with:
  - `correlationId` — For tracing
  - `linkId` — For debugging
  - `url` — For analytics
  - `durationMs` — For performance
  - `metadataFound` — Boolean, for success rate

---

## 12. Future Enhancements

### Priority 2 (Post-MVP)
1. **Conditional Extraction**: Skip if metadata already exists
2. **Manual Refresh**: Add "Refresh Metadata" button in UI
3. **Retry Queue**: Store failed jobs for retry
4. **Deduplication**: Cache results by URL to avoid re-fetching

### Priority 3 (Nice to Have)
1. **Twitter Card Meta**: Extract `twitter:card` tags
2. **Schema.org**: Extract JSON-LD structured data
3. **Favicon Extraction**: Extract and store favicon URL
4. **Screenshot Generation**: Capture page screenshot (Puppeteer)

---

## 13. Dependencies

### Existing Dependencies
- `bun:sqlite` — Database access (via service layer)
- `link-preview-metadata.ts` — Metadata extraction logic (reuse)

### New Dependencies
- None required (uses existing `fetch` and regex)

---

## 14. Open Questions

1. **Overwrite Behavior**: Should worker overwrite manually entered metadata?
   - **Recommendation**: Yes, for MVP. Add check later as enhancement.

2. **Retry on Failure**: Should failed jobs be retried?
   - **Recommendation**: No, for MVP. Add retry queue later.

3. **Deduplication**: Should we cache results by URL?
   - **Recommendation**: No, for MVP. Many URLs have dynamic metadata.

4. **Timeout Value**: Is 5 seconds too short/long?
   - **Recommendation**: 5s is good balance. Make configurable via env var.

5. **Worker Priority**: Should OG worker have higher priority than reader-mode?
   - **Recommendation**: No, all workers have equal priority (fire-and-forget).

---

## 15. Success Criteria

The OG metadata worker is considered complete when:
- ✅ Worker extracts OG metadata for valid URLs
- ✅ Worker handles timeouts and 404s gracefully
- ✅ Worker does not block link creation
- ✅ Worker pool manages worker lifecycle (crash, restart)
- ✅ Database is updated with extracted metadata
- ✅ All unit tests pass
- ✅ All integration tests pass
- ✅ Manual testing confirms functionality
- ✅ Metrics and logging are implemented
- ✅ Documentation is updated

---

**End of Specifications**
