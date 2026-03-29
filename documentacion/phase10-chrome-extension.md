# 🔌 Phase 10: Chrome Extension

> **Extensión de Chrome URLoft — Guarda, organiza y busca tus links desde cualquier página.**

---

## 📋 Objetivo de la Fase

Implementar una extensión de Chrome que permita a los usuarios guardar links rápidamente mientras navegan, sin tener que visitar el sitio web de URLoft. La extensión se integra en el flujo natural de navegación y proporciona acceso instantáneo a la biblioteca personal de links.

### Meta Principal

**Puntos fuertes de la extensión:**
1. **AGREGAR** — Guardar la página actual con metadata automática
2. **BUSCAR** — Encontrar links guardados con filtros y búsqueda full-text

### Stack Tecnológico Elegido

| Componente | Tecnología | Justificación |
|------------|-----------|---------------|
| **Manifest** | V3 | Única versión soportada por Chrome (MV2 deprecated) |
| **Popup UI** | **Vanilla JS + HTML** | CERO dependencias, CERO build step, máxima velocidad |
| **Build Tool** | **Ninguno** | Solo archivos estáticos, desarrollo instantáneo |
| **Storage** | chrome.storage.local | Persistencia de sesiones y cache |
| **Background** | Service Worker | Manejo de badge y listeners de storage |
| **Auth** | Better Auth (email/password) | Login nativo, session tokens como el frontend |

**Justificación de Vanilla JS:**

1. **Speed > Todo**: Es un hackathon. Editar un archivo `.js` o `.html` y recargar la extensión en Chrome es instantáneo.
2. **CERO Build Step**: Sin configuración de bundlers, sin transpilación, sin dramas.
3. **Performance Nativa**: El popup se carga en menos de 10ms. Sin overhead de frameworks.
4. **Simplicidad**: Control total sobre las APIs de Chrome (tabs, storage, messaging).

**Trade-off aceptado:**
Más código boilerplate (manejo manual del DOM) a cambio de eliminar complejidad accidental de herramientas de build.

---

## ✅ Alcance Implementado

### Features Funcionales

#### 1. Autenticación (Email/Password)

**Implementado:**
- ✅ Login con email y contraseña vía `POST /api/auth/login`
- ✅ Session token almacenado en `chrome.storage.local`
- ✅ Validación de sesión al inicio (probe `GET /api/categories`)
- ✅ Logout con confirmación
- ✅ Manejo global de 401 (sesión expirada)

**Cambio vs SPEC:**
- **SPEC original**: Auth con API Key
- **Implementación real**: Auth con email/password (Better Auth)
- **Motivo**: Consistencia con el frontend SvelteKit y mejor UX

**Archivos:**
- `popup/js/auth.js` — Lógica de login
- `popup/js/app.js` — Validación de sesión y manejo de 401 global

#### 2. Guardar Página Actual

**Implementado:**
- ✅ Extracción automática de metadata (URL, título, meta description)
- ✅ Inyección de script para obtener meta description
- ✅ Detección de duplicados vía `GET /api/skill/lookup`
- ✅ Selección de categoría con dropdown custom
- ✅ Crear categoría al vuelo (color swatches)
- ✅ Toggle de visibilidad pública/privada
- ✅ Feedback visual con toast notifications
- ✅ Incremento del badge counter

**Flujo de usuario:**
1. Usuario abre el popup en la pestaña "Guardar"
2. URL y título se extraen automáticamente de la pestaña activa
3. Meta description se extrae via scripting (si es posible)
4. Sistema verifica si el link ya existe (duplicate check)
5. Si es duplicado → muestra warning con link existente
6. Si es nuevo → usuario puede editar título, descripción, categoría
7. Click en "Guardar Link" → POST /api/links

**Archivos:**
- `popup/js/save-link.js` (569 líneas) — Lógica completa del tab
- `popup/js/api.js` — Cliente HTTP con auth header

#### 3. Buscar Mis Links

