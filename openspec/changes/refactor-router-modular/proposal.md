# Proposal: Refactor Router Modular

## Intent

El entry point `index.ts` tiene 193 líneas con 60+ imports y 50+ llamadas `addRoute()` en un solo archivo, violando el principio de responsabilidad única. Esto hace el código difícil de mantener, escalar y testear. La refactorización a módulos por feature mejora la organización, reduce el acoplamiento y permite añadir nuevas rutas sin tocar el entry point.

## Scope

### In Scope
- Crear módulos de rutas por dominio: `public.routes.ts`, `auth.routes.ts`, `dashboard.routes.ts`, `api.routes.ts`
- Extraer helper `registerRoutes()` para registro automático de módulos
- Definir tipo `RouteDefinition[]` para contratos type-safe
- Refactorizar `index.ts` a <50 líneas (solo registro de módulos)
- Tests de integración para verificar que todas las rutas registran correctamente

### Out of Scope
- Cambios al router core (`router.ts`)
- Modificaciones a controladores existentes
- Introducción de frameworks de routing externos
- Cambios en la funcionalidad de las rutas (API idéntica)

**Cambios Breaking**: Ninguno. La API y comportamiento del router deben permanecer idénticos.

## Approach

### Estructura Propuesta

```
frontend-bun-ejs/src/routes/
├── index.ts           # Exporta todos los módulos
├── public.routes.ts   # Home, explore, profiles, etc.
├── auth.routes.ts     # Login, register, verify, etc.
├── dashboard.routes.ts # Links, categories, keys, etc.
└── api.routes.ts      # HTMX partials, short links
```

### Patrón de Definición

```typescript
// Type compartido
export type RouteDefinition = {
  method: "GET" | "POST" | "PUT" | "DELETE";
  pattern: string;
  handler: Controller;
};

// Cada módulo exporta un array
export const publicRoutes: RouteDefinition[] = [
  { method: "GET", pattern: "/", handler: homeController },
  { method: "GET", pattern: "/explore", handler: exploreController },
  // ...
];
```

### Helper de Registro

```typescript
// routes/index.ts
export function registerRoutes(routes: RouteDefinition[]) {
  routes.forEach(({ method, pattern, handler }) => {
    addRoute(method, pattern, handler);
  });
}
```

### Migración (Zero-Downtime)

1. **Fase 1**: Crear nuevos archivos de rutas con exports de arrays
2. **Fase 2**: Reemplazar llamadas `addRoute()` en `index.ts` por `registerRoutes()`
3. **Fase 3**: Verificar con `listRoutes()` que todas las rutas estén registradas
4. **Fase 4**: Ejecutar tests de integración para validar comportamiento idéntico

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `frontend-bun-ejs/index.ts` | Modified | Reduce de 193 a ~50 líneas, solo registra módulos |
| `frontend-bun-ejs/src/routes/` | New | Directorio con 4 archivos de módulos de rutas |
| `frontend-bun-ejs/src/router.ts` | No Change | Core del router sin modificaciones |
| Controladores existentes | No Change | Sin alteraciones en lógica de negocio |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Rutas no registradas por error en arrays | Low | Tests de integración verifican `listRoutes()` coincide con expected count |
| Complejidad adicional para nuevos devs | Low | Documentación clara + tipos TypeScript autocompletados |
| Regresiones en orden de rutas (static vs dynamic) | Medium | Mantener orden explícito en arrays, tests validan paths estáticos antes de dinámicos |
| Bugs en helper `registerRoutes()` | Low | Tests unitarios del helper con mocks |

## Rollback Plan

Si se detectan problemas críticos en producción:

1. **Revertir commit**: `git revert <commit-hash>` restaura `index.ts` monolítico
2. **Eliminar directorio**: `rm -rf frontend-bun-ejs/src/routes/`
3. **Verificar**: Ejecutar `bun test` para confirmar que tests pasan
4. **Tiempo de recuperación**: <5 minutos (git revert + restart)

**Ventaja**: La refactorización es puramente organizacional. El router core no cambia, por lo que revertir es trivial.

## Dependencies

- Ninguna. Esta refactorización es autocontenida y no depende de cambios externos.

## Success Criteria

- [ ] `index.ts` tiene <50 líneas (sin contar imports)
- [ ] Todos los módulos de rutas exportan arrays `RouteDefinition[]`
- [ ] Tests de integración verifican que `listRoutes()` retorna mismas rutas que antes
- [ ] Zero tests fallando después de refactorización
- [ ] Nueva ruta puede añadirse modificando solo 1 archivo (el módulo correspondiente)
