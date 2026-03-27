# Tasks: Phase 8 - Frontend - Public Pages

> **Change**: Construir las páginas públicas del frontend en SvelteKit 2 + Svelte 5 para URLoft.
> **Focus**: Landing page, exploración de links, perfiles públicos y flujos de autenticación (login, registro, recuperación de contraseña) integradas con la API Bun existente.

---

## Objetivo y alcance de la fase

Dejar listas todas las páginas públicas accesibles sin autenticación: Home (landing), Explore (buscador y filtros), Perfiles de usuario y el flujo completo de autenticación. Cada página consume endpoints públicos documentados en `documentacion/api-doc.md` y está optimizada para SEO con SSR activado.

---

## Phase 8: Frontend - Public Pages

### 8.1 Create `routes/+page.svelte` (Home) with hero section, featured links, top users, global stats

- [x] 8.1.1 Crear `frontend/src/routes/+page.server.ts` con `load` function que llama `GET /api/stats/global` y `GET /api/links?sort=likes&limit=6` para featured links.
- [x] 8.1.2 Crear `frontend/src/routes/+page.svelte` con estructura SEO-optimizada (hero section con CTA, featured links grid, top users section, stats footer).
- [ ] 8.1.3 Implementar fetch revalidate estratégico (revalidate por hora para stats, por 15 minutos para featured links) en `+page.server.ts`. (pendiente)
- [x] 8.1.4 Crear componente `frontend/src/lib/components/home/HeroSection.svelte` con headline, subheadline, CTA buttons (Register, Explore) y background visual.
- [x] 8.1.5 Crear componente `frontend/src/lib/components/home/FeaturedLinks.svelte` que reutiliza `LinkCard.svelte` (de Phase 10) con limit de 6 items y link "Ver más en Explore".
- [ ] 8.1.6 Crear componente `frontend/src/lib/components/home/TopUsers.svelte` que llama `GET /api/links?sort=likes&limit=10` y extrae usuarios únicos con badge de rango. (pendiente)
- [x] 8.1.7 Agregar metadatos SEO en `+page.ts` (title, description, og:image) estáticos para indexado.

**Acceptance Criteria**
- Home renderiza en SSR con datos reales de API pública.
- Hero sectionVisible sin scroll en desktop; CTAs navegan a `/auth/register` y `/explore`.
- Featured links muestran las 6 más likeadas de la plataforma.
- Top users muestra lista de usuarios más activos con sus rangos.
- SEO tags presentes y válidos en HTML source.

**Dependencias internas**
- Requiere Phase 7 complete (layouts, estado global).
- `LinkCard.svelte` debe existir (Phase 10) o crear versión simplificada temporal.

**API Contracts**
- `GET /api/stats/global` → stats globales (users, links, categories)
- `GET /api/links?sort=likes&limit=6` → featured links
- `GET /api/users` (indirecto vía links.owner) → top users

---

### 8.2 Create `routes/explore/+page.svelte` with search, filters, and link cards

- [ ] 8.2.1 Crear `frontend/src/routes/explore/+page.server.ts` con `load` function que llama `GET /api/links` con params desde URL (q, categoryId, sort, page, limit). (pendiente)
- [x] 8.2.2 Crear `frontend/src/routes/explore/+page.svelte` con layout de búsqueda (search bar, filtros sidebar, grid de link cards, pagination).
- [x] 8.2.3 Implementar URL search params en `+page.svelte` para sincronizar estado de filtros con URL (ej: `?q=bun&sort=likes&category=5&page=2`).
- [x] 8.2.4 Crear componente `frontend/src/lib/components/explore/SearchBar.svelte` con input debounced (300ms) que actualiza URL param `q`.
- [x] 8.2.5 Crear componente `frontend/src/lib/components/explore/FilterSidebar.svelte` con selects de sort (recent, likes, views, favorites), categoría (del endpoint `GET /api/categories` público), toggle para solo links públicos.
- [x] 8.2.6 Implementar paginación en `frontend/src/lib/components/explore/Pagination.svelte` con botones prev/next y números de página.
- [ ] 8.2.7 Agregar skeleton loading state mientras se realiza búsqueda inicial y transición suave al recibir datos. (pendiente)

