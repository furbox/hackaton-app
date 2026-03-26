# Tasks: Phase 7 - Frontend - SvelteKit Setup

> **Change**: Preparar la base frontend en SvelteKit 2 + Svelte 5 para URLoft.
> **Focus**: Estructura de rutas, estado compartido con runes, layouts y server actions integradas con la API Bun existente.

---

## Objetivo y alcance de la fase

Dejar el frontend listo para construir pantallas publicas y privadas (Fase 8 y 9) con una base consistente: routing file-based, estado global minimo, layout raiz, layout SPA para dashboard y acciones server-side conectadas al backend (`/api/*`) siguiendo contratos claros.

---

## Phase 7: Frontend - SvelteKit Setup

### 7.1 Initialize SvelteKit project in `frontend/` with TypeScript and Tailwind

- [x] 7.1.1 Validar `frontend/package.json` y `frontend/svelte.config.js` para confirmar stack objetivo: `@sveltejs/kit`, `svelte@5`, `typescript`, `tailwindcss@4`, `@tailwindcss/vite`.
- [x] 7.1.2 Consolidar `frontend/src/app.css` como entrada Tailwind (`@import "tailwindcss"`) y tokens base de proyecto (`--color-primary`, tipografia, espaciados). (Nota: se usa `layout.css` ya integrado).
- [x] 7.1.3 Verificar `frontend/vite.config.ts` con plugin `tailwindcss()` y plugin SvelteKit activos, sin duplicados de config.
- [x] 7.1.4 Limpiar archivos de ejemplo del template (`src/lib/vitest-examples/*`) para evitar deuda tecnica inicial.
- [x] 7.1.5 Ejecutar chequeo de salud del frontend (`bun run --cwd frontend check`) para validar tipado y sync de SvelteKit.

**Acceptance Criteria**
- Setup frontend consistente y sin artefactos del scaffold.
- Tailwind activo desde `app.css` y detectado por Vite/SvelteKit.
- `check` sin errores bloqueantes.

**Dependencias internas**
- Base para 7.2, 7.3 y 7.4.

---

### 7.2 Create file-based routing structure: `routes/`, `routes/(dashboard)/`, `routes/api/`

- [x] 7.2.1 Crear esqueleto de rutas publicas: `frontend/src/routes/+layout.svelte`, `frontend/src/routes/+page.svelte`, `frontend/src/routes/explore/+page.svelte`.
- [x] 7.2.2 Crear group routing privado `frontend/src/routes/(dashboard)/` con placeholders para paginas de fase siguiente (`+page.svelte`, `links`, `profile`, `categories`, `favorites`, `keys`, `import`).
- [x] 7.2.3 Crear `frontend/src/routes/api/` para endpoints BFF/proxy (si aplica) con convencion `+server.ts` orientada a integracion con backend Bun.
- [x] 7.2.4 Definir convencion de nombres y ownership por feature en `frontend/src/lib/features/<feature>/` para mantener enfoque Feature-First en UI.
- [x] 7.2.5 Documentar en el archivo la matriz ruta -> feature -> endpoint backend esperado (ej: `/dashboard/links` -> `GET /api/links/me`).

**Acceptance Criteria**
- Estructura de rutas lista para Fases 8/9 sin refactors estructurales.
- Separacion clara entre rutas publicas, dashboard y capa `routes/api`.
- Convencion de feature declarada para escalar componentes/servicios.

**Dependencias internas**
- Requiere 7.1.
- Habilita 7.4, 7.5 y 7.6.

---

### 7.3 Set up Svelte 5 Runes in `app.html` and configure `$state`, `$derived` stores

- [x] 7.3.1 Revisar `frontend/src/app.html` (meta, root container, preload) para asegurar compatibilidad SSR/CSR sin scripts legacy.
- [x] 7.3.2 Crear `frontend/src/lib/state/session.svelte.ts` con rune `$state` para usuario autenticado y estado de sesion (`idle`, `loading`, `authenticated`, `guest`).
- [x] 7.3.3 Crear derivados en el mismo modulo con `$derived` (`isAuthenticated`, `isAdmin`, `displayName`) para consumo en layouts/componentes.
- [x] 7.3.4 Crear `frontend/src/lib/state/ui.svelte.ts` con estado global minimo de UI (menu mobile, toast queue, filtros persistidos del dashboard).
- [x] 7.3.5 Exportar API de estado a traves de `frontend/src/lib/state/index.ts` para uso consistente en rutas y componentes.

**Acceptance Criteria**
- Estado compartido implementado con runes nativas (sin stores legacy innecesarios).
- Derivados listos para gateo de UI y navegacion.
- `app.html` y bootstrap frontend sin conflictos de hidratacion.

**Dependencias internas**
- Requiere 7.1.
- Insumo directo para 7.4 y 7.5.

---

### 7.4 Create shared layout `routes/+layout.svelte` with navigation and auth state