**Implementado:**
- ✅ Búsqueda full-text con debounce (300ms)
- ✅ Filtros: sort (recientes, likes, views, favoritos)
- ✅ Filtro por categoría
- ✅ Paginación con botón "Cargar más"
- ✅ Link cards con título, hostname, fecha, categoría
- ✅ Click en card abre link en nueva pestaña
- ✅ Estado vacío con mensaje amigable

**Paginación:**
- Limit: 20 links por página
- Detección automática de hasMore
- Botón "Cargar más" solo aparece cuando hay más resultados

**Archivos:**
- `popup/js/search.js` (239 líneas) — Lógica de búsqueda

#### 4. Gestión de Categorías

**Implementado:**
- ✅ Listar categorías del usuario
- ✅ Dropdown custom accesible (ARIA, keyboard nav)
- ✅ Crear categoría al vuelo con color picker
- ✅ Auto-seleccionar categoría creada
- ✅ 6 colores predefinidos (rojo, naranja, amarillo, verde, azul, púrpura)

**Dropdown Custom Features:**
- Position inteligente (arriba/abajo según viewport)
- Keyboard navigation (Arrow keys, Enter, Escape)
- Click outside para cerrar
- ARIA attributes para accesibilidad

**Archivos:**
- `popup/js/save-link.js` — `_initCategoryDropdown()` (300+ líneas)

#### 5. Badge Counter

**Implementado:**
- ✅ Contador de links agregados hoy
- ✅ Reset automático al cambiar de día
- ✅ Badge purple `#6366f1` con número
- ✅ Icono rojo + "!" cuando no hay auth
- ✅ Actualización via chrome.runtime.sendMessage

**Storage:**
```javascript
{
  stats: {
    linksAddedToday: 5,
    lastResetDate: '2026-03-28'
  }
}
```

**Archivos:**
- `background/service-worker.js` — `updateBadge()` (128 líneas)
- `popup/js/save-link.js` — `_incrementBadge()`

#### 6. Configuración de Backend URL

**Implementado:**
- ✅ Input para cambiar backend URL
- ✅ Botón "Guardar" con validación de URL
- ✅ Botón "Reset" para volver a default
- ✅ Persistencia en chrome.storage.local
- ✅ Validación de protocolo (http/https)

**Default:** `http://localhost:3000`

**Archivos:**
- `popup/js/app.js` — `_initApiBaseUrlSettings()`
- `popup/js/storage.js` — `getApiBaseUrl()`

### Componentes Creados

| Archivo | Líneas | Responsabilidad |
|---------|--------|-----------------|
| `manifest.json` | 31 | Configuración MV3, permisos, host_permissions |
| `background/service-worker.js` | 128 | Badge updater, storage listeners, init |
| `popup/html/popup.html` | 305 | Estructura HTML del popup (3 vistas) |
| `popup/js/app.js` | 276 | Routing de vistas, tabs, logout, 401 global |
| `popup/js/auth.js` | 115 | Login con email/password |
| `popup/js/api.js` | 172 | Cliente HTTP con auth y error handling |
| `popup/js/save-link.js` | 569 | Tab "Guardar" (metadata, duplicados, categorías) |
| `popup/js/search.js` | 239 | Tab "Mis Links" (búsqueda, paginación) |
| `popup/js/storage.js` | 102 | chrome.storage.local helpers |
| `popup/js/utils.js` | 149 | Utilidades (toast, debounce, formatDate, etc) |
| `popup/css/popup.css` | 887 | Estilos completos del popup |

**Total:** ~3,000 líneas de código (incluye HTML, CSS, JS)

---

## 🏗️ Arquitectura

### Manifest V3 Estructura

**Permisos:**
```json
{
  "permissions": ["activeTab", "storage", "scripting"],
  "host_permissions": [
    "https://urloft.site/*",
    "http://localhost:3000/*",
    "https://api.urloft.site/*",
    "https://api-new.urloft.site/*"
  ]
}
```

