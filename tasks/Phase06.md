# Tasks: Phase 6 - MCP Server & Web Skill

> **Change**: Implement MCP Server (Model Context Protocol) for AI agent integration and Web Skill for external search/extraction
> **Focus**: MCP protocol + API key auth + FTS5 search + metadata extraction

---

## Phase 6: MCP Server & Web Skill

### 6.0 Architecture checkpoint: MCP protocol + skill endpoints

- [x] 6.0.1 Review MCP protocol specification (JSON-RPC 2.0 based) and document expected request/response format
- [x] 6.0.2 Verify API key infrastructure from Phase 4.9 is ready: `backend/db/queries/api-keys.ts` lookup method exists
- [x] 6.0.3 Create `backend/mcp/types.ts` defining MCP request/response types, tool definitions, and error codes
- [x] 6.0.4 Document convention: MCP server lives at `/mcp` endpoint, requires `Authorization: Bearer <api_key>` header
- [x] 6.0.5 Create architecture doc in `backend/mcp/README.md` explaining tool registration pattern

#### 6.0 Architecture checklist (required per MCP server)

- [x] MCP server handles JSON-RPC 2.0 messages (`jsonrpc: "2.0"`, `method`, `params`, `id`)
- [x] Tools registered via `tools` object with `description`, `inputSchema` (JSON Schema)
- [x] API key validated on every request; 401 on invalid/missing key
- [x] Tools call services (`links.service`, etc.) never bypass to DB layer
- [x] Web Skill endpoints follow REST pattern: `/api/skill/search`, `/api/skill/extract/:id`, `/api/skill/lookup`

#### 6.0 Evidence

- [x] `backend/mcp/types.ts` exports: `MCPRequest`, `MCPResponse`, `MCPTool`, `MCPToolDefinition`
- [x] `backend/mcp/README.md` documents tool registration and auth flow
- [x] API key lookup from Phase 4.9 is reusable (no duplicate logic)

**Acceptance Criteria**
- MCP protocol is machine-verifiable (JSON-RPC 2.0 compliance)
- All tools follow the same registration pattern
- Web Skill endpoints are RESTful and consistent with existing API

---

### 6.1 Create `backend/mcp/server.ts` with MCP protocol implementation

- [x] 6.1.1 Create `backend/mcp/server.ts` as Bun HTTP server entry at `/mcp` route
- [x] 6.1.2 Implement JSON-RPC 2.0 parser: validate `jsonrpc: "2.0"`, `method`, `id` fields
- [x] 6.1.3 Add API key extraction from `Authorization: Bearer <key>` header
- [x] 6.1.4 Call `apiKeys.service.verifyKey(key)` to validate and get user context
- [x] 6.1.5 Return `401 Unauthorized` if key missing/invalid with JSON-RPC error format
- [x] 6.1.6 Implement `tools/list` method returning all registered tools (for AI discovery)
- [x] 6.1.7 Implement `tools/call` method to invoke specific tool by name with params
- [x] 6.1.8 Add error handler for malformed JSON-RPC requests (parse error, method not found)

#### 6.1 Evidence

```bash
# Test MCP server health
curl -X POST http://localhost:3000/mcp \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer urlk_xxxxxxxx" \
  -d '{"jsonrpc":"2.0","method":"tools/list","id":1}'
```

- [x] `GET /mcp` (or health check) returns MCP server info
- [x] Invalid API key returns 401 with JSON-RPC error
- [x] Valid request returns JSON-RPC response with `result` or `error`

**Acceptance Criteria**
- MCP server accepts JSON-RPC 2.0 requests
- API key auth blocks unauthorized access
- Returns proper JSON-RPC error responses on failure

---

### 6.2 Implement MCP tools: create_link, get_links, get_link, update_link, delete_link, search_links, get_categories

- [x] 6.2.1 Create `backend/mcp/tools/links.ts` with tool definitions using `MCPToolDefinition` format
- [x] 6.2.2 Implement `create_link` tool: calls `links.service.createLink()` with params validation
- [x] 6.2.3 Implement `get_links` tool: calls `links.service.getLinks()` with optional filters (user context)
- [x] 6.2.4 Implement `get_link` tool: calls `links.service.getLinkById()` for single link
- [x] 6.2.5 Implement `update_link` tool: calls `links.service.updateLink()` with ownership check
- [x] 6.2.6 Implement `delete_link` tool: calls `links.service.deleteLink()` with ownership check
- [x] 6.2.7 Create `backend/mcp/tools/search.ts` implementing `search_links` tool via FTS5
- [x] 6.2.8 Create `backend/mcp/tools/categories.ts` implementing `get_categories` tool
- [x] 6.2.9 Register all tools in `backend/mcp/server.ts` tools registry
- [x] 6.2.10 Add input validation for each tool using Zod or manual validation
- [x] 6.2.11 Map service errors to JSON-RPC error codes (invalid params -> -32602, internal error -> -32603)

