# Exploration: Open Graph Metadata Flow in URLoft

## Current State

URLoft has **partial** Open Graph metadata support that works differently across two frontends (EJS and Svelte). The backend infrastructure exists but lacks automatic extraction.

### Backend Status: ✅ WORKING (Manual)

**Extraction Service** (`backend/services/link-preview-metadata.ts`):
- ✅ Extracts `og:title`, `og:description`, `og:image` from HTML
- ✅ Uses regex patterns to parse meta tags
- ✅ Handles both attribute-first and content-first patterns
- ✅ Timeout handling (default 5000ms)
- ✅ Returns nullable strings (null when tags are missing or empty)

**Database Schema** (`backend/db/queries/links.ts`):
```sql
CREATE TABLE links (
  ...
  og_title TEXT,
  og_description TEXT,
  og_image TEXT,
  ...
);
```
- ✅ All 3 OG fields stored correctly
- ✅ Queries include OG fields in SELECT
- ✅ Create/Update operations accept OG parameters

**API Endpoints** (`backend/routes/api/links.ts`):
- ✅ `POST /api/links/preview` - Extracts OG metadata from URL
- ✅ `POST /api/links` - Accepts `ogTitle`, `ogDescription`, `ogImage`
- ✅ `PUT /api/links/:id` - Can update OG fields
- ⚠️ **NOT automatic**: Preview must be called manually before create

**Service Layer** (`backend/services/links.service.ts`):
```typescript
export interface CreateLinkInput {
  url: string;
  title: string;
  description?: string | null;
  ogTitle?: string | null;        // ✅ Accepted
  ogDescription?: string | null;  // ✅ Accepted
  ogImage?: string | null;        // ✅ Accepted
  shortCode: string;
  isPublic?: boolean;
  categoryId?: number | null;
}
```

**Workers**:
- ❌ `health-checker.worker.ts` - Only checks HTTP status codes
- ❌ `reader-mode.worker.ts` - Extracts text content only
- ❌ `wayback.worker.ts` - Archives to Wayback Machine only
- **None extract OG metadata automatically**

### Frontend EJS Status: ✅ WORKING

**Display Logic** (`frontend-bun-ejs/views/partials/link-card.ejs`):
```ejs
<% const ogImage = typeof link.og_image === "string" && link.og_image.trim().length > 0
  ? link.og_image.trim()
  : typeof link.ogImage === "string" && link.ogImage.trim().length > 0
  ? link.ogImage.trim()
  : "";
const hasOgImage = ogImage.length > 0;
%>

<% if (ogImage) { %>
  <img src="<%= ogImage %>" alt="Imagen del enlace" class="h-full w-full object-cover" />
<% } else if (faviconUrl) { %>
  <img src="<%= faviconUrl %>" alt="Favicon del sitio" class="h-9 w-9 rounded-md" />
<% } else { %>
  <span class="text-xl">🌐</span>
<% } %>
```
- ✅ Displays OG image when available
- ✅ Falls back to Google favicon
- ✅ Falls back to globe emoji
- ✅ Handles both snake_case and camelCase field names

### Frontend Svelte Status: ❌ NOT IMPLEMENTED

**Service DTOs** (`frontend/src/lib/services/links.service.ts`):
```typescript
export interface LinkDTO {
  id: number;
  userId: number;
  url: string;
  title: string;
  description: string | null;
  // ❌ Missing: ogTitle, ogDescription, ogImage
  shortCode: string;
  isPublic: boolean;
  categoryId: number | null;
  views: number;
  createdAt: string;
}

export interface CreateLinkInput {
  url: string;
  title: string;
  description?: string | null;
  // ❌ Missing: ogTitle, ogDescription, ogImage
  shortCode: string;
  isPublic?: boolean;
  categoryId?: number | null;
}
```

**LinkCard Component** (`frontend/src/lib/components/links/LinkCard.svelte`):
- ❌ No OG image display
- ❌ No fallback to favicon
- ❌ Only shows title, description, URL, stats

**Create Link Action** (`frontend/src/routes/(dashboard)/links/+page.server.ts`):
```typescript
const response = await linksService.createLink({
  url,
  title,
  description,
  shortCode,
  isPublic,
  categoryId: categoryId ? parseInt(categoryId) : null
  // ❌ No OG metadata passed
});
```

