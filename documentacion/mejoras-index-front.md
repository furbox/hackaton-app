# TODO - Mejoras en `frontend-bun-ejs/index.ts`

## Objetivo
Aplicar mejoras de seguridad, consistencia HTTP y limpieza de logs en el entrypoint del servidor.

## Tareas
- [ ] Sanitizar `error.message` antes de renderizar HTML en el handler `error` (evitar XSS reflejado en página 500).
- [ ] Restringir serving de estáticos `/public/*` a métodos `GET` y `HEAD`.
- [ ] Para métodos no permitidos en estáticos, responder `405 Method Not Allowed` (opcional: header `Allow: GET, HEAD`).
- [ ] Mover impresión del listado completo de rutas a entorno no productivo (`NODE_ENV !== "production"`).
- [ ] Verificar que el comportamiento de fallback 404 de estáticos se mantenga igual.
- [ ] Probar manualmente rutas clave: `/`, `/explore`, `/dashboard`, `/public/*`, `/s/:code`.

## Criterio de Done
- [ ] No hay interpolación HTML insegura en respuestas de error.
- [ ] `/public/*` solo sirve archivos para `GET/HEAD`.
- [ ] En producción no se imprime el dump completo de rutas al iniciar.
