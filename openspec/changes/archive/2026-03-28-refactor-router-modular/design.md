# Design: Refactor Router Modular

## Technical Approach

El diseño convierte el entry point monolítico (`index.ts` con 193 líneas) en una arquitectura modular donde cada dominio de feature expone sus rutas como datos (`RouteDefinition[]`) y un helper centralizado (`registerRoutes()`) se encarga del registro. Esto sigue el principio **Configuration-as-Code** y separa la **declaración** (qué rutas existen) de la **ejecución** (cómo se registran).

La migración es zero-downtime: se crean los módulos en paralelo, se reemplazan las llamadas directas a `addRoute()` por `registerRoutes()`, y el router core (`router.ts`) permanece inalterado.

## Architecture Decisions

### Decision: RouteDefinition[] como contrato

**Choice**: Array de objetos plain `{ method, pattern, handler }` como contrato entre módulos y router.

**Alternatives considered**:
- Clases `RouteGroup` con métodos `add()` → más verboso, requiere instanciación
- Decoradores `@Route()` sobre handlers → requiere metadata reflection, overhead de runtime
- Router core con feature detection → acopla router a dominio, viola SRP

**Rationale**: Arrays son serializables (debugging fácil), type-safety nativa de TypeScript, zero overhead en runtime, y permiten composition (`[...publicRoutes, ...authRoutes]`).

### Decision: Módulos por feature (no por controller)

**Choice**: Agrupar rutas por dominio funcional: `public.routes.ts`, `auth.routes.ts`, `dashboard.routes.ts`, `api.routes.ts`.

**Alternatives considered**:
- Un archivo por controller (`home.routes.ts`, `explore.routes.ts`) → proliferación de archivos, difícil ver el todo
- Agrupar por HTTP method (`get.routes.ts`, `post.routes.ts`) → antinatural, las features operan en múltiples métodos
- Estructura plana en `index.ts` (status quo) → monolítico, difícil de mantener

**Rationale**: Feature-first agrupa lo que cambia junto. Un cambio en "auth" solo toca `auth.routes.ts`. Siguiendo convención existente en `backend/routes/`.

### Decision: Helper registerRoutes() con validaciones

**Choice**: Función helper que recibe `RouteDefinition[]` y llama a `addRoute()` con validaciones de duplicados.

**Alternatives considered**:
- Llamar `addRoute()` directamente en cada módulo → expone implementación del router, duplica lógica de validación
- Auto-discovery de archivos `*.routes.ts` → magic, difícil de predecir orden de carga, requiere glob
- Delegar a router core (`router.registerGroup()`) → acopla router a esta refactorización

**Rationale**: Helper centralizado permite agregar validaciones, logging, o métricas en un solo lugar. Módulos solo declaran datos, no conocen `addRoute()`.

### Decision: Orden explícito de rutas en arrays

**Choice**: Mantener orden de rutas estáticas antes que dinámicas en cada módulo, igual que `index.ts` actual.

**Alternatives considered**:
- Sorting automático por "nivel de dinamicidad" → complejo de implementar, edge cases
- Dejar que router core ordene → cambia comportamiento existente, riesgo de regressions

**Rationale**: El router actual prioriza rutas estáticas insertándolas antes que dinámicas. Mantener este orden en los arrays preserva comportamiento y es explícito (no magic).

## Data Flow

```
┌─────────────────────────────────────────────────────────────┐
│ index.ts (Entry Point)                                      │
│                                                             │
│  import { registerRoutes } from "./src/routes/index.ts"     │
│  import { publicRoutes } from "./src/routes/public.ts"     │
│  import { authRoutes } from "./src/routes/auth.ts"         │
│  // ...                                                     │
│                                                             │
│  registerRoutes(publicRoutes)                               │
│  registerRoutes(authRoutes)                                 │
│  // ...                                                     │
└─────────────┬───────────────────────────────────────────────┘
              │
              ▼
┌─────────────────────────────────────────────────────────────┐
│ routes/index.ts (Registry Module)                           │
│                                                             │
│  export function registerRoutes(routes: RouteDefinition[]) {│
│    routes.forEach(({ method, pattern, handler }) => {       │
│      addRoute(method, pattern, handler)                     │
│    })                                                       │
│  }                                                          │
└─────────────┬───────────────────────────────────────────────┘
              │
              ▼
┌─────────────────────────────────────────────────────────────┐
│ router.ts (Core - Unchanged)                                │
│                                                             │
│  export function addRoute(method, path, handler) { ... }    │
│  export function handleRequest(request) { ... }             │
│                                                             │
│  const routes: Route[] = []  // Internal registry           │
└─────────────────────────────────────────────────────────────┘
```

**Request flow (sin cambios)**:
```
Client Request → Bun.serve.fetch() → handleRequest() → Route Match → Controller → Response
```

## File Changes

