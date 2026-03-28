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

### Frontend API Boundary (Strategy in Production)

For web pages/actions, frontend uses a single boundary:

`views/actions (+page/+page.server/+server) -> lib/services/* -> /api/proxy/* -> backend /api/*`

This means:
- UI never calls backend `/api/*` directly.
- Cookie/session forwarding is centralized in proxy handlers.
- Error normalization is centralized in `frontend/src/lib/server/proxy-forward.ts` and `frontend/src/lib/services/response.ts`.

#### Where to implement a new endpoint (frontend side)
1. Add backend contract (`backend/routes/*` + service layer).
2. Add mapping in `frontend/src/lib/server/proxy-map.ts`.
3. Add proxy route file in `frontend/src/routes/api/proxy/**/+server.ts`.
4. Expose route constant in `frontend/src/lib/services/contracts.ts`.
5. Add/extend domain service in `frontend/src/lib/services/*.service.ts`.
6. Consume from page load/action (`+page.server.ts`) or endpoint (`+server.ts`).

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

**Email verification link behavior (current):**
- Email link points to frontend route: `${FRONTEND_URL}/auth/verify/:token`.
- User lands on `frontend/src/routes/auth/verify/[token]/+page.server.ts`.
- That page calls `GET /api/proxy/auth/verify/:token`, which forwards to backend `GET /api/auth/verify/:token`.

**Request Body:**
```json
{
  "email": "user@example.com",
  "password": "securepassword123",
  "name": "johndoe"
}
```

**Field Notes:**
- `name`: Represents the **username/pseudonym** (not full name). Must be unique across all users. Used for public profiles (e.g., `/u/johndoe`).

### Login
`POST /api/auth/login`
Authenticates a user and starts a session.

In frontend flow, login is executed via server action in `frontend/src/routes/auth/login/+page.server.ts`, using `authService.login()` against `/api/proxy/auth/login`.

**Request Body:**
```json
{
  "email": "user@example.com",
  "password": "securepassword123",
  "rememberMe": false
}
```

**Field Notes:**
- `rememberMe` (optional): 
  - `true`: Creates a persistent session lasting **30 days**. Session cookie is stored across browser restarts.
  - `false` (default): Creates a temporary **session cookie** that expires when the browser is closed.

### Logout
`POST /api/auth/logout`
Terminates the current session.

### Forgot Password
`POST /api/auth/forgot-password`
Requests reset email delivery for the provided account.

**Reset link behavior (current):**
- Email link points to frontend route: `${FRONTEND_URL}/auth/reset-password/:token`.
- User lands on `frontend/src/routes/auth/reset-password/[token]/+page.server.ts`.
- Reset action calls `POST /api/proxy/auth/reset-password`, which forwards to backend `POST /api/auth/reset-password`.

### Verify Email
`GET /api/auth/verify/:token`
Consumes verification token and marks user email as verified.

### Reset Password
`POST /api/auth/reset-password`
Consumes reset token and updates password.

**Request Body:**
```json
{
  "token": "reset_token_from_email",
  "password": "new_secure_password"
}
```

**Field Notes:**
- `token`: The reset token received via email.
- `password`: The new password to set for the user account.

---

## 🔗 Links Management

### List/Search Links (Public Only)
`GET /api/links`
Returns a paginated list of **public links only**. Supports filtering and sorting.

**Important:** This endpoint **always returns only public links**, regardless of authentication. Even authenticated users will only see links where `isPublic = true`. This endpoint is used by the `/explore` page.

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

### Get My Links (All)
`GET /api/links/me` (Requires Auth)
Returns **all links** owned by the authenticated user, including both public and private links. Used by the `/dashboard/links` page.

**Query Parameters:**
- `sort` (optional): Sorting strategy. 
  - `recent` (default): Most recently created
  - `likes`: Most liked
  - `views`: Most viewed
  - `favorites`: Most favorited
- `limit` (optional): Maximum number of results to return. Default varies, typically 20-50.

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
      "favoritesCount": 8,
      "categoryId": 3,
      "createdAt": "2026-01-15T10:30:00Z"
    }
  ]
}
```

**Key Differences from GET /api/links:**
- Returns **user's private links** in addition to public ones
- No pagination (controlled by `limit` param)
- Includes `favoritesCount` field
- Used for dashboard management, not public exploration

### Get Link Details (Statistics)
`GET /api/links/:id/details` (Requires Auth - Owner Only)
Returns detailed statistics for a specific link, including view history, user lists for likes/favorites, and engagement analytics. Only the link owner can access this endpoint.

**Response:**
```json
{
  "link": {
    "id": 1,
    "title": "Bun - Fast all-in-one JavaScript runtime",
    "views": 150,
    "likesCount": 42,
    "favoritesCount": 8,
    "createdAt": "2026-01-15T10:30:00Z"
  },
  "viewsList": [
    {
      "id": 1,
      "ipAddress": "192.168.1.xxx",
      "userAgent": "Mozilla/5.0...",
      "visitedAt": "2026-03-28T14:25:00Z",
      "userId": null
    }
  ],
  "likedBy": [
    {
      "id": 5,
      "username": "alice",
      "avatarUrl": "https://..."
    }
  ],
  "favoritedBy": [
    {
      "id": 8,
      "username": "bob",
      "avatarUrl": "https://..."
    }
  ]
}
```

**Privacy Notes:**
- `ipAddress` is **anonymized** for privacy (last octet masked as `.xxx` or `.xxx.xxx` depending on IPv4/IPv6)
- `userId` is only present for authenticated users' visits (null for anonymous visitors)
- This endpoint is restricted to the link owner only

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
Returns private stats: total links, total views, total likes received, current rank, and rank progression.

**Response:**
```json
{
  "totalLinks": 45,
  "totalViews": 1250,
  "totalLikes": 89,
  "rank": "user",
  "rankProgression": {
    "currentRank": "user",
    "nextRank": "power_user",
    "currentLinks": 45,
    "requiredForNext": 50,
    "progressPercent": 90,
    "remainingLinks": 5
  }
}
```

**Rank Progression Fields:**
- `currentRank`: The user's current rank (e.g., `"newbie"`, `"user"`, `"power_user"`, `"expert"`)
- `nextRank`: The next rank to achieve (or `null` if already at maximum)
- `currentLinks`: Number of links created by the user
- `requiredForNext`: Number of links needed to reach the next rank
- `progressPercent`: Percentage progress toward next rank (0-100)
- `remainingLinks`: How many more links until the next rank (0 if already at max)

### Global Stats
`GET /api/stats/global`
Returns system-wide stats: total users, **all links** (public + private), and total categories.

**Response:**
```json
{
  "totalUsers": 150,
  "totalLinks": 3450,
  "totalCategories": 280
}
```

**Important Note:**
- `totalLinks` includes **ALL links** in the system (both public and private), not just public links.
- This differs from `GET /api/links` which only returns public links.
- Used for displaying global statistics on the home page.

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
