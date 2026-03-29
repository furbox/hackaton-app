# 📚 Documentación URLoft

> **Documentación técnica organizada del proyecto URLoft**

## 📂 Estructura

| Archivo | Descripción | Secciones |
|---------|-------------|-----------|
| [`db-layer.md`](./db-layer.md) | **Phase 2: Database Layer** | Arquitectura, esquema, queries, testing, troubleshooting |
| [`phase03-authentication-layer.md`](./phase03-authentication-layer.md) | **Phase 3: Authentication Layer** | Objetivo, decisiones de arquitectura auth, estado 3.1-3.8, testing, pendientes |
| [`phase4-architecture-checkpoint-4-0.md`](./phase4-architecture-checkpoint-4-0.md) | **Phase 4.0: Architecture Checkpoint** | Reglas de capas, contrato de errores, comandos de verificacion, rollback |
| [`phase05-background-workers.md`](./phase05-background-workers.md) | **Phase 5: Background Workers** | Worker pool, jobs async, resiliencia y observabilidad |
| [`phase06-mcp-server.md`](./phase06-mcp-server.md) | **Phase 6: MCP Server** | Arquitectura MCP, auth con API keys, herramientas expuestas |
| [`phase06-web-skill.md`](./phase06-web-skill.md) | **Phase 6: Web Skill** | Endpoints de skill, contratos y casos de uso para agentes |
| [`phase07-frontend-sveltekit-setup.md`](./phase07-frontend-sveltekit-setup.md) | **Phase 7: Frontend Setup** | Base SvelteKit, layouts, estado y actions iniciales |
 | [`phase08-frontend-public-pages.md`](./phase08-frontend-public-pages.md) | **Phase 8: Frontend Public Pages** | Rutas publicas, auth flows, SSR/SEO y estado actual |
 | [`phase09-router-modular-refactor.md`](./phase09-router-modular-refactor.md) | **Phase 9: Router Modular Refactor** | Refactorización del sistema de rutas a arquitectura modular por feature |
| [`phase10-chrome-extension.md`](./phase10-chrome-extension.md) | **Phase 10: Chrome Extension** | Extensión de Chrome con Vanilla JS: auth, guardar links, búsqueda, categorías, badge counter |
| [`api-doc.md`](./api-doc.md) | **API Contracts** | Endpoints, errores, auth y frontera frontend `services + /api/proxy` |

---

## 📖 Contenido por Archivo

### `db-layer.md` - Database Layer (Phase 2)

**Qué incluye:**
- 🏗️ Arquitectura general (SQLite + Bun + Nueva ubicación de DB)
- 📊 Esquema completo (11 tablas + triggers FTS5)
- 🔍 Componentes del sistema (connection, verify, migrations, queries)
- 🛡️ Smoke Test de inicio para garantizar salud del sistema
- 🎯 Patrones y best practices (lastInsertRowid, db.run forward compatibility)
- 🧪 Testing suite (21 tests)
- 🐛 Troubleshooting guide
- 🔐 Security tips

**Ideal para:**
- Entender la estructura de la base de datos
- Aprender a usar las queries CRUD
- Debuggear problemas comunes
- Contribuir al backend

### `phase03-authentication-layer.md` - Authentication Layer (Phase 3)

**Que incluye:**
- Objetivo de la fase y decisiones de arquitectura de auth
- Estado final de secciones 3.1 a 3.7
- Estado parcial de 3.8 (hecho vs pendiente)
- Hitos de tests (65/65, 163/163, 184/184, 218/218)
- Lecciones clave y modulos relevantes por area
- Proximos pasos recomendados (cerrar 3.8 y avanzar a 3.9)

**Ideal para:**
- Onboarding rapido de auth y seguridad
- Entender decisiones de Better Auth + sesiones stateful
- Identificar rapido que falta para cerrar la Fase 3

### `phase4-architecture-checkpoint-4-0.md` - Architecture Checkpoint (Phase 4.0)

**Que incluye:**
- Reglas de frontera `routes -> services -> db` para la superficie API de Phase 4
- Restricciones wiring-only para `backend/index.ts`
- Contrato deterministico de mapeo de errores de servicio a HTTP
- Comandos exactos para ejecutar el guard de arquitectura y tests de contrato

**Ideal para:**
- Revisar PRs de APIs nuevas sin ambiguedad de capas
- Detectar acoplamiento route-to-db antes de merge
- Arrancar 4.1+ con contratos y gates ya definidos

 ### `phase08-frontend-public-pages.md` - Frontend Public Pages (Phase 8)

**Que incluye:**
- Alcance implementado para Home, Explore, perfiles publicos y auth publico
- Estado real de flujos login/register/forgot/reset/verify via server actions
- Estrategia API unica en frontend (`views/actions -> services -> /api/proxy/* -> backend`)
- Notas SSR/SEO y desvíos actuales respecto a la planificacion original