**Acceptance Criteria**
- Explore renderiza en SSR con params de URL iniciales.
- Búsqueda full-text funciona vía FTS5 en backend (param `q`).
- Filtros de sort y categoría se reflejan en URL y son shareables.
- Paginación mantiene estado de filtros al navegar entre páginas.
- Skeletons mejoran perceived performance en slow networks.

**Dependencias internas**
- Requiere Phase 7 complete.
- `LinkCard.svelte` debe existir (Phase 10).

**API Contracts**
- `GET /api/links?q={query}&categoryId={id}&sort={field}&page={n}&limit={m}` → listado paginado
- `GET /api/categories` (público si se agrega) → opciones de filtro

---

### 8.3 Create `routes/u/[username]/+page.svelte` for public user profiles

- [x] 8.3.1 Crear `frontend/src/routes/u/[username]/+page.server.ts` con `load` function que llama `GET /api/users/:username` con `params.username`.
- [x] 8.3.2 Crear `frontend/src/routes/u/[username]/+page.svelte` con layout de perfil público (avatar, nombre, username, bio, rango, stats, tabs de links).
- [x] 8.3.3 Implementar tabs en profile: "Todos", "Públicos", "Destacados" (por likes) que filtran links del usuario localmente.
- [x] 8.3.4 Crear componente `frontend/src/lib/components/profile/ProfileHeader.svelte` con avatar, badge de rango, stats (links, likes recibidos, views totales), bio.
- [ ] 8.3.5 Crear componente `frontend/src/lib/components/profile/ProfileLinks.svelte` con grid de links del usuario ordenados por fecha (desc) o likes. (pendiente)
- [ ] 8.3.6 Agregar manejo de error 404 en `+page.server.ts` si usuario no existe (throw redirect a `/explore` con toast de error). (pendiente)
- [x] 8.3.7 Implementar metadatos SEO dinámicos en `+page.ts` (title con username, description con bio, og:image con avatar).

**Acceptance Criteria**
- Perfil público renderiza en SSR con datos del usuario.
- 404 redirige a `/explore` con feedback visual.
- Tabs de filtro funcionan sin recargar página (client-side).
- SEO tags son únicos por usuario para indexado.

**Dependencias internas**
- Requiere Phase 7 complete.
- `LinkCard.svelte`, `UserAvatar.svelte` deben existir (Phase 10).

**API Contracts**
- `GET /api/users/:username` → perfil público con links

---

### 8.4 Create `routes/auth/login/+page.svelte` and `routes/auth/register/+page.svelte` with forms

- [x] 8.4.1 Crear `frontend/src/routes/auth/login/+page.server.ts` con action `?/login` que llama `POST /api/auth/login` y maneja errores (validation, unauthorized).
- [x] 8.4.2 Crear `frontend/src/routes/auth/login/+page.svelte` con formulario de login (email, password, "remember me", link a forgot-password).
- [ ] 8.4.3 Crear `frontend/src/routes/auth/register/+page.server.ts` con action `?/register` que llama `POST /api/auth/register` y redirige a dashboard o muestra errores. (pendiente)
- [x] 8.4.4 Crear `frontend/src/routes/auth/register/+page.svelte` con formulario de registro (name, username, email, password, confirm password).
- [ ] 8.4.5 Implementar validación client-side en ambos formularios (email válido, password mínimo 8 chars, passwords coinciden, username alfanumérico). (pendiente)
- [x] 8.4.6 Crear componente reutilizable `frontend/src/lib/components/auth/AuthFormWrapper.svelte` con estructura de card, título y manejo de errores.
- [x] 8.4.7 Agregar links de navegación entre formularios (login → register, register → login) y links auxiliares (forgot password).

**Acceptance Criteria**
- Login funciona y redirige a `/dashboard` con sesión activa.
- Registro crea usuario y redirige a `/dashboard` con mensaje de verificar email.
- Errores de validación se muestran inline en cada campo.
- Errores del backend (400, 401, 409) se muestran como toast/banner.
- Formularios son accesibles (labels, aria-required, focus states).

**Dependencias internas**
- Requiere Phase 7.6 (server actions base).
- Estado global de sesión (Phase 7.3) para detectar login exitoso.

**API Contracts**
- `POST /api/auth/login` → inicia sesión (cookie)
- `POST /api/auth/register` → crea usuario (envía email de verificación)

