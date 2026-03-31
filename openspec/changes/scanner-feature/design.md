# Design: Scanner de Links - Chrome Extension

## Technical Approach

Content script que inyecta iconos clickeables en links `<a>` cuando el usuario activa el toggle en el popup. El flujo usa `chrome.scripting.executeScript` para inyectar el código, mensajes entre content script ↔ background service worker, y `chrome.storage.local` para pasar datos pre-cargados al popup. Iconos usan `position: absolute` con alto z-index para no afectar layouts de terceros. Performance optimizado con `IntersectionObserver` para lazy loading en páginas con 100+ links.

## Architecture Decisions

### Decision: Content script injection strategy

| Option | Tradeoff | Decision |
|--------|----------|----------|
| Manifest content_scripts | Auto-inyecta en TODAS las páginas (intrusivo) | ❌ Rejected |
| `chrome.scripting.executeScript` | Inyección bajo demanda solo cuando usuario activa toggle | ✅ **Chosen** |
| `chrome.tabs.sendMessage` | Requiere listener preexistente en content script | ❌ Rejected |

**Rationale**: `executeScript` sigue el patrón de _least surprise_ — el scanner solo corre cuando el usuario lo activa explícitamente, no en todas las páginas. Además permite validación previa de protocolo (evitar chrome://) y manejo de errores granular.

### Decision: Icon positioning strategy

| Option | Tradeoff | Decision |
|--------|----------|----------|
| Modificar DOM de `<a>` (prepend child) | Puede romper CSS de la página (`:first-child`, flex layouts) | ❌ Rejected |
| `position: absolute` relativo al `<a>` | No afecta flujo de documento, alto z-index asegura visibilidad | ✅ **Chosen** |
| Shadow DOM encapsulation | Aislamiento total pero overhead de complejidad | ❌ Rejected (por ahora) |

**Rationale**: `position: absolute` es el patrón estándar en extensiones similares (Pocket, Raindrop). Si encontramos conflictos graves, podemos migrar a Shadow DOM sin cambiar la arquitectura base.

### Decision: Data passing to popup

| Option | Tradeoff | Decision |
|--------|----------|----------|
| `chrome.runtime.sendMessage` directo | Popup no está abierto cuando user clicka icono | ❌ Rejected |
| `chrome.storage.local` con clave temporal | Persiste hasta que popup lo consume, sencillo y confiable | ✅ **Chosen** |

**Rationale**: El popup NO está abierto cuando el usuario hace click en un icono. Almacenar en `chrome.storage.local` con una clave tipo `scanner_preload` permite que el popup lea los datos al abrirse, sin timing dependencies complejas.

### Decision: Performance optimization for 100+ links

| Option | Tradeoff | Decision |
|--------|----------|----------|
| Hard limit de 50 iconos | Pierde funcionalidad en páginas largas | ❌ Rejected |
| `IntersectionObserver` | Carga iconos bajo demanda, escala infinitamente | ✅ **Chosen** |
| Paginación manual (botón "load more") | Requiere interacción del usuario, rompe UX | ❌ Rejected |

**Rationale**: `IntersectionObserver` tiene soporte nativo en todos los browsers modernos, cero overhead de eventos manuales, y permite que el scanner funcione en páginas con infinite scroll sin límite arbitrario de links.

## Data Flow

### Activation Flow

```
[User] → Click toggle ON
   ↓
[Popup] → chrome.runtime.sendMessage({ action: 'enableScanner' })
   ↓
[Background Service Worker] → chrome.tabs.query({ active: true })
   ↓ → chrome.scripting.executeScript({ func: injectScannerIcons })
   ↓
[Content Script] → injectScannerIcons()
   ↓ → document.querySelectorAll('a[href]')
   ↓ → For each <a>: create icon, add click listener, append to DOM
   ↓ → Reply: { iconCount: N }
```

### Click & Preload Flow

```
[User] → Click icon on link
   ↓
[Content Script] → onClick()
   ↓ → Extract { url, title } from <a> element
   ↓ → chrome.runtime.sendMessage({ action: 'linkClicked', data: { url, title } })
   ↓
[Background Service Worker] → chrome.storage.local.set({ scanner_preload: { url, title } })
   ↓ → chrome.action.openPopup()
   ↓
[Popup] → onDOMContentLoaded()
   ↓ → chrome.storage.local.get(['scanner_preload'])
   ↓ → if preload exists: fill form inputs, clear storage key
```

## File Changes

| File | Action | Description |
|------|--------|-------------|
| `extension/features/scanner/scanner.js` | **Create** | Content script con lógica de inyección de iconos y manejadores de click |
| `extension/features/scanner/scanner.css` | **Create** | Estilos mínimos para iconos (16x16px, z-index 9999, position absolute) |
| `extension/features/scanner/popup-handler.js` | **Create** | Toggle UI en popup, listener de mensajes `linkClicked` |
| `extension/manifest.json` | **Modify** | Agregar `content_scripts` o permiso `scripting` (ya existe) |
| `extension/popup/html/popup.html` | **Modify** | Agregar toggle switch en sección de settings ( debajo de backend URL) |
| `extension/popup/css/popup.css` | **Modify** | `@import '../features/scanner/scanner.css'` (opcional si usamos estilo inline) |
| `extension/popup/js/app.js` | **Modify** | Importar e inicializar `popup-handler.js` |
| `extension/popup/js/save-link.js` | **Modify** | Leer `scanner_preload` de `chrome.storage.local` al inicializar |
| `extension/background/service-worker.js` | **Modify** | Agregar message handlers: `enableScanner`, `disableScanner`, `linkClicked` |

## Interfaces / Contracts

### Message Protocol

```typescript
// Popup → Background
interface EnableScannerMessage {
  action: 'enableScanner';
}

interface DisableScannerMessage {
  action: 'disableScanner';
}

// Content Script → Background
interface LinkClickedMessage {
  action: 'linkClicked';
  data: {
    url: string;
    title: string;
  };
}

// Background → Content Script
interface InjectScannerMessage {
  action: 'inject';
}

interface RemoveScannerMessage {
  action: 'remove';
}
```

### Storage Contract

```typescript
// chrome.storage.local keys
interface ScannerStorage {
  scanner_enabled?: boolean;  // Persiste durante sesión (NO entre restarts)
  scanner_preload?: {         // Temporal, se consume al abrir popup
    url: string;
    title: string;
  };
}
```

### Icon Data Structure

```typescript
interface InjectedIcon {
  element: HTMLElement;        // <span class="url-scanner-icon">
  linkElement: HTMLAnchorElement;  // Referencia al <a> padre
  observer?: IntersectionObserver;  // Para lazy loading (opcional)
}
```

## Testing Strategy

| Layer | What to Test | Approach |
|-------|-------------|----------|
| Unit | `injectScannerIcons()` lógica de filtrado de links, extracción de URL/título | Chrome Extension Testing lib o mocking manual |
| Integration | Mensajes Popup ↔ Background ↔ Content Script | E2E con Playwright (inyectar extensión en página de test) |
| E2E | Flujo completo: activar → click icono → popup abierto con datos precargados | Playwright con `chromium` args para cargar extensión |

### Key Test Scenarios

1. **Activation**: Toggle ON → iconos aparecen en página http/https → NO aparecen en chrome://
2. **Click**: Click en icono → popup abre con URL/título correctos → form editable
3. **Performance**: Página con 100+ links → inyección < 500ms → scroll suave con IntersectionObserver
4. **Cleanup**: Toggle OFF → todos los iconos removidos → event listeners eliminados → sin memory leaks
5. **Edge cases**: Página sin links (sin errores), href vacío (sin icono), links dinámicos (SPA)

## Migration / Rollout

**No migration required** — feature toggle por defecto OFF, sin cambios en base de datos ni API.

### Rollback Strategy

**Nivel 1: Deshabilitar sin reinstalar** (1 minuto)
```json
// extension/manifest.json
// "content_scripts": [/* ... */]  // Comentar esta sección
```

**Nivel 2: Eliminar feature por completo** (2 minutos)
```bash
rm -rf extension/features/scanner/
git checkout extension/manifest.json \
            extension/popup/html/popup.html \
            extension/popup/js/app.js \
            extension/popup/js/save-link.js \
            extension/background/service-worker.js
```

## Open Questions

- [ ] **Shadow DOM**: ¿Es necesario para páginas con CSS muy agresivo que afecte `.url-scanner-icon`? → Decisión: Empezar sin Shadow DOM, monitorear bugs de conflicto visual.
- [ ] **SPA Navigation**: ¿El content script debe re-inyectar iconos en `history.pushState`? → Decisión: Implementar MutationObserver para detectar links nuevos en DOM dinámico.
- [ ] **Dark mode**: ¿Los iconos deben adaptarse a `prefers-color-scheme`? → Decisión: Empezar con color fijo (#6366f1), iterar si usuarios reportan mala visibilidad.

---

**Size Check**: ~780 words (within budget)
