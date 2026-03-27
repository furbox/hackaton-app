# Documentacion - Phase 7 Frontend SvelteKit Setup

> Implementacion de la base frontend sobre SvelteKit 2 + Svelte 5 para URLoft.
> Enfoque: routing file-based, estado global minimo con runes, layouts compartidos y server actions con contratos consistentes.
>
> Fuente principal: `tasks/Phase07.md`
> Estado: **completa** (31/31 subtareas cerradas)

---

## Overview / Objetivo de la fase

La Phase 7 deja preparado el frontend para construir producto sobre una base estable en Fases 8 y 9, cubriendo:

- setup tecnico de SvelteKit + TypeScript + Tailwind v4,
- estructura de rutas publicas, privadas y `routes/api` para proxy/BFF,
- estado global con runes (`$state`, `$derived`) para sesion y UI,
- layout raiz reutilizable y layout de dashboard en modo SPA (`ssr=false`),
- server actions iniciales conectadas al backend Bun con manejo estandar de errores.

Resultado: el frontend queda listo para escalar pantallas sin refactors estructurales de base.

---

## Alcance y no alcance

### Alcance (Phase 7)

- Preparacion del workspace frontend y validacion de stack objetivo.
- Definicion de arquitectura de rutas para publico/dashboard/proxy.
- Creacion de estado global minimo para sesion y UI con Svelte 5 runes.
- Implementacion de shell global y shell de dashboard.
- Implementacion de actions base (`createLink`, `updateProfile`, `createCategory`) con contrato uniforme.

### No alcance (Phase 7)

- Construccion completa de pantallas de negocio finales (Phase 8/9).
- Suite formal de tests frontend end-to-end o unitarios completa (se difiere a Phase 10).
- Hardening visual final de feedback reutilizable en todos los componentes (la base de contrato queda lista).

---

## Arquitectura implementada

### 1) Routing (SvelteKit file-based)

- Rutas publicas en `frontend/src/routes/*` para home, explore, auth y perfiles publicos.
- Grupo privado `frontend/src/routes/(dashboard)/*` para experiencia de panel.
- Capa `frontend/src/routes/api/proxy/*` para desacoplar UI de endpoints backend directos.

Boundary aplicado en frontend:

`route (+page/+page.server/+server) -> lib/services/* -> /api/proxy -> backend /api/*`

### 2) Estado compartido con runes

- `frontend/src/lib/state/session.svelte.ts`: estado de sesion (`idle | loading | authenticated | guest`) + derivados (`isAuthenticated`, `isAdmin`, `displayName`).
- `frontend/src/lib/state/ui.svelte.ts`: estado UI global minimo (menu mobile, toasts).
- `frontend/src/lib/state/index.ts`: punto unico de export para consumo consistente.

### 3) Layouts

- `frontend/src/routes/+layout.svelte`: shell global (nav principal, main, footer) para todo el sitio.
- `frontend/src/routes/(dashboard)/+layout.ts`: `ssr=false` + `csr=true` para comportamiento SPA del panel y guard de acceso en cliente.
- `frontend/src/routes/(dashboard)/+layout.svelte`: estructura dashboard (sidebar/topbar/outlet) y redireccion reactiva cuando sesion pasa a guest.

### 4) Actions server-side

- Actions en rutas privadas con validacion de `FormData`, llamada a servicios tipados y retorno uniforme para UI.
- Casos base implementados:
  - `?/createLink` en `frontend/src/routes/(dashboard)/links/+page.server.ts`
  - `?/updateProfile` en `frontend/src/routes/(dashboard)/profile/+page.server.ts`
  - `?/createCategory` en `frontend/src/routes/(dashboard)/categories/+page.server.ts`

---

## Estructura de archivos y rutas creadas

## Archivos base del setup

- `frontend/package.json`
- `frontend/svelte.config.js`
- `frontend/vite.config.ts`
- `frontend/src/app.html`
- `frontend/src/routes/layout.css`

## Estado global y convenciones

- `frontend/src/lib/state/session.svelte.ts`
- `frontend/src/lib/state/ui.svelte.ts`
- `frontend/src/lib/state/index.ts`
- `frontend/src/lib/features/README.md`

## Layouts y navegacion

- `frontend/src/routes/+layout.svelte`
- `frontend/src/routes/+layout.server.ts`
- `frontend/src/lib/components/navigation/MainNav.svelte`
- `frontend/src/routes/(dashboard)/+layout.ts`
- `frontend/src/routes/(dashboard)/+layout.svelte`

## Services y contratos

- `frontend/src/lib/services/http.ts`
- `frontend/src/lib/services/contracts.ts`
- `frontend/src/lib/services/response.ts`
- `frontend/src/lib/services/links.service.ts`
- `frontend/src/lib/services/profile.service.ts`
- `frontend/src/lib/services/categories.service.ts`

## Matriz ruta -> feature -> endpoint backend esperado

| Ruta frontend | Feature owner | Integracion esperada backend |
|---|---|---|
| `/` | discover/home | `GET /api/stats/global`, `GET /api/links` |
| `/explore` | links-explore | `GET /api/links` con filtros |
| `/u/:username` | public-profile | `GET /api/users/:username` |
| `/dashboard` | dashboard-shell | `GET /api/stats/me` |
| `/dashboard/links` | links-management | `GET /api/links/me`, `POST /api/links`, `PUT /api/links/:id`, `DELETE /api/links/:id` |
| `/dashboard/profile` | profile-management | `PUT /api/users/me`, `PUT /api/users/me/password` |
| `/dashboard/categories` | categories-management | `GET/POST /api/categories`, `PUT/DELETE /api/categories/:id` |
| `/dashboard/favorites` | favorites | `GET /api/links/me/favorites`, `POST /api/links/:id/favorite` |
| `/dashboard/keys` | api-keys | `GET/POST /api/keys`, `DELETE /api/keys/:id` |
| `/dashboard/import` | bookmarks-import | `POST /api/links/import` |
| `/api/proxy/*` | frontend-bff | proxy/normalizacion hacia `/api/*` backend |

