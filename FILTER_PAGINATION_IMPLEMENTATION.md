# Filter and Pagination System - Implementation Summary

## Overview

Created a **reusable filter and pagination system** that can be shared between `/dashboard/links` and `/dashboard/favorites`. This eliminates code duplication and provides consistent UX across both pages.

## What Was Built

### 1. Utility Module: `src/utils/query-helpers.ts`

Generic functions for handling link filtering, sorting, and pagination:

**Type Definitions:**
- `LinkQuery` - Query interface with q, categoryId, sort, page, limit
- `LinkSort` - Supported sorting: "recent" | "likes" | "views" | "favorites"
- `Link` - Link interface (handles both snake_case and camelCase)
- `Category` - Category interface

**Core Functions:**

```typescript
// Query parsing
parsePositiveInt(value: string | null, fallback: number): number
normalizeSort(value: string | null, allowed?: LinkSort[]): LinkSort
buildQueryFromUrl(url: URL, allowedSorts?: LinkSort[]): LinkQuery

// URL building
buildBaseUrl(path: string, query: Omit<LinkQuery, 'page'>): string
buildApiPath(path: string, query: LinkQuery): string

// Data processing
unwrapArray<T>(payload: unknown): T[]
sortLinks(items: Link[], sort: LinkSort): Link[]
unwrapLinks(payload: unknown): Link[]
normalizeLink(raw: unknown): Link | null
normalizeCategories(payload: unknown): Category[]

// Error handling
extractErrorMessage(payload: unknown, fallback: string): string
```

### 2. Reusable Partial: `views/partials/filter-bar.ejs`

A form-based filter bar with:
- Search input (configurable placeholder)
- Category dropdown
- Sort dropdown (recent, likes, views, favorites)
- Limit dropdown (6, 12, 24, 36 per page)
- Apply button
- Clear link

**Usage in EJS:**
```ejs
<%- include('../../partials/filter-bar', {
  searchPlaceholder: 'Buscar links...',
  categories: categories,
  query: query,
  action: '/dashboard/links'
}) %>
```

### 3. Updated Controllers

Both `favorites.controller.ts` and `links.controller.ts` now:
- Import utilities from `../../utils/query-helpers.ts`
- Parse query params with `buildQueryFromUrl()`
- Apply client-side filtering (by search term and category)
- Sort results with `sortLinks()`
- Paginate results
- Build pagination URL with `buildBaseUrl()`

### 4. Updated Views

Both `favorites.ejs` and `links.ejs` now:
- Include the filter bar partial
- Show empty states for filtered results
- Include pagination partial
- Handle load errors gracefully

### 5. Test Suite: `test/query-helpers.test.ts`

20 test cases covering:
- Query parsing and validation
- Sort normalization
- Link sorting (by likes, views, favorites, recent)
- Link normalization (snake_case ↔ camelCase)
- Array unwrapping from various API formats
- URL building for API and pagination

All tests pass: ✅ 20/20

## How to Use

### Adding Filter/Pagination to a New Page

1. **Import utilities in your controller:**
```typescript
import {
  buildQueryFromUrl,
  buildApiPath,
  buildBaseUrl,
  sortLinks,
  unwrapLinks,
  normalizeCategories,
  type LinkQuery,
  type Link,
  type Category,
} from "../../utils/query-helpers.ts";
```

2. **Parse query from request URL:**
```typescript
const requestUrl = new URL(req.url);
const query = buildQueryFromUrl(requestUrl);
const selectedCategoryId = Number.parseInt(query.categoryId, 10) || 0;
```

3. **Fetch data from API:**
```typescript
const result = await apiFetch<Link[]>(
  buildApiPath("/api/your-endpoint", query),
  { method: "GET" },
  req
);
```

4. **Apply client-side filtering:**
```typescript
let items = unwrapLinks(result.data);
const searchTerm = query.q.toLowerCase();

if (searchTerm.length > 0) {
  items = items.filter((link) => {
    const title = (link.title ?? "").toLowerCase();
    const url = (link.url ?? "").toLowerCase();
    return title.includes(searchTerm) || url.includes(searchTerm);
  });
}

if (selectedCategoryId > 0) {
  items = items.filter((link) => link.category_id === selectedCategoryId);
}

items = sortLinks(items, query.sort);
```

5. **Paginate results:**
```typescript
const totalFiltered = items.length;
const totalPages = Math.max(1, Math.ceil(totalFiltered / query.limit));
const page = Math.min(query.page, totalPages);
const start = (page - 1) * query.limit;
items = items.slice(start, start + query.limit);
const hasNextPage = page < totalPages;
```

6. **Build base URL for pagination:**
```typescript
const baseUrl = buildBaseUrl("/your-page", { ...query, page: query.page });
```

7. **Pass data to view:**
```typescript
return renderPage("your-page", {
  data: {
    items,
    categories,
    query: { ...query, page },
    totalPages,
    hasNextPage,
    baseUrl,
    totalItems: allItems.length,
    totalFiltered,
  },
});
```

8. **Include filter bar in view:**
```ejs
<%- include('../../partials/filter-bar', {
  searchPlaceholder: 'Search...',
  categories: categories,
  query: query,
  action: '/your-page'
}) %>
```

9. **Include pagination:**
```ejs
<%- include('../../partials/pagination', {
  page: query.page,
  totalPages: totalPages,
  hasNextPage: hasNextPage,
  baseUrl: baseUrl
}) %>
```

## Key Design Decisions

1. **Client-side filtering**: Backend doesn't fully support query params yet, so we fetch all items and filter in the controller. This provides immediate UX while backend catches up.

2. **Dual case support**: Normalization handles both `snake_case` and `camelCase` because the API is inconsistent. This makes the system resilient to API changes.

3. **Empty state handling**: Both "no items at all" and "no items matching filters" are handled with appropriate messaging.

4. **Preserved filters**: Pagination URLs preserve all filters (q, categoryId, sort, limit) via `buildBaseUrl()`.

5. **Test coverage**: 20 test cases ensure the utilities work correctly and catch regressions early.

## Benefits

✅ **DRY principle**: Single source of truth for filtering logic
✅ **Consistency**: Same UX across links and favorites pages
✅ **Maintainability**: Changes to filter logic only need to be made once
✅ **Testability**: Utilities are pure functions, easy to test
✅ **Extensibility**: Easy to add to new pages (see guide above)
✅ **Type safety**: Full TypeScript support with proper interfaces

## Files Modified

- ✅ Created `src/utils/query-helpers.ts` (380 lines)
- ✅ Created `views/partials/filter-bar.ejs` (58 lines)
- ✅ Updated `src/controllers/dashboard/favorites.controller.ts` (refactored to use utilities)
- ✅ Updated `src/controllers/dashboard/links.controller.ts` (added filtering/pagination)
- ✅ Updated `views/pages/dashboard/favorites.ejs` (uses filter-bar partial)
- ✅ Updated `views/pages/dashboard/links.ejs` (uses filter-bar + pagination)
- ✅ Created `test/query-helpers.test.ts` (187 lines, 20 tests)

## Testing

Run tests with:
```bash
cd frontend-bun-ejs
bun test test/query-helpers.test.ts
```

All tests pass: 20/20 ✅
