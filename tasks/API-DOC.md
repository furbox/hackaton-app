# Tasks: Generate API Documentation (`documentacion/api-doc.md`)

## Phase 1: Structure & Fundamentals

- [x] 1.1 Create `documentacion/api-doc.md` with headers, intro, and architecture overview (Sessions vs API Keys).
- [x] 1.2 Document Global Error Codes and standard response format (Phase 4 Contract).

## Phase 2: Authentication & User Management

- [x] 2.1 Document Auth endpoints: Register, Login, Verify, Resend, Forgot/Reset Password, Logout (Method, Body, Responses).
- [x] 2.2 Document User Profile (`/api/users/:username`) and Stats endpoints (`/api/stats/me`, `/api/stats/global`).

## Phase 3: Core Resources (Links & Categories)

- [x] 3.1 Document Links CRUD: List/Search, Create, Update, Delete with visibility and actor rules.
- [x] 3.2 Document Link Interactions: Toggle Like, Toggle Favorite, and Preview metadata.
- [x] 3.3 Document Categories management: CRUD and link assignment.

## Phase 4: Integration & Advanced Protocols

- [x] 4.1 Document API Keys management (`/api/keys`) and "How to use" guide (Auth header).
- [x] 4.2 Document MCP Server: JSON-RPC protocol, `/mcp` endpoint, and 7 tools description.
- [x] 4.3 Document Web Skill endpoints: `/api/skill/search`, `/api/skill/extract/:id`, `/api/skill/lookup`.

## Phase 5: Administration & Security

- [x] 5.1 Document Admin endpoints: Set Role, Ban/Unban, Impersonation.
- [x] 5.2 Document Audit Logs (`/api/audit-log`, `/api/admin/audit-log`) and Security features (Rate Limiting).
- [x] 5.3 Final review of consistency, response examples, and markdown formatting.
