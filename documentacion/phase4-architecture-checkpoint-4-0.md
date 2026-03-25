# Documentacion - Phase 4.0 Architecture Checkpoint

> Checkpoint tecnico previo a Phase 4.1+.
>
> Objetivo: bloquear acoplamiento `routes -> db` y fijar contratos route/service antes de implementar endpoints funcionales.

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

Definido en `backend/routes/api/contracts/service-error.ts`.

- `VALIDATION_ERROR -> 400`
- `UNAUTHORIZED -> 401`
- `FORBIDDEN -> 403`
- `NOT_FOUND -> 404`
- `CONFLICT -> 409`
- `INTERNAL -> 500`

---

## Comandos de verificacion

Desde `backend/`:

```bash
bun run check:route-boundaries
bun run check:phase4-architecture
bun test routes/api/contracts/__tests__/service-error.contract.test.ts scripts/__tests__/check-route-boundaries.test.ts
```

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
