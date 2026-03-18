# CLAUDE.md

Project context for Claude AI assistant.

## Project: urloft.site

A multi-user link management web application where users can:
- Create short URLs with custom names
- Organize links into categories
- Like and favorite public links
- Track analytics (views, likes, saves)
- Earn rank badges based on public link count
- Customize public profiles

## Architecture

### Backend (apps/backend)
- **Runtime**: Bun
- **Framework**: Elysia (plugin-based architecture)
- **Database**: SQLite in WAL mode for concurrency
- **Auth**: JWT access tokens (24h expiry, no refresh tokens in v1)
- **Email**: Resend for verification and password resets

### Frontend (apps/frontend)
- **Framework**: SvelteKit
- **Styling**: Tailwind CSS
- **State**: Svelte stores (auth, toast)
- **API Client**: Custom fetch wrapper with JWT injection

### Database
- **Users**: id, username, email, email_verified, password_hash, avatar_url, bio, rank
- **Links**: id, user_id, name, url, short_code, is_public, likes_count, saves_count, views_count
- **Categories**: id, user_id, name, description (unique per user)
- **Link_Categories**: pivot table for many-to-many
- **Link_Logs**: id, link_id, ip_hash, action, created_at (view/like/favorite tracking)
- **User_Badges**: id, user_id, badge_type, earned_at (cumulative badges)
- **Email_Verifications**: id, user_id, token, expires_at, used_at

### Key Features

#### Short URL Generation
- Uses `nanoid(7)` for 7-character alphanumeric codes
- Collision retry: up to 3 attempts
- Unique constraint on `short_code` in database
- Redirect endpoint: `GET /r/:code` → 302 to original URL

#### Rank System
Based on total public link count:
- Iron: >= 1
- Bronze: >= 10
- Silver: >= 100
- Gold: >= 1,000
- Diamond: >= 1,000,000

Ranks are recalculated on link create/delete. Badges are cumulative (never removed).

#### Social Features
- **Likes**: Authenticated users can like any public link (once per user)
- **Favorites**: Authenticated users can save/bookmark links
- **Visit Logging**: Every redirect logs IP hash (SHA-256) for analytics
- Privacy: Private links are only accessible to owner

### Module Structure

Each backend module follows this pattern:
```
apps/backend/src/modules/{domain}/
├── {domain}.service.ts    # Business logic
├── {domain}.controller.ts # HTTP handlers
└── {domain}.routes.ts     # Route definitions + Elysia plugin
```

Current modules:
- `auth` - Registration, login, email verification, password recovery
- `users` - Profile management, public profiles
- `links` - CRUD, short URL generation, redirect
- `categories` - Per-user category management
- `logs` - Visit/like/favorite tracking
- `stats` - Top links by period, per-link analytics
- `badges` - Rank calculation, badge awarding

### API Endpoints

#### Auth (`/api/auth`)
- `POST /register` - User registration
- `POST /login` - Login (returns JWT)
- `GET /verify?token=` - Email verification
- `POST /forgot-password` - Send reset email
- `POST /reset-password` - Reset password

#### Users (`/api/users`)
- `GET /me` - Get own profile (auth)
- `PATCH /me` - Update profile (auth)
- `GET /:username` - Public profile

#### Links (`/api/links`)
- `GET /` - List own links (auth, paginated)
- `POST /` - Create link (auth)
- `GET /:id` - Get link detail (auth)
- `PATCH /:id` - Update link (auth)
- `DELETE /:id` - Delete link (auth)
- `POST /:id/like` - Like link
- `DELETE /:id/like` - Unlike link
- `POST /:id/favorite` - Favorite link
- `DELETE /:id/favorite` - Unfavorite link

#### Redirect (public)
- `GET /r/:code` - Short URL redirect (302)

#### Categories (`/api/categories`)
- `GET /` - List categories (auth)
- `POST /` - Create category (auth)
- `PATCH /:id` - Update category (auth)
- `DELETE /:id` - Delete category (auth, supports `?force=true`)
- `POST /:id/links` - Add link to category (auth)
- `DELETE /:id/links/:linkId` - Remove link from category (auth)

