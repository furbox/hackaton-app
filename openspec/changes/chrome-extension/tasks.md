# Tasks: Chrome Extension for URLoft

> **Modo**: hybrid | **Cambio**: chrome-extension
> **Estado actual**: manifest.json ✅, api.js ✅, storage.js ✅, utils.js ✅, popup.html ✅ (esqueleto), auth.html ✅ (partial)

---

## Sprint 1: Fundación + Guardar

### Phase 1: Assets e infraestructura base

- [x] **1.1** Crear iconos PNG (16×16, 48×48, 128×128) en `extension/icons/` — placeholder sólido color `#6366f1`, más `icon-error-128.png` en rojo `#ef4444`
  - **Archivos**: `extension/icons/icon-16.png`, `icon-48.png`, `icon-128.png`, `icon-error-128.png`
  - **AC**: manifest.json carga sin errores de icono en chrome://extensions

- [x] **1.2** Completar `extension/popup/html/popup.html` — agregar todas las views estáticas: `#loading-view`, `#auth-view`, `#app-view` (con tabs "Guardar" / "Mis Links"), `#toast`, contenedor modal; referenciar `popup.css`
  - **Archivos**: `extension/popup/html/popup.html`
  - **AC**: Abre sin errores de consola; DOM contiene todos los IDs necesarios
  - **Depende de**: 1.1

- [x] **1.3** Crear `extension/popup/css/popup.css` — variables CSS (`--primary: #6366f1`, `--error: #ef4444`, `--success: #22c55e`), reset mínimo, layout 380px × 500-600px, clases `.view`, `.hidden`, `.tab-content`, `.btn--primary`, `.btn--secondary`, `.form-group`, `.form-input`, `.form-label`, `.toast`, `@media (prefers-color-scheme: dark)`
  - **Archivos**: `extension/popup/css/popup.css`
  - **AC**: Popup abre con diseño coherente y responsive al sistema dark/light

### Phase 2: Lógica de auth

- [x] **2.1** Completar `extension/popup/js/storage.js` — actualizar `DEFAULT_STORAGE` para incluir `stats: { linksAddedToday, lastResetDate }` y `userEmail`; verificar que `init()`, `get()`, `set()`, `clear()` funcionen con la nueva estructura
  - **Archivos**: `extension/popup/js/storage.js`
  - **AC**: `storage.get(['stats'])` retorna `{ linksAddedToday: 0, lastResetDate: '' }` en primera carga

- [x] **2.2** Completar `extension/popup/js/api.js` — agregar `getLinks(params, apiKey)` que llame `GET /api/links/me` con query params; agregar `createCategory(data, apiKey)` que llame `POST /api/categories`; agregar manejo explícito de 401 (throw con `code: 'UNAUTHORIZED'`) y 429 (throw con `code: 'RATE_LIMIT'`)
  - **Archivos**: `extension/popup/js/api.js`
  - **AC**: `api.getLinks({ q: 'test' }, key)` retorna `data.links[]`; 401 lanza error con code correcto

- [x] **2.3** Completar `extension/popup/js/utils.js` — agregar `formatDate(isoString)` ("hace N días/horas/minutos"), `sanitizeText(str)` (strip HTML), `generateShortCode(url)` (slug de hostname+path, max 30 chars, solo alfanumérico-guiones)
  - **Archivos**: `extension/popup/js/utils.js`
  - **AC**: `formatDate` retorna strings legibles; `generateShortCode('https://bun.sh/docs')` → `"bun-sh-docs"`

- [x] **2.4** Crear `extension/popup/js/auth.js` — exportar `initAuth(onSuccess)`: renderiza view auth, on submit valida formato `/^urlk_[a-f0-9]{32}$/`, llama `validateApiKey()`, si ok guarda `{ apiKey, userEmail }` en storage y llama `onSuccess`, si falla muestra error inline; exportar `showAuthError(msg)`
  - **Archivos**: `extension/popup/js/auth.js`
  - **AC**: Key inválida → mensaje de error visible; key válida → `onSuccess` se llama con datos

- [x] **2.5** Crear `extension/popup/js/app.js` — lógica init: lee storage → si hay `apiKey` muestra `#app-view`, si no muestra `#auth-view`; tab switching entre "Guardar" y "Mis Links"; botón logout (borra storage → muestra auth); manejo global de error 401 (cualquier módulo puede disparar reset)
  - **Archivos**: `extension/popup/js/app.js`
  - **AC**: Cycle completo: sin key → auth view; key válida → app view; logout → auth view

### Phase 3: Guardar link (feature core S1)

- [x] **3.1** Crear `extension/popup/js/save-link.js` — `initSaveLink(state)`: query `chrome.tabs.query` para URL + title; inyectar script con `chrome.scripting.executeScript` para extraer `meta[name="description"]`; pre-popular campos; llamar `lookupLink(url)` y si existe mostrar bloque `#duplicate-warning` con título/categoría del link existente y ocultar el form
  - **Archivos**: `extension/popup/js/save-link.js`
  - **AC**: Al abrir tab "Guardar" se auto-populan URL y título; si URL ya existe aparece warning con datos del duplicado

- [x] **3.2** Completar `save-link.js` — cargar categorías con `getCategories()` en `<select>`; on submit: construir payload `{ url, title, description, shortCode, isPublic, categoryId }`, llamar `createLink()`, on success `showToast('¡Link guardado! 🎉', 'success')` + incrementar `stats.linksAddedToday` en storage; on error 409 mostrar "Ya existe este link"; on error 401 limpiar storage y redirect a auth
  - **Archivos**: `extension/popup/js/save-link.js`
  - **AC**: POST exitoso → toast success + badge se actualiza; 409 → mensaje inline sin crash