**Permisos explicados:**
| Permiso | Para qué sirve |
|---------|----------------|
| `activeTab` | Acceder a URL y metadata de la pestaña activa |
| `storage` | Guardar session token, cache, stats |
| `scripting` | Inyectar scripts para extraer meta description |
| `host_permissions` | Permitir requests a la API de URLoft |

### Comunicación Popup ↔ Background ↔ Backend

**Diagrama de arquitectura:**

```
┌─────────────────────────────────────────────────────────┐
│                    Popup UI (Vanilla JS)                │
│  ┌─────────┐  ┌─────────┐  ┌─────────────────────────┐ │
│  │  Auth   │  │  Save   │  │       Search            │ │
│  │  View   │  │  View   │  │       View              │ │
│  └────┬────┘  └────┬────┘  └──────────┬──────────────┘ │
│       │            │                    │               │
│       └────────────┴────────────────────┘               │
│                    │                                    │
│           ┌────────▼────────┐                          │
│           │   app.js        │                          │
│           │   (state,       │                          │
│           │    routing)     │                          │
│           └────────┬────────┘                          │
└────────────────────┼───────────────────────────────────┘
                     │
         ┌───────────▼───────────┐
         │ chrome.storage.local  │
         │ (apiKey, userEmail,   │
         │  stats, apiBaseUrl)   │
         └───────────┬───────────┘
                     │
         ┌───────────▼───────────┐
         │  Background Service   │
         │       Worker          │
         │  (badge updater,      │
         │   storage listeners)  │
         └───────────────────────┘
                     │
         ┌───────────▼───────────┐
         │  URLoft API (Bun)     │
         │  /api/auth/login      │
         │  /api/links           │
         │  /api/categories      │
         └───────────────────────┘
```

### Manejo de Auth/Sesiones

**Estrategia: Better Auth con Session Tokens**

A diferencia de la SPEC original (API Key), la extensión implementa el mismo flujo de autenticación que el frontend SvelteKit:

1. **Login flow:**
   ```
   Usuario ingresa email/password
   → POST /api/auth/login
   ← { token, user }
   → Guardar token en chrome.storage.local como 'apiKey'
   → Mostrar vista principal
   ```

2. **Validación de sesión:**
   ```
   Al abrir popup
   → Leer token de storage
   → GET /api/categories (probe endpoint)
   ← 200 OK → Sesión válida
   ← 401 → Sesión expirada, borrar token, mostrar auth
   ```

3. **Manejo global de 401:**
   ```
   Cualquier request con 401
   → Dispatch 'urloft:unauthorized' event
   → app.js listener detecta
   → Borrar storage
   → Mostrar auth view con "Sesión expirada"
   ```

**Guard de auth-in-progress:**
- Variable `isAuthenticating` en `app.js` previene que 401s concurrentes sobreescriban el mensaje de error del login

---

## 🔌 Integración con URLoft API

### Endpoints Usados

| Endpoint | Método | Para qué | Archivo |
|----------|--------|----------|---------|
| `/api/auth/login` | POST | Login con email/password | `api.js` |
| `/api/links` | POST | Crear link | `api.js` |
| `/api/links` | GET | Buscar links (con filtros) | `api.js` |
| `/api/skill/lookup?url=` | GET | Verificar duplicados | `api.js` |
| `/api/categories` | GET | Listar categorías | `api.js` |
| `/api/categories` | POST | Crear categoría | `api.js` |

### Estrategia de Autenticación

**Header en todas las requests autenticadas:**
```javascript
headers: {
  'Content-Type': 'application/json',
  'Authorization': `Bearer ${state.apiKey}`  // Session token
}
```

**Error handling:**
```javascript
if (response.status === 401) {
  const err = new Error('Unauthorized');
  err.code = 'UNAUTHORIZED';
  throw err;
}

if (response.status === 429) {
  const err = new Error('Rate limit exceeded');
  err.code = 'RATE_LIMIT';
  throw err;
}
```

### Sincronización de Datos