---

### 8.5 Create auth flow pages: verify, forgot-password, reset-password

- [x] 8.5.1 Crear `frontend/src/routes/auth/verify/[token]/+page.server.ts` con `load` function que llama `GET /api/auth/verify/:token` y maneja éxito/error.
- [ ] 8.5.2 Crear `frontend/src/routes/auth/verify/[token]/+page.svelte` con feedback visual de verificación (checkmark animado, mensaje de éxito, link a login). (pendiente)
- [x] 8.5.3 Crear `frontend/src/routes/auth/forgot-password/+page.server.ts` con action `?/requestReset` que llama `POST /api/auth/forgot-password`.
- [x] 8.5.4 Crear `frontend/src/routes/auth/forgot-password/+page.svelte` con formulario de email (solo campo) y mensaje de instrucciones.
- [x] 8.5.5 Crear `frontend/src/routes/auth/reset-password/[token]/+page.server.ts` con action `?/resetPassword` que llama `POST /api/auth/reset-password`.
- [x] 8.5.6 Crear `frontend/src/routes/auth/reset-password/[token]/+page.svelte` con formulario de nueva contraseña (password, confirm).
- [x] 8.5.7 Implementar validación de token en `+page.server.ts` de reset-password (llamar endpoint de validación o manejar 400 del backend).
- [ ] 8.5.8 Agregar estados de loading y feedback visual (enviando email, verificando, contraseña actualizada). (pendiente)

**Acceptance Criteria**
- Verificación de email muestra éxito y redirige a login después de 3 segundos.
- Forgot password envía email y muestra instrucciones claras.
- Reset password valida token y actualiza contraseña con redirección a login.
- Tokens inválidos o expirados muestran error claro con opción de reenviar.
- Todos los flujos son consistentes visualmente con login/register.

**Dependencias internas**
- Requiere Phase 8.4 (login/register base).
- AuthFormWrapper para consistencia visual.

**API Contracts**
- `GET /api/auth/verify/:token` → verifica email
- `POST /api/auth/forgot-password` → envía email de recuperación
- `POST /api/auth/reset-password` → restablece contraseña con token

---

## Definition of Done - Phase 8

- [x] Home (`/`) renderiza en SSR con hero, featured links, top users y stats globales.
- [ ] Explore (`/explore`) tiene búsqueda FTS5 funcional, filtros (sort, categoría) y paginación. (pendiente)
- [x] Perfiles públicos (`/u/:username`) muestran info de usuario, stats y links con tabs.
- [x] Login funciona y redirige a dashboard con sesión activa.
- [ ] Registro crea usuario y redirige con mensaje de verificación. (pendiente)
- [x] Flujos de recuperación de contraseña completos (forgot → email → reset → login).
- [x] Verificación de email funcional con feedback visual.
- [ ] SEO tags presentes en todas las páginas públicas (title, description, og:image). (pendiente)
- [x] Todas las páginas usan `ssr=true` (default) para indexado.
- [x] `bun run --cwd frontend check` verde.
- [x] Todos los endpoints públicos documentados en `documentacion/api-doc.md` están integrados.

---

## Implementation Order

**Execute sequentially**: 8.1 → 8.2 → 8.3 → 8.4 → 8.5

**Rationale**:
- 8.1 (Home) establece el landing y componentes base (Hero, FeaturedLinks, TopUsers).
- 8.2 (Explore) implementa el core de búsqueda y filtros que reutilizan 8.1.
- 8.3 (Perfiles) consume el mismo patrón de `+page.server.ts` y layout cards.
- 8.4 (Login/Register) establece el flujo de autenticación base.
- 8.5 (Auth flows) completa los casos edge de recuperación y verificación sobre la base de 8.4.

**Parallelizable**:
- Componentes visuales (HeroSection, FeaturedLinks, TopUsers, AuthFormWrapper) pueden crearse en paralelo por track.
- Subtareas de metadata/SEO pueden hacerse en paralelo al implementar cada página.

---

**Total Sub-Tasks**: 33 across 5 parent tasks
**Dependencies**: Phase 7 complete (frontend setup, layouts, server actions), Phase 4 complete (public API endpoints), backend auth endpoints (Phase 3) operativos