### Phase 4: Service worker + badge

- [x] **4.1** Crear `extension/background/service-worker.js` — on `chrome.runtime.onInstalled`: llama `storage.init()`; on `chrome.storage.onChanged` (keys: `apiKey`, `stats`): recalcula badge; `updateBadge()`: sin apiKey → icono error + badge "!" rojo; con apiKey → reset diario si `lastResetDate !== today`, muestra count si > 0; listener `chrome.runtime.onMessage` para `UPDATE_BADGE`
  - **Archivos**: `extension/background/service-worker.js`
  - **AC**: Badge se actualiza al guardar link; badge "!" aparece sin API Key configurada

---

## Sprint 2: Buscar + Categorías

### Phase 5: Search view

- [x] **5.1** Crear `extension/popup/js/search.js` — `initSearch(state)`: input con `debounce(300ms)`; fetch `GET /api/links/me?q=...&sort=...&categoryId=...&page=1&limit=20`; renderizar cards con `renderLinkCard(link)`: título, URL truncada, categoría (color badge), fecha relativa; click en card → `chrome.tabs.create({ url: link.url })`; botón "Copiar short link" → `navigator.clipboard.writeText(shortUrl)`
  - **Archivos**: `extension/popup/js/search.js`
  - **AC**: Búsqueda retorna resultados; click en card abre nueva pestaña; copiar short link funciona

- [x] **5.2** Completar `search.js` — paginación con botón "Cargar más" (append, no replace); estado vacío con mensaje "No encontraste nada 🔍"; estado loading con clase `is-loading` en contenedor (CSS skeleton o spinner); manejar error de red mostrando mensaje con botón retry
  - **Archivos**: `extension/popup/js/search.js`
  - **AC**: Segunda página se append a la lista; estado vacío y loading son visibles

- [x] **5.3** Agregar filtros en `search.js` — dropdown sort: `recent/likes/views/favorites`; dropdown categorías: cargado desde `getCategories()` con opción "Todas"; al cambiar cualquier filtro → reset `page=1` y re-fetch
  - **Archivos**: `extension/popup/js/search.js`
  - **AC**: Cambiar sort o categoría resetea lista y hace nuevo fetch con params correctos

### Phase 6: Cache de links

- [ ] **6.1** Crear lógica de cache en `search.js` — antes de fetch verificar `chrome.storage.local` por key `linksCache_${fingerprint}` donde fingerprint = `btoa(q+sort+categoryId+page)`; si existe y `timestamp + 5min > Date.now()` usar cache; si no: fetch, guardar en storage con timestamp; al crear link exitoso (desde save-link.js): invalidar todas las keys `linksCache_*` en storage
  - **Archivos**: `extension/popup/js/search.js`, `extension/popup/js/save-link.js`
  - **AC**: Segunda apertura del popup con misma query usa cache; guardar link invalida cache

### Phase 7: Crear categoría inline

- [x] **7.1** Completar `save-link.js` — botón "+ Nueva" junto al `<select>` de categorías; al click mostrar mini-form inline: input nombre + 6 color swatches (`#ef4444`, `#f97316`, `#eab308`, `#22c55e`, `#3b82f6`, `#a855f7`); on submit → `POST /api/categories`; éxito: agregar option al select + seleccionarla automáticamente + ocultar mini-form; error: mensaje inline
  - **Archivos**: `extension/popup/js/save-link.js`
  - **AC**: Nueva categoría creada aparece seleccionada en el dropdown sin recargar la view

---

## Criterios globales de aceptación

- La extensión se instala en Chrome (chrome://extensions) sin errores de manifiesto
- Todos los fetch usan `Authorization: Bearer <apiKey>` en el header
- XSS prevenido: todo contenido dinámico usa `textContent`, nunca `innerHTML` con datos externos
- Rate limit 429 muestra mensaje legible, no crash
- Error 401 en cualquier request limpia storage y vuelve a auth view

## Dependencias entre tasks

```
1.1 → 1.2
1.2, 1.3 → 2.4 → 2.5
2.1, 2.2, 2.3 → 2.4
2.5 → 3.1 → 3.2
3.2 → 4.1
2.5 → 5.1 → 5.2 → 5.3
5.1, 3.2 → 6.1
3.2 → 7.1
```

## Estimados

| Task | Estimado |
|------|----------|
| 1.1 Iconos | 15 min |
| 1.2 popup.html views | 20 min |
| 1.3 popup.css | 30 min |
| 2.1 storage.js update | 10 min |
| 2.2 api.js update | 15 min |
| 2.3 utils.js update | 15 min |
| 2.4 auth.js | 30 min |
| 2.5 app.js | 40 min |
| 3.1 save-link metadata + duplicados | 30 min |
| 3.2 save-link submit + categories | 30 min |
| 4.1 service-worker.js | 25 min |
| 5.1 search.js cards + click | 40 min |
| 5.2 search.js paginación + estados | 20 min |
| 5.3 search.js filtros | 20 min |
| 6.1 cache TTL | 25 min |
| 7.1 nueva categoría inline | 25 min |
| **Total Sprint 1** | **~3.8h** |
| **Total Sprint 2** | **~2h** |
| **TOTAL** | **~5.8h** |
