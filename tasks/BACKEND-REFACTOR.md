# Tasks: Backend Refactor - URLoft

## Resumen Ejecutivo
Este refactor mejora la mantenibilidad y escalabilidad del backend al desacoplar el servidor HTTP, el enrutamiento y los middlewares globales. Se eliminó la lógica monolítica en `index.ts`, permitiendo una extensión más sencilla de nuevas rutas y una gestión de errores y logs centralizada, aprovechando al máximo el rendimiento nativo de `Bun.serve`.

## Phase 1: Foundation & Global Middleware
- [x] 1.1 Crear `backend/middleware/logger.ts` para interceptar y loguear peticiones (método, URL, tiempo).
- [x] 1.2 Crear `backend/middleware/cors.ts` para manejo flexible de cabeceras CORS.
- [x] 1.3 Refactorizar `backend/index.ts` para inicializar middlewares globales y delegar el ruteo.

## Phase 2: Modular Routing & Cleanup
- [x] 2.1 Crear `backend/router.ts` para centralizar la definición de rutas y sus handlers.
- [x] 2.2 Migrar handlers de rutas existentes (Auth, Links, Stats) desde `index.ts` a `router.ts`.
- [x] 2.3 Limpiar código muerto en `backend/index.ts` y asegurar la correcta inyección de dependencias.

## Phase 3: Validation & Testing
- [ ] 3.1 Verificar compatibilidad de CORS con el frontend (SvelteKit) y la Chrome Extension.
- [ ] 3.2 Validar que el Logger capture correctamente las peticiones asíncronas.
- [ ] 3.3 Realizar Smoke Tests de los endpoints críticos: `/api/auth/login`, `/api/links`, `/api/stats/global`.
- [ ] 3.4 Verificar que el manejo de rutas no encontradas (404) y errores internos (500) sea consistente.
