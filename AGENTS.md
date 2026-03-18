# AGENTS.md

Instructions for AI agents working on this project.

## Project Overview

**Project**: urloft.site  
**Type**: Monorepo (Bun workspaces)  
**Backend**: Elysia REST API + SQLite  
**Frontend**: SvelteKit + Tailwind  
**Repository**: https://github.com/furbox/hackaton-app

## Conventions

### Monorepo Structure
- Root `package.json` defines workspaces: `["apps/*"]`
- Each app (backend/frontend) has its own `package.json`
- Install dependencies from root: `bun install`
- Run app-specific commands: `bun run --cwd apps/backend <command>`

### Backend Conventions
- **Framework**: Elysia with plugin architecture
- **Module Structure**: Each domain has its own folder:
  - `apps/backend/src/modules/{domain}/` containing:
    - `{domain}.service.ts` - Business logic
    - `{domain}.controller.ts` - Request/response handling
    - `{domain}.routes.ts` - Route definitions
- **Middleware**: Located in `apps/backend/src/middleware/`
- **Database**: SQLite with `bun:sqlite`, WAL mode enabled
- **Schema**: All CREATE TABLE statements in `src/db/schema.ts`
- **Migrations**: Located in `src/db/migrations/` (versioned SQL files)

### Frontend Conventions
- **Routing**: File-based routing in `apps/frontend/src/routes/`
- **Styling**: Tailwind CSS - use utility classes
- **State Management**: Svelte stores in `src/lib/stores/`
- **API Client**: Located in `src/lib/api.ts`
- **Components**: Reusable components in `src/lib/components/`

### Code Style
- **TypeScript**: Strict mode enabled
- **Naming**: camelCase for variables, PascalCase for types/classes
- **Files**: kebab-case for filenames (e.g., `auth.service.ts`)
- **Imports**: Absolute imports from workspace roots (e.g., `@hackaton/backend`)

### Database Conventions
- **Client**: Singleton instance exported from `src/db/client.ts`
- **Queries**: Use prepared statements with parameter binding
- **Transactions**: Wrap multi-step operations in transactions
- **Indexes**: Create indexes for foreign keys and frequently queried fields

### API Conventions
- **Prefix**: All API routes start with `/api/`
- **Auth**: JWT access token in `Authorization: Bearer <token>` header
- **Error Format**: `{ error: "code", message: "human readable", details: {} }`
- **Pagination**: `{ data: [], meta: { page, limit, total } }`

### Security Rules
- **NEVER** commit `.env` files or secrets
- **ALWAYS** hash passwords with `Bun.password.hash(plain, "argon2id")`
- **ALWAYS** validate input on both client and server
- **NEVER** expose raw errors to clients
- **ALWAYS** use parameterized queries to prevent SQL injection

### Testing
- **Framework**: Tests are co-located with source files (e.g., `auth.test.ts`)
- **Runner**: `bun test` (when tests exist)
- **Coverage**: Aim for >80% on critical paths

## Workflow

When implementing features:
1. Read the spec to understand requirements
2. Read the design to understand architecture
3. Check existing code for patterns to follow
4. Implement following the conventions above
5. Test manually or with automated tests
6. Update documentation

## Useful Commands

```bash
# Install all dependencies
bun install

# Run backend
bun run backend

# Run frontend
bun run frontend

# Run both (dev mode)
bun run dev

# Type checking
bun run --cwd apps/backend tsc --noEmit
```

## Environment Variables

See `.env.example` for the complete list. Critical variables:
- `DATABASE_PATH` - SQLite database file path
- `JWT_SECRET` - Secret for JWT signing (generate a random string)
- `RESEND_API_KEY` - Email service API key
- `APP_URL` - Public URL of the app (e.g., http://localhost:5173 in dev)

## Module Checklist

When creating a new module:
- [ ] Create folder in `apps/backend/src/modules/{name}/`
- [ ] Create `{name}.service.ts` with business logic
- [ ] Create `{name}.controller.ts` for request/response handling
- [ ] Create `{name}.routes.ts` with route definitions
- [ ] Export routes plugin from `{name}.routes.ts`
- [ ] Mount routes in `apps/backend/src/index.ts`
- [ ] Add database schema to `src/db/schema.ts` if needed
- [ ] Create frontend stores/components in `apps/frontend/src/lib/`
- [ ] Create frontend pages in `apps/frontend/src/routes/`
- [ ] Update API documentation
