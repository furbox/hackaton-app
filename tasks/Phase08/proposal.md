# Proposal: Phase 8 - Frontend Public Pages

## Intent

Construir todas las páginas públicas de URLoft que no requieren autenticación, permitiendo que usuarios anónimos descubran contenido, exploren links y vean perfiles públicos. Sin estas páginas, la plataforma es invisible al mundo exterior y no hay funnel de adquisición de usuarios.

## Scope

### In Scope

- **Home page (`/`)**: Landing con hero section, links destacados (top 6 por likes), top usuarios (por actividad) y stats globales
- **Explore page (`/explore`)**: Buscador full-text con filtros (sort por likes/views/favorites/recientes, categoría, paginación)
- **Perfiles públicos (`/u/:username`)**: Avatar, bio, rango, stats y links del usuario con tabs de filtrado
- **Auth flows**: Login, registro, verificación de email, forgot password y reset password
- **Integración API**: Consumo de endpoints públicos documentados en `documentacion/api-doc.md`
- **SEO**: Metadatos dinámicos en todas las páginas para indexado (title, description, og:image)

### Out of Scope

- **Dashboard pages**: Gestión de links, categorías, API keys, favoritos (Phase 10)
- **Real-time features**: Websockets o actualizaciones en vivo
- **PWA offline**: Service worker y cache strategy (fase posterior)
- **Internacionalización (i18n)**: Todo en español por ahora

## Approach

### Technical Strategy

**SvelteKit SSR para SEO + Client-Side Interactivity**

- Páginas públicas usan `ssr=true` (default) para renderizado en servidor y SEO
- Auth usan server actions para form submissions type-safe
- Estado de filtros sincronizado con URL params para navegación shareable
- Fetch revalidate estratégico (stats por hora, links por 15 min)

### Component Architecture

```
frontend/src/
├── routes/
│   ├── +page.svelte                    # Home
│   ├── explore/
│   │   └── +page.svelte                # Explore con filtros
│   ├── u/[username]/
│   │   └── +page.svelte                # Perfil público
│   └── auth/
│       ├── login/+page.svelte
│       ├── register/+page.svelte
│       ├── verify/[token]/+page.svelte
│       ├── forgot-password/+page.svelte
│       └── reset-password/[token]/+page.svelte
└── lib/components/
    ├── home/
    │   ├── HeroSection.svelte
    │   ├── FeaturedLinks.svelte
    │   └── TopUsers.svelte
    ├── explore/
    │   ├── SearchBar.svelte
    │   ├── FilterSidebar.svelte
    │   └── Pagination.svelte
    └── auth/
        └── AuthFormWrapper.svelte
```

### Data Flow

```
User Request → SvelteKit Server Load → API Bun (SQLite) → SSR Render → Client Hydrate
```

**Home**: `load()` calls `GET /api/stats/global` + `GET /api/links?sort=likes&limit=6`
**Explore**: URL params → `load()` → `GET /api/links` con filtros
**Profile**: `params.username` → `load()` → `GET /api/users/:username`
**Auth**: Form POST → Server Action → `POST /api/auth/*` → Cookie/Redirect

### Key Patterns

- **Revalidate strategy**: `fetch(url, { method: 'GET', headers: { accept: 'application/json' }})` con `revalidate` en `.server.ts` files
- **Error handling**: `throw redirect(302, '/explore')` con toast en 404s
- **Form validation**: Client-side (HTML5 + regex) + server-side (API errors)
- **Skeleton loading**: Estados de carga mientras se hace fetch inicial

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `frontend/src/routes/+page.svelte` | New | Home page con hero, featured links, top users |
| `frontend/src/routes/explore/` | New | Explore page con búsqueda y filtros |
| `frontend/src/routes/u/[username]/` | New | Perfiles públicos de usuario |
| `frontend/src/routes/auth/` | New | Auth flows (login, register, verify, reset) |
| `frontend/src/lib/components/home/` | New | Hero, FeaturedLinks, TopUsers components |
| `frontend/src/lib/components/explore/` | New | SearchBar, FilterSidebar, Pagination |
| `frontend/src/lib/components/auth/` | New | AuthFormWrapper reutilizable |
| `frontend/src/routes/+layout.ts` | Modified | Agregar navbar/footer públicos si no existen |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| LinkCard no existe (Phase 10) | Medium | Crear versión simplificada temporal en Phase 8, reemplazar después |
| API endpoints retornan formatos inesperados | Low | Validar contratos contra `documentacion/api-doc.md` antes de implementar |
| SEO tags no se renderizan en SSR | Low | Verificar HTML source con `bun run --cwd frontend build && preview` |
| Auth cookies no persisten correctamente | Medium | Test en browser real, no solo en dev mode |

## Rollback Plan

Si algo falla en producción:
1. Revertir commit de Phase 8: `git revert <commit-hash>`
2. Deploy versión anterior (Phase 7 base)
3. Hotfix: Crear páginas estáticas simples en HTML si SvelteKit falla completamente

## Dependencies

- **Phase 7 complete**: Frontend setup, layouts base, server actions
- **Phase 4 complete**: Public API endpoints operativos (`/api/links`, `/api/stats/global`, `/api/users/:username`)
- **Backend auth endpoints**: `/api/auth/*` funcionales (Phase 3)

## Success Criteria

- [ ] Home renderiza en SSR con datos reales (verificar en HTML source)
- [ ] Explore busca links por query con FTS5 y filtros funcionan
- [ ] Perfil `/u/:username` muestra datos del usuario o 404 redirige
- [ ] Login redirige a `/dashboard` con sesión activa
- [ ] Registro crea usuario y pide verificación de email
- [ ] Flujos de reset password completos (forgot → email → reset → login)
- [ ] Todas las páginas tienen `<title>`, `<meta name="description">`, `<meta property="og:image">`
- [ ] `bun run --cwd frontend check` pasa sin errores
- [ ] Lighthouse SEO score ≥ 90 en Home y Explore
