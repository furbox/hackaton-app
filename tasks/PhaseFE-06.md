# Tasks: Phase FE-6 - Missing Pages (Crítico)

> **Change:** Implementar la única página faltante para completar el feature set del hackatón.
> **Focus:** Importar bookmarks desde Chrome/Firefox (HTML export)

---

## Objetivo y alcance

Implementar la página `/dashboard/import` que permite a los usuarios subir su archivo HTML de bookmarks exportado desde Chrome o Firefox, procesarlo y crear links automáticamente vía el endpoint `POST /api/links/import` que ya existe en el backend.

---

## Phase FE-6: Import Bookmarks Page

### FE-6.1: Create GET /dashboard/import controller and EJS template

- [ ] **FE-6.1.1** Crear `frontend-bun-ejs/src/controllers/dashboard/import.controller.ts` con handler `GET /dashboard/import`
  - Verificar autenticación con `requireAuth()`
  - Renderizar template `views/pages/dashboard/import.ejs` con:
    - Instrucciones para exportar bookmarks desde Chrome/Firefox
    - Formulario file upload (drag & drop support)
    - Ejemplo de formato HTML esperado

- [ ] **FE-6.1.2** Crear `frontend-bun-ejs/views/pages/dashboard/import.ejs`
  - **Layout:** Usar layout base con nav de dashboard
  - **Hero Section:** Título "Importar Bookmarks", descripción de funcionalidad
  - **Instructions:** Steps para exportar desde Chrome y Firefox
    - Chrome: Bookmarks → Bookmark manager → Export bookmarks
    - Firefox: Bookmarks → Show all bookmarks → Import and Backup → Export
  - **File Upload Form:**
    - `<input type="file" accept=".html,.htm">`
    - Drag & drop zone con visual feedback
    - Botón "Importar Bookmarks"
  - **Preview:** Mostrar estructura esperada del HTML (Netscape Bookmark File format)

**Acceptance Criteria**
- Template renderiza correctamente con layout de dashboard
- Instrucciones son claras y fáciles de seguir
- File upload form tiene UX decente (drag & drop visual)
- Página es accesible desde nav de dashboard

**Dependencias internas**
- Requiere middleware `requireAuth()` en `src/middleware/session.ts`
- Requiere layout base `views/layouts/base.ejs`

---

### FE-6.2: Implement POST /dashboard/import with file upload handling

- [ ] **FE-6.2.1** Crear handler `POST /dashboard/import` en `import.controller.ts`
  - Verificar autenticación con `requireAuth()`
  - Parsear `FormData` del request para extraer file upload
  - Validar que el archivo es HTML (extension `.html` o `.htm`)
  - Leer contenido del archivo con `await file.text()` o `Bun.file()`

- [ ] **FE-6.2.2** Procesar contenido HTML y extraer bookmarks
  - Parsear formato Netscape Bookmark File (standard Chrome/Firefox export)
  - Extraer: URL, título, descripción opcional, fecha de agregado
  - Agrupar por carpetas (convertir a categorías)
  - Detectar duplicados (URLs ya existentes en BD del usuario)

- [ ] **FE-6.2.3** Llamar backend endpoint `POST /api/links/import`
  - Enviar payload con:
    ```json
    {
      "bookmarks": [
        { "url": "https://...", "title": "...", "description": "...", "category": "..." }
      ]
    }
    ```
  - Backend ya está implementado (`backend/routes/api/links.ts` → `POST /api/links/import`)
  - Manejar respuesta: `{ imported: number, duplicates: number, categories: string[] }`

- [ ] **FE-6.2.4** Redirect a summary view
  - Opción A: Redirect a `/dashboard/links` con flash message "Importados X links, Y duplicados"
  - Opción B: Renderizar summary inline con stats y link a ver links
  - Guardar stats en query params o session para mostrar en summary

**Acceptance Criteria**
- File upload funciona correctamente (HTML files only)
- Parser maneja formato Netscape Bookmark File correctamente
- Duplicados se detectan y no se re-importan
- Carpetas de Firefox se convierten a categorías
- Backend endpoint responde con stats correctos
- Usuario recibe feedback claro sobre resultado de importación

**API Contracts**
- `POST /api/links/import` → Backend endpoint ya implementado
  - Request: `{ bookmarks: Array<{ url, title, description?, category? }> }`
  - Response: `{ imported: number, duplicates: number, categories: string[] }`

**Formato Netscape Bookmark File (Ejemplo)**
```html
<!DOCTYPE NETSCAPE-Bookmark-file-1>
<!-- This is an automatically generated file.
     It will be read and overwritten.
     DO NOT EDIT! -->
<META HTTP-EQUIV="Content-Type" CONTENT="text/html; charset=UTF-8">
<TITLE>Bookmarks</TITLE>
<H1>Bookmarks</H1>
<DL><p>
  <DT><H3 ADD_DATE="1234567890">Development</H3>
  <DL><p>
    <DT><A HREF="https://github.com" ADD_DATE="1234567890">GitHub</A>
    <DD>Where the world builds software
    <DT><A HREF="https://stackoverflow.com" ADD_DATE="1234567890">Stack Overflow</A>
  </DL><p>
  <DT><H3 ADD_DATE="1234567890">News</H3>
  <DL><p>
    <DT><A HREF="https://news.ycombinator.com" ADD_DATE="1234567890">Hacker News</A>
  </DL><p>
</DL><p>
```

