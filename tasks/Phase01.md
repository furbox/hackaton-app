# Tasks: Phase 1 — Foundation Setup

> **Change**: Initialize URLoft project core infrastructure  
> **Focus**: Project structure, build tooling, and development environment

---

## Phase 1: Foundation Setup

### 1.1 Initialize Bun Project Structure

- [x] 1.1.1 Create `package.json` with Bun runtime (`"type": "module"`, `"engines": { "bun": ">=1.0" }`)
- [x] 1.1.2 Initialize SvelteKit frontend: `bunx sv create frontend --template skeleton --types typescript --no-prettier --no-eslint --no-playwright --no-vitest`
- [x] 1.1.3 Create backend directory structure: `mkdir -p backend/{db,routes,middleware,services,emails,mcp,skill}`
- [x] 1.1.4 Create public directory: `mkdir -p public/icons`
- [x] 1.1.5 Verify: Run `bun --version` confirms >=1.0, `frontend/svelte.config.js` exists, and all directories created via `ls -la backend/ frontend/`

### 1.2 Install and Configure Tailwind CSS v4

- [x] 1.2.1 Install dependencies: `bun add -D tailwindcss @tailwindcss/vite`
- [x] 1.2.2 Create `frontend/app.css` with `@import "tailwindcss";`
- [x] 1.2.3 Create `vite.config.ts` (or update if exists) to import `tailwindcss` from `@tailwindcss/vite`
- [x] 1.2.4 Add optional theme customization in `app.css`: `@theme { --color-primary: #6366f1; }`
- [x] 1.2.5 Verify: Build runs without CSS errors (`bun run build`)

### 1.3 Configure package.json Scripts

- [x] 1.3.1 Add `"dev": "bun run --hot index.ts"` script for development server
- [x] 1.3.2 ~~Add `"build": "bun build src/backend/index.ts --outdir dist"`~~ → REMOVED (Bun doesn't need build for backend)
- [x] 1.3.3 Add `"test": "bun test"` script for test runner
- [x] 1.3.4 Add `"db:setup": "bun run db/setup.ts"` script to initialize SQLite
- [x] 1.3.5 Verify: Each script runs without errors (test with `bun run {script-name}`)

---

## Implementation Order

**Execute sequentially**: 1.1 → 1.2 → 1.3  
Each task depends on the previous completing successfully.

**Why this order**:
1. Project structure must exist before installing packages
2. Tailwind requires Vite config, which depends on package.json scripts being ready
3. Scripts tie everything together for the dev workflow

---

## Next Steps

After completing Phase 1, proceed to:
- **Phase 2**: SvelteKit frontend setup (`frontend/src/routes/`, Svelte 5 Runes)
- **Phase 3**: SQLite database schema and migrations (`backend/db/`)
- **Phase 4**: Bun.serve HTTP server with routing (`backend/routes/`)

---

**Total Tasks**: 14 sub-tasks across 3 main groups  
**Estimated Time**: 30-45 minutes  
**Dependencies**: None (can start immediately)
