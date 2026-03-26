# MCP Architecture (Phase 6.0)

This directory defines the protocol contract and registration conventions for the MCP server integration.

## Endpoint and auth convention

- Endpoint: `POST /mcp`
- Auth header: `Authorization: Bearer <api_key>`
- Every request must validate API key via `backend/services/api-keys.service.ts` (`verifyApiKey`), which reuses `backend/db/queries/api-keys.ts` lookup logic (`getActiveApiKeyByHash`).
- Missing, invalid, or expired key returns HTTP `401` with JSON-RPC error payload using MCP auth error code.

## JSON-RPC request/response contract

MCP uses JSON-RPC 2.0 message shape:

```json
{
  "jsonrpc": "2.0",
  "method": "tools/list",
  "params": {},
  "id": 1
}
```

Success response:

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "result": {}
}
```

Error response:

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "error": {
    "code": -32600,
    "message": "Invalid request"
  }
}
```

Types are defined in `backend/mcp/types.ts`.

## Tool registration pattern

- Register tools in a single `tools` map keyed by tool name.
- Each tool must provide:
  - `name`
  - `description`
  - `inputSchema` (JSON Schema object)
  - `handler(input, context)`
- Tool handlers must call service-layer use cases (for example `links.service.ts`, `categories.service.ts`) and never query DB directly.
- Tool input validation failures map to JSON-RPC `-32602` (`INVALID_PARAMS`).

## Web Skill route conventions

Phase 6 keeps REST endpoints under:

- `GET /api/skill/search`
- `GET /api/skill/extract/:id`
- `GET /api/skill/lookup`

These routes follow backend architecture `route -> service -> db` and share the same API key verification service path when bearer auth is used.