#### 6.2 Evidence

```bash
# Test create_link tool
curl -X POST http://localhost:3000/mcp \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer urlk_xxxxxxxx" \
  -d '{"jsonrpc":"2.0","method":"tools/call","params":{"name":"create_link","input":{"url":"https://example.com","title":"Example"}},"id":2}'

# Test get_links tool
curl -X POST http://localhost:3000/mcp \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer urlk_xxxxxxxx" \
  -d '{"jsonrpc":"2.0","method":"tools/call","params":{"name":"get_links","input":{"limit":10}},"id":3}'
```

- [x] All 7 tools respond with proper JSON-RPC results
- [x] Invalid input returns error -32602 (Invalid params)
- [x] Unauthorized access returns error -32601 (Method not found) or -32001 (Auth error)
- [x] Ownership checks prevent modifying other user's links

**Acceptance Criteria**
- All 7 MCP tools are registered and functional
- Each tool validates input before calling service
- Service errors are properly mapped to JSON-RPC errors

---

### 6.3 Create `backend/skill/search.ts` with full-text search using FTS5

- [x] 6.3.1 Create `backend/skill/search.ts` with GET endpoint `/api/skill/search`
- [x] 6.3.2 Accept query params: `q` (search term), `category_id`, `user_id`, `limit`, `offset`
- [x] 6.3.3 Use FTS5 via `db/queries/search.ts` (verify exists from Phase 2)
- [x] 6.3.4 Return results with link metadata (id, title, url, description, category, created_at)
- [x] 6.3.5 Add optional auth: if API key provided, filter to user's links; if not, search public only
- [x] 6.3.6 Add rate limiting: apply same limits as regular API routes

#### 6.3 Evidence

```bash
# Public search (no auth)
curl "http://localhost:3000/api/skill/search?q=javascript&limit=10"

# Authenticated search (user's links)
curl "http://localhost:3000/api/skill/search?q=javascript" \
  -H "Authorization: Bearer urlk_xxxxxxxx"
```

- [x] `/api/skill/search` returns FTS5 results
- [x] Authenticated requests filter to user's links only
- [x] Unauthenticated requests search public links only
- [x] Rate limiting applies to endpoint

**Acceptance Criteria**
- FTS5 query returns relevant results with ranking
- Auth flow correctly filters public vs user-specific results
- Endpoint follows REST conventions

---

### 6.4 Create `backend/skill/extract.ts` with link metadata extraction endpoint

- [x] 6.4.1 Create `backend/skill/extract.ts` with GET endpoint `/api/skill/extract/:id`
- [x] 6.4.2 Fetch link by ID (check visibility: public or owned by requester)
- [x] 6.4.3 Return link metadata: id, url, title, description, og_title, og_description, og_image, category
- [x] 6.4.4 Create `backend/skill/extract.ts` with GET endpoint `/api/skill/lookup` for URL-based lookup
- [x] 6.4.5 Accept `url` param, search links by exact URL match
- [x] 6.4.6 Return same metadata format as `/extract/:id`
- [x] 6.4.7 Add auth checks: unauthenticated users can only access public links

#### 6.4 Evidence

```bash
# Extract by ID
curl "http://localhost:3000/api/skill/extract/123"

# Lookup by URL
curl "http://localhost:3000/api/skill/lookup?url=https://example.com"
```

- [x] `/api/skill/extract/:id` returns link metadata
- [x] `/api/skill/lookup` finds link by exact URL match
- [x] Private links require auth or return 404
- [x] Both endpoints follow REST conventions

**Acceptance Criteria**
- Extract returns complete link metadata
- Lookup provides URL-based discovery
- Visibility rules enforced (public vs private)

---

## Implementation Order

**Execute sequentially**: 6.0 → 6.1 → 6.2 → 6.3 → 6.4

**Rationale**:
- `6.0` must be first — defines MCP types and verifies API key infrastructure
- `6.1` (server) is prerequisite for `6.2` (tools) — tools need server to register with
- `6.2` (tools) provides the MCP interface that wraps existing services
- `6.3` (search) and `6.4` (extract) are independent REST endpoints but depend on Phase 2 FTS5

**Test-first guidance per tool**:
Write the tool definition first, then the implementation that satisfies the definition.

---

**Total Sub-Tasks**: 26 across 5 parent tasks  
**Dependencies**: Phase 4 complete (API keys), Phase 2 complete (FTS5), Phase 5 complete (workers don't directly affect this phase but are in place)