**Dependencias internas**
- Requiere backend endpoint `POST /api/links/import` funcional
- Requiere cliente HTTP proxy en `src/api/client.ts`

---

### FE-6.3: Add import summary view

- [ ] **FE-6.3.1** Crear vista de resumen post-importación
  - **Opción A (Simple):** Flash message en redirect a `/dashboard/links`
    - "✅ Importación completada: X links creados, Y duplicados, Z categorías nuevas"
  - **Opción B (Dedicada):** Nueva página `/dashboard/import/summary`
    - Mostrar stats con cards (importados, duplicados, categorías)
    - Tabla de links importados (preview)
    - Botón "Ver todos mis links" → `/dashboard/links`
    - Botón "Importar más" → `/dashboard/import`

- [ ] **FE-6.3.2** Agregar link a nav de dashboard
  - Agregar item en sidebar o nav: "Importar Bookmarks"
  - Ubicación: Junto a "Links", "Categories", etc.

**Acceptance Criteria**
- Usuario ve feedback claro sobre resultado de importación
- Stats son accurate y útiles
- Call-to-action clara (ver links o importar más)
- Nav de dashboard incluye link a import page

**Dependencias internas**
- Requiere FE-6.1 y FE-6.2 completadas

---

## Definition of Done - Phase FE-6

- [ ] Template EJS `import.ejs` creado con instrucciones y file upload form
- [ ] Controller `import.controller.ts` creado con handlers GET y POST
- [ ] File upload funciona (HTML files only, validation correcta)
- [ ] Parser de Netscape Bookmark File maneja correctamente:
  - Links con URL, título, descripción
  - Agrupación por carpetas (→ categorías)
  - Detección de duplicados
- [ ] Backend endpoint `POST /api/links/import` se llama correctamente
- [ ] Vista de resumen muestra stats correctos
- [ ] Nav de dashboard incluye link a `/dashboard/import`
- [ ] Flujo completo funciona: Exportar bookmarks de Chrome → Subir archivo → Ver resumen → Links creados

---

## Implementation Order

**Execute sequentially:** FE-6.1 → FE-6.2 → FE-6.3

**Rationale:**
- FE-6.1 crea la UI y base para el flujo
- FE-6.2 implementa la lógica core de parseo e importación
- FE-6.3 agrega feedback y accesibilidad desde nav

---

## Testing Checklist

Una vez implementado, probar estos escenarios:

### Happy Path
1. **Exportar bookmarks desde Chrome:**
   - Abrir Chrome → Bookmarks → Bookmark manager → Export bookmarks
   - Guardar archivo `bookmarks.html`

2. **Importar en URLoft:**
   - Login → Dashboard → Importar Bookmarks
   - Drag & drop file o click para seleccionar
   - Submit "Importar Bookmarks"
   - Ver resumen: "X links importados, Y duplicados, Z categorías"

3. **Verificar importación:**
   - Ir a `/dashboard/links`
   - Verificar que links aparecen con títulos correctos
   - Verificar que categorías de carpetas se crearon

### Edge Cases
- [ ] Archivo vacío → Mostrar error "No bookmarks encontrados"
- [ ] Archivo inválido (no es HTML) → Mostrar error "Formato inválido"
- [ ] Archivo con 0 links válidos → Mostrar warning
- [ ] Archivo con 1000+ links → Manejar sin timeout
- [ ] Duplicados (URLs ya existen) → No re-importar, mostrar count
- [ ] Links sin título → Usar URL como fallback
- [ ] Links sin descripción → Dejar vacío
- [ ] Caracteres especiales en títulos → Manejar encoding UTF-8

---

## Bonus Improvements (Opcional)

Si hay tiempo post-MVP:

- **FE-6.4:** Agregar preview de bookmarks antes de importar
- **FE-6.5:** Permitir seleccionar qué bookmarks importar (checkbox list)
- **FE-6.6:** Agregar mapping de carpetas a categorías existentes
- **FE-6.7:** Soportar otros formatos (JSON desde Safari, CSV desde otros managers)
- **FE-6.8:** Agregar progress bar para importaciones grandes (1000+ links)

---

**Total Sub-Tasks:** 12 across 3 parent tasks
**Dependencies:** Backend Phase 4 complete (`POST /api/links/import` endpoint functional)
**Estimated Time:** 2-3 horas (incluyendo testing)
**Priority:** ALTA - Única página faltante para completar feature set del hackatón
