# Tasks: Phase 2 — Database & Schema

> **Change**: Set up SQLite database layer with FTS5 search capability  
> **Focus**: Database schema, connection handling, migrations, and prepared queries

---

## Phase 2: Database & Schema

### 2.1 Create Schema File with All Tables

- [x] 2.1.1 Create `backend/db/schema.sql` file with header comment describing URLoft database schema
- [x] 2.1.2 Define `users` table: id, username, email, password_hash, avatar_url, bio, rank, email_verified, verification_token, created_at
- [x] 2.1.3 Define `password_resets` table: id, user_id, token, expires_at, used, created_at with FK to users
- [x] 2.1.4 Define `links` table: id, user_id, url, title, description, short_code, is_public, category_id, views, og_title, og_description, og_image, status_code, archive_url, content_text, created_at with FKs to users and categories
- [x] 2.1.5 Define `categories` table: id, user_id, name, color with FK to users
- [x] 2.1.6 Define `likes` table: user_id, link_id composite PK with FKs to users and links
- [x] 2.1.7 Define `favorites` table: user_id, link_id composite PK with FKs to users and links
- [x] 2.1.8 Define `sessions` table: id, user_id, token_jti, ip_address, user_agent, fingerprint, is_active, created_at, expires_at with FK to users
- [x] 2.1.9 Define `audit_logs` table: id, user_id, event, ip_address, user_agent, metadata, created_at with FK to users
- [x] 2.1.10 Define `api_keys` table: id, user_id, name, key_hash, key_prefix, permissions, last_used_at, expires_at, is_active, created_at with FK to users
- [x] 2.1.11 Add UNIQUE constraints: users(username), users(email), links(short_code), links(user_id, url), categories(user_id, name), api_keys(key_hash)
- [x] 2.1.12 Verify: Schema file exists with all 10 tables and correct FK relationships

### 2.2 Add FTS5 Full-Text Search Table

- [x] 2.2.1 Create `links_fts` virtual table in `backend/db/schema.sql` using FTS5 with columns: title, description, url, content_text
- [x] 2.2.2 Configure FTS5 to reference the main `links` table: `content='links'` and `content_rowid='id'`
- [x] 2.2.3 Verify: FTS5 table syntax is correct (`CREATE VIRTUAL TABLE links_fts USING fts5(...)`)

### 2.3 Create SQLite Triggers for FTS5 Sync

- [x] 2.3.1 Create `links_ai` (AFTER INSERT) trigger to insert new rows into `links_fts` when links are added
- [x] 2.3.2 Create `links_ad` (AFTER DELETE) trigger to delete rows from `links_fts` when links are removed
- [x] 2.3.3 Create `links_au` (AFTER UPDATE) trigger to delete old row and insert updated row in `links_fts`
- [x] 2.3.4 Add comment explaining triggers are required because SQLite FTS5 doesn't auto-update
- [x] 2.3.5 Verify: All three triggers use correct `new.id` / `old.id` syntax and reference correct columns

### 2.4 Create Database Connection Wrapper

