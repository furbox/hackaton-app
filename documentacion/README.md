# 📚 Documentación URLoft

> **Documentación técnica organizada del proyecto URLoft**

## 📂 Estructura

| Archivo | Descripción | Secciones |
|---------|-------------|-----------|
| [`db-layer.md`](./db-layer.md) | **Phase 2: Database Layer** | Arquitectura, esquema, queries, testing, troubleshooting |
| [`phase03-authentication-layer.md`](./phase03-authentication-layer.md) | **Phase 3: Authentication Layer** | Objetivo, decisiones de arquitectura auth, estado 3.1-3.8, testing, pendientes |

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

---

## 🚀 Cómo Navegar

### Para desarrolladores nuevos:
1. Empieza con [`db-layer.md`](./db-layer.md) para entender la base de datos
2. Continua con [`phase03-authentication-layer.md`](./phase03-authentication-layer.md) para entender la capa de auth
3. Revisa las secciones de "Componentes del Sistema" para ver el código
4. Consulta "Troubleshooting" si encuentras errores

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

**Última actualización**: 2026-03-24  
**Versión**: 1.1.0
