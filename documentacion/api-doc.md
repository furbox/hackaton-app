# URLoft - API Documentation

> **Technical specification of the URLoft REST API, MCP Server, and Web Skill.**
>
> 📖 **Architecture Overview**: This API follows the `Routes -> Services -> DB` pattern. Business logic is encapsulated in services, while routes handle HTTP concerns and dependency injection.

---

## 🏗 Fundamental Concepts

### Base URL
All API requests are made to:
`http://localhost:3000` (Development)
`https://api.urloft.site` (Production - TBD)

### Authentication
URLoft supports two authentication methods:

1.  **Stateful Sessions (Web/Browser)**:
    -   Handled via **Better Auth**.
    -   Cookies are used to maintain sessions.
    -   Required for dashboard and profile management.
2.  **API Keys (Automated/AI Agents)**:
    -   Passed in the `Authorization` header as a Bearer token:
        `Authorization: Bearer urlk_xxxxxx`
    -   Used for MCP Server and Web Skill integration.
    -   Keys are hashed in the database; only the prefix is stored in plain text.

### Roles & Permissions
-   **User**: Standard access to create links, categories, and manage their profile.
-   **Admin**: Special access to user management, audit logs, and system-wide stats.
-   **Newbie**: Default rank for newly registered users.

---

## 🛑 Error Handling (Phase 4 Contract)

All API errors follow a standardized format to ensure consistency across clients.

### Standard Error Response
```json
{
  "error": {
    "code": "ERROR_CODE",
    "message": "Human-readable explanation of what went wrong",
    "details": {} 
  }
}
```

### Common Error Codes
| Code | HTTP Status | Description |
| :--- | :--- | :--- |
| `VALIDATION_ERROR` | 400 | The request payload is malformed or contains invalid data. |
| `UNAUTHORIZED` | 401 | Authentication is missing or invalid. |
| `FORBIDDEN` | 403 | You don't have permission to perform this action. |
| `NOT_FOUND` | 404 | The requested resource (link, category, etc.) does not exist. |
| `CONFLICT` | 409 | Resource already exists (e.g., duplicate URL for the same user). |
| `RATE_LIMIT_EXCEEDED` | 429 | Too many requests. Check `Retry-After` header. |
| `INTERNAL_ERROR` | 500 | An unexpected server error occurred. |

---

## 🔐 Authentication Endpoints

### Register
`POST /api/auth/register`
Creates a new user account. Sends a verification email via Resend.

**Request Body:**
```json
{
  "email": "user@example.com",
  "password": "securepassword123",
  "name": "John Doe",
  "username": "johndoe"
}
```

### Login
`POST /api/auth/login`
Authenticates a user and starts a session.

**Request Body:**
```json
{
  "email": "user@example.com",
  "password": "securepassword123"
}
```

### Logout
`POST /api/auth/logout`
Terminates the current session.

---

## 🔗 Links Management

### List/Search Links
`GET /api/links`
Returns a paginated list of public links. Supports filtering and sorting.

**Query Parameters:**
- `q`: Search query (FTS5 powered).
- `categoryId`: Filter by category ID.
- `ownerUserId`: Filter by owner.
- `sort`: `recent` (default), `likes`, `views`, `favorites`.
- `page`: Page number.
- `limit`: Results per page.

**Response:**
```json
{
  "data": [
    {
      "id": 1,
      "url": "https://bun.sh",
      "title": "Bun - Fast all-in-one JavaScript runtime",
      "description": "Bun is a fast JavaScript runtime...",
      "shortCode": "bun-runtime",
      "isPublic": true,
      "likesCount": 42,
      "views": 105,
      "isLiked": true
    }
  ]
}
```

### Create Link
`POST /api/links` (Requires Auth)
Saves a new link. Automatically triggers background workers for health check and metadata extraction.

**Request Body:**
```json
{
  "url": "https://svelte.dev",
  "title": "Svelte • Cybernetically enhanced web apps",
  "shortCode": "svelte",
  "description": "Optional description",
  "categoryId": 5,
  "isPublic": true
}
```

### Update Link
`PUT /api/links/:id` (Requires Auth - Owner only)
Updates an existing link's metadata.

### Delete Link
`DELETE /api/links/:id` (Requires Auth - Owner only)
Deletes a link and removes it from FTS5 index.

### Interactions
- `POST /api/links/:id/like`: Toggles 'Like' for the link.
- `POST /api/links/:id/favorite`: Toggles 'Favorite' status.
- `POST /api/links/preview`: Injects a URL and returns extracted OG metadata (Title, Desc, Image) without saving.

---

## 📁 Categories

### List My Categories
`GET /api/categories` (Requires Auth)
Returns categories created by the authenticated user.

### Create Category
`POST /api/categories` (Requires Auth)
**Body:** `{ "name": "Programming", "color": "#6366f1" }`

---

## 👤 User & Profile

### Get Public Profile
`GET /api/users/:username`
Returns public info, stats, and public links of a user.

### Update Profile
`PUT /api/users/me` (Requires Auth)
**Body:** `{ "name": "New Name", "bio": "New Bio", "avatarUrl": "..." }`

### User Stats
`GET /api/stats/me` (Requires Auth)
Returns private stats: total links, total views, total likes received, and current rank.

### Global Stats
`GET /api/stats/global`
Returns system-wide stats: total users, total links, total categories.

---

## 🔑 API Keys Management

Endpoints to manage keys for MCP/Skill integrations.

- `GET /api/keys`: List active keys.
- `POST /api/keys`: Create a new key. Returns the plain text key **only once**.
- `DELETE /api/keys/:id`: Revokes a key.

---

## 🤖 MCP Server (Model Context Protocol)

URLoft exposes an MCP Server to allow AI agents (like Claude Desktop) to interact with your links directly.

- **Endpoint**: `POST /mcp`
- **Protocol**: JSON-RPC 2.0
- **Auth**: `Authorization: Bearer <api_key>`

### Exposed Tools
1. `create_link`: Create a new link.
2. `get_links`: List links with filters.
3. `get_link`: Get details by ID.
4. `update_link`: Edit a link.
5. `delete_link`: Remove a link.
6. `search_links`: Global search via FTS5.
7. `get_categories`: List user categories.

---

## 🔍 Web Skill

Specialized REST endpoints for high-performance extraction and lookup.

- `GET /api/skill/search?q=...`: Fast search for agents.
- `GET /api/skill/extract/:id`: Returns full content and metadata for a link.
- `GET /api/skill/lookup?url=...`: Check if a specific URL is already saved.

---

## 🛡 Administration & Security

### Admin Endpoints (Requires Admin Role)
- `PUT /api/admin/users/:id/role`: Change user rank (`newbie`, `user`, `admin`).
- `POST /api/admin/users/:id/ban`: Prevent user from logging in.
- `POST /api/admin/users/:id/unban`: Lift ban.
- `POST /api/admin/impersonate/:id`: Start session as another user (for debugging).
- `GET /api/admin/audit-log`: View global security events.

### Security Features
- **Rate Limiting**: Applied per IP and per API key. Default is 100 requests per minute.
- **Audit Logging**: Every sensitive action (login, password change, key creation) is logged in `audit_logs` table.
- **Fingerprinting**: Sessions are tied to IP and User-Agent hash.

---

## ⛓ Short Links Redirection

`GET /api/s/:code`
Redirects the user to the original URL and increments the `views` counter asynchronously.