**Sin caché explícito:**
- A diferencia de la SPEC, NO se implementa cache de links en chrome.storage
- Todas las búsquedas van directo a la API
- Único cacheado: session token y stats

**Motivo:** Simplicidad. El popup es rápido y la API es local.

---

## 🎨 UI/UX del Popup

### Descripción Visual

**Dimensiones:** 350px de ancho x 500px de alto (aprox)

**Estructura:**
```
┌──────────────────────────────────┐
│  🔗 URLoft          email@... 🚪 │  ← Header
├──────────────────────────────────┤
│  Backend URL: [localhost...] [G] │  ← Settings
├──────────────────────────────────┤
│  [💾 Guardar] [🔍 Mis Links]     │  ← Tabs
├──────────────────────────────────┤
│                                  │
│  URL:        [https://...]       │  ← Form
│  Título:     [Amazing Article]   │
│  Descripción: [Learn about...]   │
│  Categoría:  [Dev ▾] [+ Nueva]  │
│  ☐ Hacer público                │
│              [Guardar Link]      │
│                                  │
└──────────────────────────────────┘
```

### Flujo de Usuario Típico

**1. Instalación y primer uso:**
```
1. Usuario instala extensión
2. Click en icono → Popup se abre
3. Ve formulario de login
4. Ingresa email/password
5. Click "Iniciar sesión"
6. ✅ Conectado → Ve popup principal
```

**2. Guardar un link:**
```
1. Usuario está en una página interesante
2. Click en icono de extensión
3. Popup se abre con URL y título precargados
4. (Opcional) Edita título, elige categoría
5. Click "Guardar Link"
6. ✅ Toast "¡Link guardado! 🎉"
7. ✅ Badge counter incrementa
```

**3. Buscar links:**
```
1. Usuario abre popup
2. Cambia a tab "Mis Links"
3. Escribe en search bar
4. Resultados filtran en tiempo real (debounce 300ms)
5. Click en link card → Abre en nueva pestaña
```

### Componentes Alpine.js/EJS

**NOTA:** A diferencia de la SPEC que menciona Alpine.js/EJS, la implementación real usa **Vanilla JS puro**.

**Razón:**
- Alpine.js requiere un build step o CDN externo
- Para extensiones de Chrome, Vanilla JS es más simple y rápido
- Menos dependencias = menos problemas con CSP

**Patrón de componentes:**
- Cada módulo exporta una función `init*()`
- Ejemplo: `initSaveLink(state)`, `initSearch(state)`
- Limpieza de listeners al cambiar de tab

---

## 📊 Estado Actual

### Qué Funciona ✅

| Feature | Estado | Notas |
|---------|--------|-------|
| Login con email/password | ✅ Funcional | Session tokens, 401 handling |
| Guardar página actual | ✅ Funcional | Metadata auto, duplicados, categorías |
| Buscar links | ✅ Funcional | Full-text, filtros, paginación |
| Gestión de categorías | ✅ Funcional | Listar, crear, dropdown custom |
| Badge counter | ✅ Funcional | Links agregados hoy, reset diario |
| Configuración backend URL | ✅ Funcional | Validación, persistencia |
| Toast notifications | ✅ Funcional | Success, error, warning, info |
| Manejo de errores | ✅ Funcional | 401, 429, network errors |

### Deuda Técnica / Mejoras Pendientes

**Feature gaps vs SPEC:**

| Feature de SPEC | Estado | Comentario |
|-----------------|--------|------------|
| Detectar links en página | ❌ No implementado | Content script existe pero no se usa |
| Importar múltiples links | ❌ No implementado | No está en el MVP actual |
| Modo dark/light | ⚠️ Parcial | Solo variables CSS, no toggle |
| Offline mode | ❌ No implementado | Cache de links no implementado |
| Quick capture (shortcuts) | ❌ No implementado | Post-MVP |

**Deuda técnica menor:**