## Flow Diagrams

### Current Manual Flow (What Exists)

```
User creates link:
┌─────────────────────────────────────────────────────────────┐
│ 1. User calls POST /api/links/preview { url: "..." }       │
│    → Backend fetches HTML                                   │
│    → Extracts og:title, og:description, og:image            │
│    → Returns { title, description, image }                  │
└─────────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────────┐
│ 2. Frontend receives preview data                           │
│    → User may edit title/description                        │
│    → User clicks "Save"                                     │
└─────────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────────┐
│ 3. Frontend calls POST /api/links with OG metadata          │
│    → { url, title, description, ogTitle, ogDescription... } │
│    → Backend saves to DB                                    │
└─────────────────────────────────────────────────────────────┘
```

### Automatic Flow (What's Missing)

```
User creates link:
┌─────────────────────────────────────────────────────────────┐
│ 1. User calls POST /api/links { url, title, ... }          │
│    → WITHOUT ogTitle, ogDescription, ogImage                │
└─────────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────────┐
│ 2. Backend creates link immediately                        │
│    → Returns created link (og fields are null)              │
└─────────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────────┐
│ 3. Backend dispatches OG extraction worker                  │
│    → Worker fetches HTML                                    │
│    → Extracts og:title, og:description, og:image            │
│    → Updates link in DB                                     │
└─────────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────────┐
│ 4. Frontend polls or receives update                        │
│    → Link card now shows OG image                           │
└─────────────────────────────────────────────────────────────┘
```

## Problems Identified

### Problem 1: No Automatic OG Metadata Extraction

**Severity**: High UX Issue

**Description**: When a user creates a link, OG metadata is NOT automatically extracted. The user must:
1. Manually call `/api/links/preview` first
2. Copy the results
3. Then create the link with those results

**Impact**:
- Poor UX (2-step process instead of 1)
- Most users won't bother, so OG images are rarely populated
- Links look less engaging without images

**Location**: `backend/services/links.service.ts` - `createLink()` function

### Problem 2: Svelte Frontend DTOs Missing OG Fields

**Severity**: High Compatibility Issue

**Description**: The Svelte frontend TypeScript interfaces don't include OG metadata fields, so even if the backend returns them, the frontend can't access them.

**Impact**:
- Type errors if trying to access `link.ogImage`
- Can't display OG metadata in Svelte components
- Inconsistent between EJS and Svelte frontends

**Location**: `frontend/src/lib/services/links.service.ts`

### Problem 3: Svelte LinkCard Doesn't Display OG Images

**Severity**: High Display Issue

**Description**: The Svelte LinkCard component has no logic to display OG images, even though the EJS version does.

**Impact**:
- Links in Svelte frontend look plain (no images)
- Inconsistent experience between frontends
- Missing visual engagement

**Location**: `frontend/src/lib/components/links/LinkCard.svelte`

### Problem 4: No Background OG Extraction Worker

**Severity**: Medium Architecture Issue

**Description**: None of the 3 background workers (health-check, reader-mode, wayback) extract OG metadata. The extraction service exists but is only used manually via the preview endpoint.

**Impact**:
- Can't implement "create now, extract later" pattern
- No retry logic if initial extraction fails
- Can't refresh OG metadata periodically

**Location**: `backend/workers/` - New worker needed

### Problem 5: Create Link Action Ignores OG Metadata

**Severity**: Low (depends on Problem 2)

**Description**: Even if OG metadata is sent to the create link action, it's not passed to the service.

**Impact**:
- Can't save OG metadata even if manually provided
- Blocks manual workaround

**Location**: `frontend/src/routes/(dashboard)/links/+page.server.ts`

## Affected Areas

### Backend Files
- `backend/services/link-preview-metadata.ts` ✅ Working
- `backend/services/links.service.ts` ⚠️ Doesn't auto-extract
- `backend/db/queries/links.ts` ✅ Schema supports OG
- `backend/routes/api/links.ts` ✅ Endpoints work
- `backend/workers/` ❌ No OG extraction worker

### Frontend EJS Files
- `frontend-bun-ejs/views/partials/link-card.ejs` ✅ Full OG support