**Ideal para:**
- Onboarding rapido del frontend publico actual
- Saber que partes de Phase 8 estan cerradas y cuales quedaron como deuda
- Implementar nuevas vistas publicas sin romper la frontera de proxy

---

### `phase09-router-modular-refactor.md` - Router Modular Refactor (Phase 9)

**Que incluye:**
- Refactorizacion del sistema de rutas de monolitico (193 lineas) a modular (99 lineas)
- Arquitectura por feature: public.routes.ts, auth.routes.ts, dashboard.routes.ts, api.routes.ts
- Tipo RouteDefinition y helper registerRoutes() con validacion de duplicados
- 32 tests creados (unit + integration) con 100% pass rate
- Decisiones tecnicas y lecciones aprendidas

**Ideal para:**
- Entender la arquitectura modular de rutas en frontend-bun-ejs
- Agregar nuevas rutas siguiendo el patron establecido
- Aprender sobre configuration-as-code pattern y incremental refactoring
- Conocer el SDD workflow completo aplicado a una refactorizacion real

### `phase10-chrome-extension.md` - Chrome Extension (Phase 10)

**Qué incluye:**
- Stack técnico elegido (Vanilla JS + HTML, Manifest V3, sin build step)
- Alcance implementado (auth, guardar links, búsqueda, categorías, badge counter)
- Arquitectura popup ↔ background ↔ backend con diagramas
- Integración con URLoft API (endpoints usados, estrategia de auth con session tokens)
- UI/UX del popup (descripción visual, flujo de usuario típico)
- Estado actual (qué funciona, deuda técnica, issues conocidos)
- Próximos pasos (features faltantes, mejoras planeadas)
- Referencias técnicas (Chrome APIs usadas, patrones de código, troubleshooting)
- Checklist de publicación en Chrome Web Store

**Ideal para:**
- Entender la arquitectura completa de la extensión de Chrome
- Conocer el cambio de API Key a email/password (Better Auth)
- Aprender cómo integrar una extensión de Chrome con una API REST
- Contribuir a la extensión o agregar nuevas features
- Publicar la extensión en Chrome Web Store

### `api-doc.md` - API Contracts y estrategia de consumo frontend

**Que incluye:**
- Catalogo de endpoints REST, MCP y Web Skill
- Contrato de errores de Phase 4
- Comportamiento actual de links de email (verificacion/reset apuntando al frontend)
- Guia corta para agregar nuevos endpoints en la frontera `services + /api/proxy/*`

**Ideal para:**
- Integrar frontend/backend manteniendo una sola estrategia de acceso a API
- Entender el flujo completo desde email link hasta endpoint backend real
- Extender la API sin acoplar componentes UI al backend directamente

---

## 🚀 Cómo Navegar

 ### Para desarrolladores nuevos:
 1. Empieza con [`db-layer.md`](./db-layer.md) para entender la base de datos
 2. Continua con [`phase03-authentication-layer.md`](./phase03-authentication-layer.md) para entender la capa de auth
 3. Lee [`phase07-frontend-sveltekit-setup.md`](./phase07-frontend-sveltekit-setup.md) para la base del frontend
 4. Lee [`phase08-frontend-public-pages.md`](./phase08-frontend-public-pages.md) para el estado real de paginas publicas
 5. Lee [`phase09-router-modular-refactor.md`](./phase09-router-modular-refactor.md) para entender la arquitectura modular de rutas
 6. Lee [`phase10-chrome-extension.md`](./phase10-chrome-extension.md) para entender la extensión de Chrome
 7. Revisa [`api-doc.md`](./api-doc.md) antes de tocar contratos o integraciones
 8. Consulta "Troubleshooting" si encuentras errores

### Para contribuidores:
1. Lee "Patrones y Best Practices" antes de hacer cambios
2. Ejecuta los tests descritos en "Testing" después de modificar
3. Sigue las convenciones de código documentadas

---

## 📝 Convenciones

- **Fase**: Cada archivo corresponde a una fase del desarrollo
- **Versión**: Los archivos incluyen fecha y versión al inicio
- **Idioma**: Español (Rioplatense) para mantener consistencia con el equipo

---

## 🔗 Documentación Externa

- [README Principal](../README.md) - Visión general del proyecto
- [AGENTS.md](../AGENTS.md) - Reglas y configuración de agentes
- [Documentación de Bun](https://bun.sh/docs)
- [SQLite Documentation](https://www.sqlite.org/docs.html)

---

## 📌 Notas

- Esta carpeta se irá expandiendo a medida que avancen las fases
- Cada fase nueva agregará su propio archivo de documentación
- Los archivos se nombran con el formato `{layer}.md` (ej: `db-layer.md`, `auth-layer.md`)

---

 **Última actualización**: 2026-03-28
**Versión**: 1.3.0
