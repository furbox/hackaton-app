# Proposal: Behind the Scenes Page

## Intent

Crear una página pública "Cómo lo hice" para documentar el proceso de desarrollo de URLoft durante el Hackathon 2026 midudev. Esta página permitirá compartir videos de desarrollo y tutoriales con la comunidad, mostrando el detrás de cámaras del proyecto.

## Scope

### In Scope
- **Ruta pública**: `/como-lo-hice` accesible sin autenticación
- **Archivo de datos JSON**: `public/videos.json` con estructura para hero, featured video y lista de videos
- **Integración Alpine.js**: Fetch asíncrono del JSON con loading y error states
- **Sección Hero**: Título y descripción configurables desde JSON
- **Video destacado**: Display prominente (16:9) si `featured` no es null
- **Grid de videos**: Lista de videos con thumbnails de YouTube, títulos y descripciones
- **Embed de YouTube**: iframes responsive con formato `youtube.com/embed/{id}`
- **Navegación**: Link en nav.ejs después de "Explore"

### Out of Scope
- **Backend CRUD**: El usuario editará el JSON manualmente (no se requiere panel de administración)
- **Sistema de comentarios**: Solo visualización de videos
- **Upload de videos**: Los videos se alojarán en YouTube, solo se incrustan
- **Búsqueda de videos**: Listado simple sin filtros ni búsqueda
- **Analytics**: No se integrarán métricas de visualización

## Approach

**Estrategia**: Archivo JSON estático en `public/` con Alpine.js en el cliente.

**Por qué este enfoque**:
- No requiere reinicio del servidor al editar JSON
- Sigue el patrón existente de archivos estáticos del proyecto
- Separación clara entre datos y presentación
- Bajo riesgo de implementación

**Componentes**:
1. **Controlador**: Renderiza view.ejs con Alpine.js data binding
2. **Template EJS**: HTML estructurado con componentes UI existentes
3. **JSON**: Estructura `{ hero, featured, videos }`
4. **Fetch Alpine**: `x-data="loadVideos()"` con async/await

## Affected Areas

| Área | Impacto | Descripción |
|------|--------|-------------|
| `frontend-bun-ejs/index.ts` | Modificar | Registrar ruta `/como-lo-hice` |
| `frontend-bun-ejs/src/controllers/behind-scenes.controller.ts` | Nuevo | Controlador que renderiza la vista |
| `frontend-bun-ejs/views/pages/behind-scenes.ejs` | Nuevo | Template con Alpine.js y YouTube embeds |
| `frontend-bun-ejs/views/partials/nav.ejs` | Modificar | Agregar link después de "Explore" |
| `frontend-bun-ejs/public/videos.json` | Nuevo | Datos de videos (hero, featured, videos[]) |

## Risks

| Riesgo | Probabilidad | Mitigación |
|--------|--------------|------------|
| JSON malformado rompe la página | Media | Validación en Alpine.js + fallback UI |
| YouTube ID incorrecto | Alta | Error handling en embed + thumbnail fallback |
| Cambios en YouTube embed API | Baja | Usar formato estándar estable de YouTube |
| Archivo JSON no encontrado | Media | Loading state + mensaje de error amigable |

## Rollback Plan

1. **Eliminar ruta**: Remover registro de `/como-lo-hice` de `index.ts`
2. **Eliminar archivos**: Borrar controller, view y JSON
3. **Revertir nav**: Quitar link del nav.ejs
4. **Sin impacto en DB**: No se realizaron cambios en base de datos

**Tiempo de rollback**: < 5 minutos (solo eliminar archivos agregados)

## Dependencies

- **YouTube**: Videos deben estar subidos a YouTube (hosting externo)
- **Alpine.js**: Ya usado en el proyecto, versión actual compatible
- **UI Components**: Reutilizar componentes existentes (ui-card, etc.)

## Success Criteria

- [ ] La ruta `/como-lo-hice` responde con status 200
- [ ] El JSON se carga correctamente sin errores de JavaScript
- [ ] La sección hero muestra título y descripción del JSON
- [ ] El video destacado (si existe) se muestra en embed 16:9 funcional
- [ ] El grid de videos muestra thumbnails correctos de YouTube
- [ ] Los videos reproducen correctamente en el iframe
- [ ] El link de navegación aparece y funciona en el menú
- [ ] La página es responsive en mobile y desktop
- [ ] Loading state muestra mientras se fetchea el JSON
- [ ] Error handling funciona si JSON está corrupto o no existe