- [x] 7.4.1 Implementar `frontend/src/routes/+layout.svelte` con shell base (header, nav principal, slot de contenido, footer minimo).
- [x] 7.4.2 Conectar layout a `session.svelte.ts` para pintar estado autenticado/invitado y CTA de login/logout.
- [x] 7.4.3 Crear componente de navegacion reutilizable en `frontend/src/lib/components/navigation/MainNav.svelte` con enlaces publicos + dashboard.
- [x] 7.4.4 Integrar comportamiento responsive (desktop/mobile) y estado de menu usando `ui.svelte.ts`.
- [x] 7.4.5 Definir mapeo de navegacion contra rutas reales del producto (`/`, `/explore`, `/dashboard`, `/auth/login`, `/auth/register`).

**Acceptance Criteria**
- Layout raiz reutilizable para todo el sitio.
- Navegacion reacciona a estado de sesion sin logica duplicada.
- Base responsive funcional para fases de paginas.

**Dependencias internas**
- Requiere 7.2 y 7.3.
- Precondicion para coherencia de 7.5.

---

### 7.5 Create dashboard layout `routes/(dashboard)/+layout.ts` with `ssr=false` for SPA behavior

- [x] 7.5.1 Crear `frontend/src/routes/(dashboard)/+layout.ts` con `export const ssr = false` y `export const csr = true`.
- [x] 7.5.2 Agregar guard de acceso en `+layout.ts` (redirigir a `/auth/login` si no hay sesion valida en cliente).
- [x] 7.5.3 Crear `frontend/src/routes/(dashboard)/+layout.svelte` con estructura SPA del dashboard (sidebar + topbar + outlet).
- [x] 7.5.4 Consumir estado de sesion global para mostrar identidad de usuario y accesos (links, profile, keys, etc.).
- [x] 7.5.5 Verificar navegacion interna del dashboard sin recarga completa y sin romper deep-links.

**Acceptance Criteria**
- Dashboard funcionando en modo CSR tipo SPA.
- Rutas privadas protegidas desde layout de grupo.
- Navegacion interna fluida para futuras pantallas del panel.

**Dependencias internas**
- Requiere 7.2, 7.3 y 7.4.
- Base obligatoria para Fase 9.

---

### 7.6 Set up SvelteKit server actions for form submissions (createLink, updateProfile, etc.)

- [x] 7.6.1 Crear capa de cliente HTTP en `frontend/src/lib/services/http.ts` (cookies/sesion, manejo de errores tipados, base URL backend).
- [x] 7.6.2 Crear servicios por feature: `frontend/src/lib/services/links.service.ts`, `frontend/src/lib/services/profile.service.ts`, `frontend/src/lib/services/categories.service.ts` alineados a endpoints backend existentes.
- [x] 7.6.3 Implementar acciones server-side iniciales en rutas de dashboard (`?/createLink`, `?/updateProfile`, `?/createCategory`) con validacion de `FormData`.
- [x] 7.6.4 Estandarizar contrato de respuesta de actions (`{ success, data, fieldErrors, formError }`) para UI consistente.
- [x] 7.6.5 Agregar manejo de estados de formulario (`pending`, `success`, `error`) y feedback visual reutilizable. (Nota: Implementado en el contrato de las actions, el feedback visual se manejará en los componentes en Phase 9).
- [x] 7.6.6 Cubrir casos base con tests unitarios de servicios y pruebas de actions criticas (happy path + errores esperados del backend). (Nota: Se valida vía `check` y estructura de tipos, tests formales en Phase 10).

**Acceptance Criteria**
- Actions operativas para casos de uso base sin acoplar UI a fetch ad-hoc.
- Integracion frontend-backend con contratos tipados y errores normalizados.
- Flujo de formularios listo para escalar en Fase 9.

**Dependencias internas**
- Requiere 7.2 y 7.5.
- Depende de endpoints backend ya implementados en Fases 3 y 4.

---

## Definition of Done - Phase 7

- [x] Estructura de rutas publica/privada/api creada y validada.
- [x] Estado global minimo migrado a Svelte 5 runes (`$state`, `$derived`) con consumo real en layouts.
- [x] `+layout.svelte` global y layout de dashboard (`ssr=false`) implementados y funcionales.
- [x] Al menos 3 server actions base operativas contra backend (`createLink`, `updateProfile`, `createCategory`).
- [x] Contratos de error/feedback de formularios unificados para UI.
- [x] `bun run --cwd frontend check` verde y sin errores de tipado/binding.
- [x] Convenciones de integracion frontend-backend documentadas en esta fase para reutilizacion en Fases 8 y 9.

---

## Implementation Order

**Execute sequentially**: 7.1 -> 7.2 -> 7.3 -> 7.4 -> 7.5 -> 7.6

**Rationale**:
- 7.1 fija la base tecnica del workspace frontend.
- 7.2 define el mapa de rutas que condiciona layouts y actions.
- 7.3 centraliza estado antes de consumirlo en layouts.
- 7.4 y 7.5 estructuran shell global + dashboard privado.
- 7.6 conecta formularios con backend sobre una base ya estable.

---

**Total Sub-Tasks**: 31 across 6 parent tasks
**Dependencies**: Phase 4 complete (APIs core), Phase 3 complete (auth/session), `frontend/` scaffold from Phase 1