#### Stats (`/api/stats`)
- `GET /top?period=&metric=` - Top links (public)
- `GET /link/:id?period=` - Per-link analytics (auth, owner)

#### Badges (`/api/badges`)
- `GET /me` - Own badges (auth)
- `GET /:username` - User badges (public)

### Frontend Routes

- `/` - Homepage (public)
- `/stats` - Top links page (public)
- `/[username]` - Public profile (public)
- `/r/[code]` - Short URL redirect (server route, 302)
- `/auth/login` - Login form
- `/auth/register` - Registration form
- `/auth/verify` - Email verification landing
- `/auth/reset` - Password reset form
- `/dashboard` - Link management (auth)
- `/dashboard/links/new` - Create link (auth)
- `/dashboard/links/[id]` - Link detail + analytics (auth)
- `/dashboard/categories` - Category management (auth)
- `/dashboard/profile` - Profile edit (auth)

### Important Implementation Details

1. **Email Verification Flow**:
   - User registers → email_verified=0
   - Email sent with verification link
   - User clicks → GET /api/auth/verify?token= → email_verified=1
   - Unverified users cannot login (403 error)

2. **Password Reset Flow**:
   - POST /api/auth/forgot-password → generates token (1h expiry)
   - Email sent with reset link
   - User submits new password → POST /api/auth/reset-password
   - Token marked as used after successful reset

3. **Privacy**:
   - Public links: accessible to anyone via short URL
   - Private links: 403 for non-owners, even with correct short code
   - Visit logs only created for public link redirects

4. **IP Hashing**:
   - Raw IPs are NEVER stored
   - SHA-256 hash used for deduplication in link_logs
   - For authenticated actions, hash userId.toString() instead

5. **Pagination**:
   - All list endpoints support `?page=1&limit=20`
   - Max limit: 50
   - Response: `{ data: [], meta: { page, limit, total } }`

6. **Error Format**:
   - All errors: `{ error: "code", message: "human readable", details: {} }`
   - HTTP status codes follow REST conventions

### Environment Variables

Required:
- `DATABASE_PATH` - Path to SQLite database (default: `./data/hackaton.db`)
- `JWT_SECRET` - Secret for JWT signing (HS256)
- `RESEND_API_KEY` - Resend email service API key
- `EMAIL_FROM` - From address for emails
- `APP_URL` - Public URL of the app
- `PORT` - Backend port (default: 3000)

Frontend:
- `PUBLIC_API_URL` - Backend API base URL
- `PUBLIC_APP_URL` - Frontend public URL

### Coding Conventions

- **TypeScript**: Strict mode, no implicit any
- **File naming**: kebab-case for files (e.g., `auth.service.ts`)
- **Import order**: 1) Node/bun, 2) Workspace, 3) Relative
- **Database queries**: Always use prepared statements
- **Security**: 
  - Use `Bun.password.hash(password, "argon2id")` for passwords
  - Validate input on both client and server
  - Parameterized queries only
  - No secrets in code

### Common Gotchas

1. **JWT in Elysia**: Use `@elysiajs/jwt` plugin + custom derive for auth guard
2. **SQLite WAL**: Required for concurrent reads + writes
3. **Foreign keys**: Must enable with `PRAGMA foreign_keys = ON`
4. **Short code collisions**: Retry loop in `generateShortCode()`
5. **SvelteKit server routes**: Export `GET`/`POST` functions from `+server.ts`
6. **Bun install**: Run from root to install workspace dependencies

### Development Workflow

1. Make changes to code
2. Backend: `bun run backend` (auto-restarts)
3. Frontend: `bun run frontend` (HMR enabled)
4. Database changes: Update `schema.ts` and provide migration
5. Always test API endpoints before updating frontend

### Git Strategy

- Main branch: `main` (protected)
- Feature branches: `phase/1-core`, `phase/2-links`, etc.
- Merge via PR only
- Tag releases: `v0.1.0`, `v0.2.0`, etc.

### Known Limitations (v1)

- No refresh tokens (re-login after 24h)
- Avatar is URL-only (no upload yet)
- No real-time features
- No i18n
- No OAuth providers

This context should help you understand the codebase and make informed decisions.