---

## Decisiones tecnicas y rationale (SSR global + CSR dashboard)

### Decision 1: SSR por defecto para rutas publicas

- Mantener SSR en capa publica mejora SEO y primer render para home/explore/perfiles.
- Permite que metadata y contenido publico sean indexables sin depender de hidratacion completa.

### Decision 2: CSR forzado para dashboard

- En `frontend/src/routes/(dashboard)/+layout.ts` se define `ssr=false` y `csr=true`.
- Objetivo: UX SPA para panel privado (navegacion interna fluida, menor friccion de recarga).

### Decision 3: Guard de acceso en layout de grupo

- El control de acceso del dashboard vive en el layout del grupo, no en cada pagina.
- Beneficio: evita duplicacion de reglas y reduce riesgo de rutas privadas sin proteccion.

### Decision 4: Capa de servicios + proxy como anti-acople

- UI no llama directamente al backend final; usa `lib/services/*` y `/api/proxy/*`.
- Beneficio: contratos tipados, manejo uniforme de errores y menor impacto ante cambios de backend.

---

## Contratos de server actions y manejo de errores

Contrato de salida estandar para actions:

```ts
{
  success: boolean;
  data?: unknown;
  fieldErrors?: unknown;
  formError?: string;
}
```

Patron aplicado en actions iniciales:

1. Parsear `FormData` y validar campos requeridos.
2. Ejecutar service tipado (`linksService`, `profileService`, `categoriesService`).
3. Si falla backend/proxy, devolver `fail(status, { success:false, formError, fieldErrors, data })`.
4. Si ok, devolver `{ success:true, data }`.

Normalizacion de errores en services:

- `frontend/src/lib/services/http.ts` unifica parseo de payload/estado HTTP.
- `frontend/src/lib/services/response.ts` transforma errores heterogeneos en `ServiceError` consistente.

Impacto: los componentes pueden renderizar feedback de formularios sin logica ad-hoc por cada endpoint.

---

## Integracion frontend-backend

Integracion implementada sobre contratos existentes de backend (Fase 3 y 4):

- Auth/sesion via cookies forwardeadas desde server actions y servicios.
- Endpoints consumidos via proxy SvelteKit (`/api/proxy/*`) para centralizar headers/cookies y mapping de errores.
- Servicios por dominio (`links`, `profile`, `categories`) alineados con endpoints reales del backend Bun.

La integracion queda preparada para escalar formularios y vistas en Fase 8/9 sin duplicar `fetch` manual.

---

## Checklist DoD (resumen de cumplimiento)

- [x] Estructura de rutas publica/privada/api creada y usable.
- [x] Estado global minimo con runes (`$state`, `$derived`) disponible para layouts/componentes.
- [x] Layout global y layout dashboard (`ssr=false`) implementados.
- [x] 3 server actions base operativas (`createLink`, `updateProfile`, `createCategory`).
- [x] Contratos de error/feedback de formularios estandarizados.
- [x] `bun run --cwd frontend check` utilizado como validacion de tipado/sync en la fase.
- [x] Convenciones frontend-backend y feature ownership documentadas.

**Cierre formal de fase:** 31/31 subtareas completadas en `tasks/Phase07.md`.

---

## Dependencias con fases previas/siguientes

## Dependencias previas

- **Phase 3 (Auth):** sesion y contratos de autenticacion para guard de rutas y acciones privadas.
- **Phase 4 (Core APIs):** endpoints de links/profile/categories/stats usados por servicios frontend.
- **Phase 1:** scaffold inicial de `frontend/` sobre el que se consolida la fase.

## Dependencias hacia adelante

- **Phase 8:** construccion de pantallas publicas sobre layout y routing ya definidos.
- **Phase 9:** dashboard funcional completo reutilizando shell CSR, estado global y actions base.
- **Phase 10:** formalizacion de tests frontend (unit/integration/e2e) sobre contratos ya establecidos.

---

## Riesgos conocidos + siguientes pasos

## Riesgos conocidos

- Coexistencia temporal entre estado legacy (`frontend/src/lib/stores/session.ts`) y estado runes (`frontend/src/lib/state/session.svelte.ts`) en partes del layout global; conviene converger para evitar doble fuente de verdad.
- `isAdmin` en runes de sesion esta en placeholder (`false`), pendiente de conectar con rol real.
- El contrato de feedback ya existe, pero su explotacion visual uniforme depende de implementacion completa de componentes en fases de UI.

## Siguientes pasos recomendados

1. Unificar consumo de sesion en layouts/componentes sobre `lib/state/*` para cerrar deuda de transicion.
2. Completar pantallas de Fase 8/9 reutilizando acciones y services existentes sin `fetch` ad-hoc.
3. En Fase 10, agregar tests formales de actions (happy path + errores) y regression de routing privado/publico.

---

## Resumen ejecutivo

La Phase 7 queda cerrada con 31 subtareas completadas, estableciendo la base frontend de URLoft en SvelteKit 2 + Svelte 5: routing escalable, estado global con runes, estrategia SSR/CSR hibrida, layouts compartidos y server actions con contratos tipados y errores normalizados. Esto habilita avanzar a construccion de interfaces de producto sin cambios estructurales de arquitectura.