| File | Action | Description |
|------|--------|-------------|
| `frontend-bun-ejs/src/routes/index.ts` | Create | Exporta `RouteDefinition` type y helper `registerRoutes()` |
| `frontend-bun-ejs/src/routes/public.routes.ts` | Create | Exporta `publicRoutes: RouteDefinition[]` (home, explore, profiles) |
| `frontend-bun-ejs/src/routes/auth.routes.ts` | Create | Exporta `authRoutes: RouteDefinition[]` (login, register, password reset) |
| `frontend-bun-ejs/src/routes/dashboard.routes.ts` | Create | Exporta `dashboardRoutes: RouteDefinition[]` (links, categories, keys, etc.) |
| `frontend-bun-ejs/src/routes/api.routes.ts` | Create | Exporta `apiRoutes: RouteDefinition[]` (HTMX partials, short links) |
| `frontend-bun-ejs/index.ts` | Modify | Reemplaza 60 imports y 50 llamadas `addRoute()` por 4 imports + 4 llamadas `registerRoutes()` |

## Interfaces / Contracts

```typescript
// routes/index.ts

import type { Controller } from "../router.ts";

export type HttpMethod = "GET" | "POST" | "PUT" | "DELETE";

export interface RouteDefinition {
  method: HttpMethod;
  pattern: string;
  handler: Controller;
}

/**
 * Registra un array de rutas en el router core.
 * Valida duplicados y loguea registro para debugging.
 */
export function registerRoutes(routes: RouteDefinition[]): void {
  const registered = listRoutes(); // Get current state for validation

  routes.forEach(({ method, pattern, handler }) => {
    // Validación: detectar duplicados exactos
    const isDuplicate = registered.some(
      (r) => r.method === method && r.pattern === pattern
    );

    if (isDuplicate) {
      console.warn(`[routes] Duplicate route detected: ${method} ${pattern}`);
    }

    addRoute(method, pattern, handler);
  });
}

// Exportar todos los módulos desde un solo entrypoint
export { publicRoutes } from "./public.routes.ts";
export { authRoutes } from "./auth.routes.ts";
export { dashboardRoutes } from "./dashboard.routes.ts";
export { apiRoutes } from "./api.routes.ts";
```

**Ejemplo de módulo** (`public.routes.ts`):
```typescript
import type { RouteDefinition } from "./index.ts";
import { homeController } from "../controllers/home.controller.ts";
import { exploreController } from "../controllers/explore.controller.ts";
// ...

export const publicRoutes: RouteDefinition[] = [
  { method: "GET", pattern: "/", handler: homeController },
  { method: "GET", pattern: "/explore", handler: exploreController },
  // ...
];
```

**Entry point refactorizado** (`index.ts`):
```typescript
import { registerRoutes, publicRoutes, authRoutes, dashboardRoutes, apiRoutes } from "./src/routes/index.ts";

registerRoutes(publicRoutes);
registerRoutes(authRoutes);
registerRoutes(dashboardRoutes);
registerRoutes(apiRoutes);

// ... resto del server setup (sin cambios)
```

## Testing Strategy

| Layer | What to Test | Approach |
|-------|-------------|----------|
| **Unit** | Helper `registerRoutes()` con mocks | Mockear `addRoute()` y verificar llamadas con parámetros correctos |
| **Unit** | Validación de duplicados | Pasar array con rutas duplicadas, verificar warning en console |
| **Integration** | Todas las rutas registradas | Usar `listRoutes()` y contar que coincida con expected count (50+) |
| **Integration** | Order preservation | Verificar que rutas estáticas se registran antes que dinámicas |
| **Regression** | Comportamiento idéntico | Tests E2E existentes deben pasar sin modificaciones |
| **Smoke** | Server inicia sin errores | `bun run dev` debe iniciar y listar todas las rutas |

**Tests críticos**:
```typescript
test("registerRoutes calls addRoute for each definition", () => {
  const mockAddRoute = mock();
  const routes: RouteDefinition[] = [
    { method: "GET", pattern: "/test", handler: mockFn }
  ];

  registerRoutes(routes);

  expect(mockAddRoute).toHaveBeenCalledTimes(1);
  expect(mockAddRoute).toHaveBeenCalledWith("GET", "/test", mockFn);
});

test("all expected routes are registered after refactor", () => {
  // Estado actual: 50 rutas
  const registered = listRoutes();
  expect(registered.length).toBeGreaterThanOrEqual(50);
});
```

## Migration / Rollout

**Zero-downtime migration plan** (faseada):

1. **Fase 1**: Crear directorio `src/routes/` y archivos de módulos con exports. NO modificar `index.ts` aún.
2. **Fase 2**: Reemplazar bloques de `addRoute()` en `index.ts` por `registerRoutes(módulo)` incrementalmente (public → auth → dashboard → api).
3. **Fase 3**: Verificar en cada paso con `bun test` y `listRoutes()`.
4. **Fase 4**: Eliminar imports huérfanos de controllers.

**Rollback plan**:
- `git revert` del commit refactorizado restaura `index.ts` monolítico
- Eliminar `frontend-bun-ejs/src/routes/` si es necesario
- Tiempo de recuperación: <5 minutos

**No data migration required**: Esta refactorización es puramente de organización de código. No se afecta base de datos, ni schemas, ni APIs.

## Open Questions

- [ ] ¿Necesitamos soportar rutas condicionales (feature flags) en el futuro? → Diseño actual permite extensión con `registerRoutesIf(featureFlag, routes)`.
- [ ] ¿Deberíamos agregar metadata a `RouteDefinition` (ej: `authRequired: true`)? → Fuera de scope, pero contrato permite agregar campos opcionales sin breaking changes.
