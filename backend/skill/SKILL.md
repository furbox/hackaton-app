---
name: urloft-url-search
description: Search, lookup, and extract URLoft links fast. Use this skill whenever the user asks to find a saved URL, inspect link metadata, or check whether a URL already exists in URLoft, even if they do not mention the API endpoints explicitly.
---

## Purpose

Use URLoft's skill endpoints to find links by text query, fetch metadata by link ID, or resolve a URL to its saved link record.

## When to Use

- User asks to find saved links, bookmarks, or URLs by keyword.
- User asks for details of a specific saved link (title, description, OG metadata, category).
- User asks if a concrete URL already exists in URLoft.
- User needs a quick list of matching links with IDs for follow-up actions.

## Required Inputs

- `base_url`: API origin, for example `http://localhost:3000`.
- One primary selector:
  - `q` for search
  - `id` for extract
  - `url` for lookup
- Optional filters for search: `category_id`, `user_id`, `limit`, `offset`.
- Optional `api_key` (Bearer token) when owner-scope/private visibility is required.

## Endpoint Playbook

### 1) Search links

`GET /api/skill/search`

Use for keyword or FTS-style search across saved links.

```bash
curl -s "${BASE_URL}/api/skill/search?q=typescript%20svelte&limit=20&offset=0"
```

With API key (owner scope):

```bash
curl -s "${BASE_URL}/api/skill/search?q=internal%20docs&user_id=42" \
  -H "Authorization: Bearer ${API_KEY}"
```

### 2) Extract metadata by link ID

`GET /api/skill/extract/:id`

Use when you already have a link ID and need canonical metadata.

```bash
curl -s "${BASE_URL}/api/skill/extract/123"
```

With API key (can include owner's private links):

```bash
curl -s "${BASE_URL}/api/skill/extract/123" \
  -H "Authorization: Bearer ${API_KEY}"
```

### 3) Lookup by exact URL

`GET /api/skill/lookup?url=...`

Use to check if a specific absolute URL is already saved.

```bash
curl -s --get "${BASE_URL}/api/skill/lookup" \
  --data-urlencode "url=https://example.com/article"
```

With API key:

```bash
curl -s --get "${BASE_URL}/api/skill/lookup" \
  --data-urlencode "url=https://example.com/article" \
  -H "Authorization: Bearer ${API_KEY}"
```

## Visibility and Auth Rules

- Without API key:
  - Only public links are visible.
  - `search` can optionally filter by `user_id`, but still public-only.
- With API key (`Authorization: Bearer <key>`):
  - Requests execute in owner scope for that API key user.
  - Private links of the owner are visible in addition to public links.
  - For `search`, if `user_id` is provided it must match the API key owner.

## Error Handling

- `400 Bad Request`: invalid or missing input (for example empty `q`, invalid `id`, bad `url`).
  - Next: fix inputs and retry once with corrected parameters.
- `401 Unauthorized`: invalid API key or malformed Authorization header.
  - Next: remove header for public-only access, or provide a valid Bearer key.
- `404 Not Found`: link not found or not visible to current auth scope.
  - Next: retry with correct ID/URL or with owner API key if private visibility is needed.
- `429 Too Many Requests`: rate limit hit.
  - Next: wait using `Retry-After` when present, then retry with backoff.
- `500 Internal Server Error`: backend/search failure.
  - Next: return a concise failure note and suggest retry; do not invent data.

## Output Contract

Always return a concise user-facing result with:

- A one-line summary (what was searched/looked up and how many matches).
- For each match: `id`, `title`, `url` (and category if present).
- If a single item (`extract` or `lookup`): include `id`, `url`, `title`, plus key metadata fields present.
- If no results: explicitly say `0 matches` and suggest the most useful next query/filter.