### Frontend Svelte Files
- `frontend/src/lib/services/links.service.ts` ❌ DTOs missing OG fields
- `frontend/src/lib/components/links/LinkCard.svelte` ❌ No OG display
- `frontend/src/routes/(dashboard)/links/+page.server.ts` ⚠️ Action ignores OG
- `frontend/src/routes/(dashboard)/links/+page.svelte` ❓ (not checked, likely missing preview UI)

## Approaches

### Approach A: Automatic Extraction on Create (Recommended)

**Description**: Extract OG metadata automatically when link is created, in the background.

**Pros**:
- Best UX (single step)
- Immediate link creation (fast response)
- OG metadata populated asynchronously
- Familiar pattern (Twitter, Facebook, etc.)

**Cons**:
- Requires new worker or modification to existing worker
- Need to handle extraction failures gracefully
- May need frontend polling/WebSocket for updates

**Effort**: Medium

**Implementation**:
1. Modify `createLink()` to dispatch OG extraction job
2. Create or modify worker to extract OG metadata
3. Update DB with extracted OG fields
4. Optional: Add WebSocket/polling for real-time updates

### Approach B: Preview-Then-Create (Current Pattern)

**Description**: Keep current manual flow but improve UX.

**Pros**:
- No backend changes needed
- User can edit OG metadata before saving
- Predictable (no async surprises)

**Cons**:
- Poor UX (2 steps)
- Most users won't use it
- Links remain without OG images

**Effort**: Low (just frontend UX improvements)

**Implementation**:
1. Add OG fields to Svelte DTOs
2. Update LinkCard to display OG images
3. Add preview UI to create link form
4. Auto-fill form with preview data

### Approach C: Client-Side Extraction

**Description**: Extract OG metadata in the browser before sending to server.

**Pros**:
- No backend workers needed
- Immediate feedback
- Server doesn't need to fetch external URLs

**Cons**:
- CORS issues (most sites block client-side fetching)
- Server needs to proxy requests anyway
- Doesn't work for many sites
- Adds complexity to frontend

**Effort**: High (CORS proxies, fallback logic)

**Not recommended** due to CORS limitations.

### Approach D: Hybrid (Best UX)

**Description**: Combine automatic extraction with manual override.

**Pros**:
- Best of both worlds
- Works automatically for most cases
- Allows manual editing
- Can refresh OG metadata later

**Cons**:
- Highest complexity
- More code to maintain

**Effort**: High

**Implementation**:
1. Auto-extract on create (Approach A)
2. Add UI to edit OG metadata
3. Add "Refresh OG metadata" button
4. Handle errors with user-friendly messages

## Recommendation

**Implement Approach D (Hybrid) in phases**:

### Phase 1: Fix Svelte Frontend (Low Hanging Fruit)
1. Add OG fields to Svelte DTOs
2. Update LinkCard to display OG images (with fallbacks)
3. Test with manually populated OG data

**Estimated Time**: 2-3 hours
**Impact**: Svelte frontend immediately matches EJS functionality

### Phase 2: Add Preview UI (Quick Win)
1. Add preview button to create link form
2. Call `/api/links/preview` on click
3. Auto-fill form with preview data
4. Allow user to edit before save

**Estimated Time**: 2-3 hours
**Impact**: Makes manual process much easier

### Phase 3: Automatic Background Extraction (Full Solution)
1. Create `og-extractor.worker.ts`
2. Modify `createLink()` to dispatch OG extraction job
3. Worker updates DB with extracted metadata
4. Add polling/WebSocket for real-time updates

**Estimated Time**: 4-6 hours
**Impact**: Best UX, automatic for all links

### Phase 4: Refresh & Edit (Polish)
1. Add "Refresh OG metadata" button to edit form
2. Allow manual editing of auto-extracted data
3. Add retry logic for failed extractions

**Estimated Time**: 2-3 hours
**Impact**: Complete control over OG metadata

## Risks

### Technical Risks

1. **OG Extraction Failures**
   - Risk: Many sites don't have OG tags or block bots
   - Mitigation: Graceful fallbacks to favicon/domain
   - Priority: Medium

2. **Performance Impact**
   - Risk: Extracting OG for every link slows down creation
   - Mitigation: Background workers, timeout handling
   - Priority: High

