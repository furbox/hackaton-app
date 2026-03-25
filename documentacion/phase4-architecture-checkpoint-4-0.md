# Documentacion - Phase 4 Architecture Checkpoint

> Checkpoint tecnico que aplica a todas las sub-fases de Phase 4 (4.0 – 4.10).
>
> Objetivo: bloquear acoplamiento `routes -> db` y fijar contratos route/service antes de implementar endpoints funcionales.

---

## Estado de Phase 4

**Completa.** Las 56 sub-tareas (4.0 – 4.10) fueron implementadas y verificadas.

---

## Intent

Phase 4.0 define una puerta de arquitectura para que las APIs nuevas respeten el flujo `routes -> services -> db`.

Este checkpoint no implementa endpoints de negocio (4.1-4.10).

---

## Reglas que se aplican

- Las rutas bajo `backend/routes/api/**/*.ts` solo manejan concerns HTTP (parseo, validacion, status, serializacion).
- Las rutas no pueden importar `bun:sqlite`, `backend/db/queries` ni usar `getDatabase()`.
- Los servicios devuelven errores tipados (`Phase4ServiceErrorCode`) y las rutas los mapean a HTTP con contrato fijo.
- `backend/index.ts` se mantiene wiring-only: dispatch/composicion, sin SQL ni acceso directo a DB.

---

## Contrato de errores (deterministico)

Definido en `backend/contracts/service-error.ts`.

> **Nota:** el archivo fue movido de `backend/routes/api/contracts/service-error.ts` a `backend/contracts/service-error.ts` durante la implementacion. La carpeta `routes/api/contracts/` fue eliminada. El modulo `backend/contracts/` es una capa neutral reutilizable por servicios y rutas por igual.

- `VALIDATION_ERROR -> 400`
- `UNAUTHORIZED -> 401`
- `FORBIDDEN -> 403`
- `NOT_FOUND -> 404`
- `CONFLICT -> 409`
- `INTERNAL -> 500`

---

## DB Queries modularizadas

El archivo monolitico `backend/db/queries.ts` fue reemplazado por una carpeta modular:

```
backend/db/queries/
  users.ts          # CRUD de usuarios
  links.ts          # CRUD de links + short codes
  categories.ts     # CRUD de categorias
  interactions.ts   # likes y favoritos
  search.ts         # FTS5 full-text search
  stats.ts          # estadisticas globales y por usuario
  api-keys.ts       # API keys (creacion, revocacion, lookup)
  index.ts          # barrel export
```

Los consumidores importan desde `backend/db/queries/index.ts` (o directamente del modulo especifico). El shim `backend/db/queries.ts` fue eliminado por completo.

---

## Middleware de auth modularizado

El archivo monolitico `backend/auth/middleware.ts` fue reemplazado por:

```
backend/middleware/auth/
  errors.ts         # tipos de error de auth
  session.ts        # validacion de sesion stateful
  fingerprint.ts    # hashing de fingerprint (IP + User-Agent)
  rbac.ts           # control de acceso basado en roles
  session-admin.ts  # variante admin de validacion de sesion
  index.ts          # barrel export
```

Los consumidores importan desde `backend/middleware/auth/index.ts`.

---

## Tests consolidados

Todos los tests fueron movidos a `backend/test/` (estructura centralizada):

```
backend/test/
  auth/__tests__/       # tests de auth y sesiones
  db/__tests__/         # tests de schema, migraciones, queries
  emails/__tests__/     # tests de templates de email
  routes/api/__tests__/ # tests de endpoints HTTP
  routes/auth/__tests__/ # tests de rutas de auth
  routes/admin/__tests__/ # tests de rutas admin
  routes/__tests__/     # tests de short links route
  scripts/__tests__/    # tests del check de arquitectura
  services/__tests__/   # tests unitarios de servicios
```

### Comandos de verificacion

Desde `backend/`:

```bash
bun run check:route-boundaries
bun run check:phase4-architecture
bun test backend/test/routes/api/contracts/__tests__/service-error.contract.test.ts backend/test/scripts/__tests__/check-route-boundaries.test.ts
```

Para correr todos los tests:

```bash
bun test
```

---

## Short Links (4.10) — Diseno interno

La ruta de short links **no** es un endpoint browser-facing. Diseno deliberado:

- **Ruta:** `GET /api/s/:code` (prefijada con `/api/`, no `/s/:code` directamente)
- **Archivo:** `backend/routes/api/short.ts`
- **Flujo:** el frontend SvelteKit recibe el codigo, llama a `/api/s/:code`, y hace el redirect del lado del cliente.
- **Por que:** mantiene el short link bajo el mismo contrato de autenticacion y rate limiting que el resto de la API; evita exponer un redirect HTTP 302 directo al browser sin pasar por el middleware.

---

## Ejemplo de falla esperada

Si una ruta importa `bun:sqlite` o usa `getDatabase()`, el checker devuelve salida deterministica:

```text
[PHASE4_BOUNDARY_VIOLATION] backend/routes/api/links.ts:12:1 rule=route-no-bun-sqlite ...
```

---

## Rollback toggle

Si hay falsos positivos:

1. Ajustar patrones permitidos en `backend/scripts/check-route-boundaries.config.json`.
2. Mantener activo el contrato de errores (`service-error.contract.test.ts`).
3. Evitar desactivar completamente `check:phase4-architecture`; usar ajuste de reglas antes que apagar el gate.