1. **Tests manuales**: No hay tests automatizados para la extensión
2. **Screenshot assets**: Faltan screenshots para Chrome Web Store
3. **Política de privacidad**: No hay documento de privacidad inline
4. **Ícono de error**: `icon-error-128.png` existe pero no se muestra correctamente en algunos casos

**Issues conocidos:**

1. **Meta description extraction**: Falla en páginas restringidas (chrome://, file://)
2. **Dropdown positioning**: En viewports muy pequeños puede cortarse
3. **401 race condition**: Raro, pero puede pasar si el usuario hace múltiples requests rápidos

---

## 🚀 Próximos Pasos

### Features Faltantes (Post-MVP)

**Prioridad ALTA:**

1. **Tests automatizados**
   - Usar Puppeteer o Playwright para testear el popup
   - Testear flujo completo: login → guardar → buscar
   - Testear manejo de errores (401, 429, network)

2. **Content script - Detectar links**
   ```javascript
   // Implementar extraction de links de la página
   function extractLinksFromPage() {
     document.querySelectorAll('a[href]').forEach(...)
   }
   ```

3. **Importar múltiples links**
   - Checkbox selection en lista de links extraídos
   - Batch create via API (si está disponible)

**Prioridad MEDIA:**

4. **Mejoras de UX**
   - Keyboard shortcuts (Cmd+Shift+L para abrir popup)
   - Quick capture desde context menu (click derecho → "Guardar link")
   - Animaciones de micro-interacciones

5. **Offline mode**
   - Cache de links en chrome.storage (TTL 5 min)
   - Queue de operaciones offline
   - Sincronización cuando vuelve la conexión

**Prioridad BAJA:**

6. **Modo dark**
   - Toggle manual en settings
   - Persistencia en storage
   - Transiciones suaves

7. **Sincronización de categorías**
   - Cache de categorías para evitar re-fetch
   - Invalidación inteligente

### Mejoras Planeadas

**Publicación en Chrome Web Store:**

1. **Screenshots:**
   - Captura del popup (350x500)
   - Captura del flujo de guardar link
   - Captura del flujo de búsqueda

2. **Descripción:**
   ```
   Guarda, organiza y comparte tus links desde cualquier página.
   URLoft es tu biblioteca personal de links en la nube.
   ```

3. **Política de privacidad:**
   - Link a urloft.site/privacy
   - Documentar qué datos se almacenan (session token, stats)

**Documentación:**

1. **README para desarrolladores:**
   - Cómo cargar la extensión en modo desarrollo
   - Cómo debuggear (console.log, DevTools)
   - Cómo hacer build para producción

2. **Guía de contribución:**
   - Patrones de código (Vanilla JS, módulos ES6)
   - Cómo agregar nuevos tabs
   - Cómo agregar nuevos endpoints a la API

---

## 📚 Referencias Técnicas

### Chrome Extension APIs Usadas

| API | Para qué | Archivo |
|-----|----------|---------|
| `chrome.storage.local` | Persistencia de datos | `storage.js` |
| `chrome.tabs.query` | Obtener pestaña activa | `save-link.js` |
| `chrome.scripting.executeScript` | Extraer meta description | `save-link.js` |
| `chrome.action.setIcon` | Cambiar ícono (error/normal) | `service-worker.js` |
| `chrome.action.setBadgeText` | Mostrar contador | `service-worker.js` |
| `chrome.runtime.onMessage` | Comunicación popup ↔ background | `service-worker.js` |
| `chrome.tabs.create` | Abrir link en nueva pestaña | `search.js` |

### Patrones de Código

**1. Modularización con ES6:**
```javascript
// popup/js/app.js
import * as storage from './storage.js';
import { initAuth } from './auth.js';
import { initSaveLink } from './save-link.js';
```

**2. Estado global compartido:**
```javascript
// popup/js/app.js
export const state = {
  apiKey: null,
  userEmail: null,
  currentTab: 'save',
};
```

**3. Custom events para 401 global:**
```javascript
// popup/js/app.js
export function emitUnauthorized(message) {
  window.dispatchEvent(new CustomEvent('urloft:unauthorized', { detail: { message } }));
}

window.addEventListener('urloft:unauthorized', async (e) => {
  await _clearSession();
  showAuthView(e.detail?.message);
});
```

**4. Debounce para búsqueda:**
```javascript
// popup/js/utils.js
export function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}
```

**5. Dropdown custom accesible:**
```javascript
// popup/js/save-link.js - _initCategoryDropdown()
// - Keyboard navigation (Arrow keys, Enter, Escape)
// - ARIA attributes (aria-expanded, aria-selected)
// - Position inteligente (arriba/abajo según viewport)
// - Click outside para cerrar
```

### Troubleshooting

**Problema: "Sesión expirada" aparece cuando estoy logueando**

- **Causa:** 401 race condition
- **Solución:** Guard `isAuthenticating` en `app.js`

**Problema: No puedo extraer meta description de chrome:// URLs**

- **Causa:** chrome.scripting.executeScript falla en páginas restringidas
- **Solución:** Try/catch en `save-link.js`, dejar vacío si falla

**Problema: Dropdown se corta en viewports pequeños**

- **Causa:** Posicionamiento fijo hacia abajo
- **Solución:** Lógica de posición inteligente (arriba/abajo) en `_positionPanel()`

**Problema: Badge no se actualiza**

- **Causa:** chrome.runtime.sendMessage falla si SW no está listo
- **Solución:** Try/catch en `_incrementBadge()`, ignorar silenciosamente

---

## 🎯 Checklist de Publicación (Chrome Web Store)

Antes de publicar, verificar:

- [x] Todos los campos de `manifest.json` están completos
- [x] Iconos de 16x16, 48x48, 128x128 píxeles
- [ ] Screenshots de la extensión en uso (1280x800 o 640x400)
- [ ] Descripción clara y concisa (max 132 chars para short description)
- [ ] Política de privacidad (URL o documentación inline)
- [x] No hay código `eval()` o funciones inseguras
- [x] No hay hardcoded secrets (API keys, tokens, etc.)
- [ ] La extensión funciona en Chrome (última versión estable)
- [ ] No hay dependencias con vulnerabilidades críticas

---

## 📝 Convenciones de Código

### Nomenclatura

- **Archivos:** `kebab-case.js` (ej: `save-link.js`, `api.js`)
- **Funciones privadas:** `_camelCase` (ej: `_loadCategories()`)
- **Funciones públicas:** `camelCase` (ej: `initSaveLink()`)
- **Constantes:** `UPPER_SNAKE_CASE` (ej: `DEFAULT_API_BASE_URL`)
- **Eventos custom:** `prefix:action` (ej: `urloft:unauthorized`)

### Estructura de Módulos

```javascript
/**
 * Módulo description
 * @module module-name
 */

// Imports
import { something } from './other.js';

// Private state
let _privateVar = null;

// Private functions
function _privateFunction() {
  // ...
}

// Public API
export function publicFunction() {
  // ...
}

export const PUBLIC_CONSTANT = 'value';
```

### Comments

- JSDoc para funciones públicas (`@param`, `@returns`)
- Comments inline para lógica compleja
- No comments obvios (ej: `// Increment counter`)

---

## 🔗 Documentación Relacionada

- [`extension/SPEC.md`](../extension/SPEC.md) — Especificación original de la extensión
- [`api-doc.md`](./api-doc.md) — Documentación de endpoints de la API
- [`phase03-authentication-layer.md`](./phase03-authentication-layer.md) — Capa de autenticación (Better Auth)

---

**Última actualización:** 2026-03-28
**Versión:** 1.0.0
**Autor:** URLoft Team
**Licencia:** MIT

---

> **Hecho con ❤️ para el Hackathon 2026 midudev**
>
> Esta extensión demuestra que Vanilla JS + HTML puro son suficientes para construir experiencias de usuario ricas y performantes, sin la complejidad accidental de frameworks y herramientas de build.