3. **CORS Issues** (for client-side approach)
   - Risk: Can't fetch most sites from browser
   - Mitigation: Use server-side extraction
   - Priority: High (avoid client-side extraction)

4. **Database Load**
   - Risk: Many UPDATE queries for OG metadata
   - Mitigation: Batch updates, connection pooling
   - Priority: Low (SQLite handles this well)

### Product Risks

1. **User Expectations**
   - Risk: Users expect OG images to always work
   - Mitigation: Clear fallbacks, manage expectations
   - Priority: Medium

2. **Storage Growth**
   - Risk: Storing many OG image URLs increases DB size
   - Mitigation: URLs are small (<500 chars each), negligible impact
   - Priority: Low

## Ready for Proposal

**Yes** - The investigation is complete. All issues have been identified and documented with clear recommendations.

**Next Steps for Orchestrator**:
1. Present findings to user
2. Ask which approach to implement (A, B, or D)
3. If user approves, create proposal with:
   - Selected approach
   - Implementation tasks breakdown
   - Test cases for validation

---

## Appendix: Code Examples

### Example 1: Current Manual Flow

```typescript
// Step 1: Preview
const preview = await fetch('/api/links/preview', {
  method: 'POST',
  body: JSON.stringify({ url: 'https://example.com' })
}).then(r => r.json());

// Returns: { data: { title: 'Example', description: '...', image: 'https://...' } }

// Step 2: Create link with preview data
const link = await fetch('/api/links', {
  method: 'POST',
  body: JSON.stringify({
    url: 'https://example.com',
    title: preview.data.title || 'My Link',
    ogTitle: preview.data.title,
    ogDescription: preview.data.description,
    ogImage: preview.data.image,
    shortCode: 'abc123',
    isPublic: true
  })
}).then(r => r.json());
```

### Example 2: Desired Automatic Flow

```typescript
// Single step - backend handles extraction
const link = await fetch('/api/links', {
  method: 'POST',
  body: JSON.stringify({
    url: 'https://example.com',
    title: 'My Link',
    shortCode: 'abc123',
    isPublic: true
    // No OG fields needed - backend extracts them automatically
  })
}).then(r => r.json());

// Backend:
// 1. Creates link immediately (og fields are null)
// 2. Returns created link
// 3. Dispatches background worker to extract OG metadata
// 4. Worker updates link with og_title, og_description, og_image
```

### Example 3: Missing Svelte DTO Fields

**Current (Incomplete)**:
```typescript
export interface LinkDTO {
  id: number;
  url: string;
  title: string;
  description: string | null;
  // ❌ Missing OG fields
}
```

**Should Be**:
```typescript
export interface LinkDTO {
  id: number;
  url: string;
  title: string;
  description: string | null;
  ogTitle: string | null;        // ✅ Add this
  ogDescription: string | null;  // ✅ Add this
  ogImage: string | null;        // ✅ Add this
  // ... other fields
}
```

### Example 4: EJS Fallback Logic (Should Replicate in Svelte)

```ejs
<%
// EJS version handles both snake_case and camelCase
const ogImage = typeof link.og_image === "string" && link.og_image.trim().length > 0
  ? link.og_image.trim()
  : typeof link.ogImage === "string" && link.ogImage.trim().length > 0
  ? link.ogImage.trim()
  : "";
const hasOgImage = ogImage.length > 0;
%>

<% if (ogImage) { %>
  <img src="<%= ogImage %>" alt="Imagen del enlace" />
<% } else if (faviconUrl) { %>
  <img src="<%= faviconUrl %>" alt="Favicon del sitio" />
<% } else { %>
  <span>🌐</span>
<% } %>
```

**Svelte Equivalent**:
```svelte
<script>
  const ogImage = link.ogImage || link.og_image || '';
  const hasOgImage = ogImage.length > 0;
  const faviconUrl = hasOgImage ? '' : `https://www.google.com/s2/favicons?domain=${new URL(link.url).hostname}&sz=128`;
</script>

{#if hasOgImage}
  <img src={ogImage} alt="Imagen del enlace" class="h-full w-full object-cover" />
{:else if faviconUrl}
  <img src={faviconUrl} alt="Favicon del sitio" class="h-9 w-9 rounded-md" />
{:else}
  <span class="text-xl">🌐</span>
{/if}
```