- [x] 2.4.1 Create `backend/db/connection.ts` with named export `getDatabase()` function
- [x] 2.4.2 Import `Database` from `bun:sqlite` ( Bun's native SQLite module)
- [x] 2.4.3 Implement singleton pattern: create one Database instance, reuse on subsequent calls
- [x] 2.4.4 Enable foreign keys: execute `PRAGMA foreign_keys = ON;` immediately after opening database
- [x] 2.4.5 Add JSDoc comment explaining singleton pattern and FK requirement
- [x] 2.4.6 Verify: Function returns same Database instance on multiple calls, FK pragma is enabled

### 2.5 Create Migration and Initialization System

- [x] 2.5.1 Create `backend/db/migrations.ts` with `initializeDatabase()` function
- [x] 2.5.2 Read schema from `backend/db/schema.sql` using `Bun.file()` or fs.readFileSync()
- [x] 2.5.3 Execute schema SQL on database connection, split by semicolon if needed
- [x] 2.5.4 Enable WAL mode for better concurrency: `PRAGMA journal_mode=WAL;`
- [x] 2.5.5 Add error handling: catch SQLite errors and log with context
- [x] 2.5.6 Create `backend/db/setup.ts` entry point to run migrations when called via `bun run db:setup`
- [x] 2.5.7 Verify: Running `bun run db:setup` creates `database.sqlite` file with all tables and WAL files (-wal, -shm)

### 2.6 Create Prepared Statements for CRUD Operations

- [x] 2.6.1 Create `backend/db/queries.ts` with imports: `getDatabase` from connection.ts
- [x] 2.6.2 Define user queries: `createUser`, `getUserByEmail`, `getUserById`, `updateUser`, `verifyEmail`
- [x] 2.6.3 Define link queries: `createLink`, `getLinksByUser`, `getPublicLinks`, `getLinkById`, `updateLink`, `deleteLink`, `incrementViews`
- [x] 2.6.4 Define category queries: `createCategory`, `getCategoriesByUser`, `updateCategory`, `deleteCategory`
- [x] 2.6.5 Define interaction queries: `toggleLike`, `toggleFavorite`, `checkIfLiked`, `checkIfFavorited`
- [x] 2.6.6 Define FTS5 search query: `searchLinks` using `MATCH ?` against `links_fts`
- [x] 2.6.7 Use prepared statements via `.prepare()` and cache them for performance
- [x] 2.6.8 Add type annotations for query parameters and return types
- [x] 2.6.9 Verify: Each query compiles without TypeScript errors, prepared statements are reused

### 2.7 Write Database Schema Tests

- [x] 2.7.1 Create `backend/db/__tests__/schema.test.ts` using Bun test (`import { test, describe, expect } from "bun:test"`)
- [x] 2.7.2 Set up in-memory database for each test: `new Database(":memory:")` to avoid polluting real DB
- [x] 2.7.3 Write test "creates all tables" that verifies each table exists via `SELECT name FROM sqlite_master WHERE type='table'`
- [x] 2.7.4 Write test "enables foreign keys" that inserts into child table with invalid FK and expects error
- [x] 2.7.5 Write test "FTS5 triggers sync correctly" that inserts a link, then queries `links_fts` for the new row
- [x] 2.7.6 Write test "WAL mode is enabled" that checks `PRAGMA journal_mode` returns 'wal'
- [x] 2.7.7 Verify: All tests pass with `bun test backend/db/__tests__/schema.test.ts`

### 2.8 Database Maintenance & Verification (Add-on)

- [x] 2.8.1 Create `backend/db/verify.ts` with logic to verify DB connection and schema at startup
- [x] 2.8.2 Refactor `backend/index.ts` to use `verifyDatabaseConnection()` before starting HTTP server
- [x] 2.8.3 Move `database.sqlite` from root to `backend/db/` folder for better organization
- [x] 2.8.4 Implement "Forward Compatibility" by replacing all `db.exec()` with `db.run()`
- [x] 2.8.5 Fix `lastInsertRowid` access pattern (capture from `db.run()` return object)


---

## Implementation Order

**Execute sequentially**: 2.1 → 2.2 → 2.3 → 2.4 → 2.5 → 2.6 → 2.7  
Each task depends on the previous completing successfully.

**Why this order**:
1. Schema (2.1-2.3) defines the data model — everything else depends on this
2. Connection wrapper (2.4) provides the database access layer
3. Migrations (2.5) apply the schema to create actual tables
4. Queries (2.6) depend on tables existing from migrations
5. Tests (2.7) verify the entire system works end-to-end

**Critical notes**:
- Don't skip triggers (2.3) — FTS5 search won't work without them
- Foreign keys MUST be enabled (2.4) or CASCADE deletes will fail silently
- Use in-memory DB for tests (2.7) to avoid breaking development database

---

## Next Steps

After completing Phase 2, proceed to:
- **Phase 3**: Authentication layer with Better Auth (`backend/auth/`)
- **Phase 4**: Core backend API endpoints (`backend/routes/api/`)
- **Phase 5**: Background workers for async processing (`backend/workers/`)

---

**Total Tasks**: 42 sub-tasks across 7 main groups  
**Estimated Time**: 2-3 hours  
**Dependencies**: Phase 1 must be complete (project structure exists)
