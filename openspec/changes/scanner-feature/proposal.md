# Proposal: Scanner de Links - Chrome Extension

## Intent

Los usuarios necesitan una forma rápida de guardar múltiples links mientras navegan sin tener que copiar y pegar cada URL manualmente en la extensión. El flujo actual requiere:
1. Copiar URL
2. Abrir extensión
3. Pegar URL
4. Guardar

Este proceso es tedioso cuando se encuentra contenido interesante en una página con muchos links (artículos, recursos, etc.).

## Scope

### In Scope
- **Toggle control** en el popup de la extensión para activar/desactivar el scanner (OFF por defecto)
- **Content script** que inyecta iconos pequeños (~16x16px) en todos los links `<a>` de la página activa
- **Click handler** en cada icono para abrir el popup con los datos del link pre-cargados
- **Sistema de mensajería** entre content script ↔ background ↔ popup
- **Validación de páginas** (no inyectar en chrome://, edge://, etc.)
- **UI no intrusiva** con alto z-index y estilos minimalistas

### Out of Scope
- **Selección múltiple** de links (solo uno a la vez)
- **Modo colaboración** o compartir scaneos
- **Persistencia del estado** del scanner (siempre comienza en OFF)
- **Analytics** de uso del scanner
- **Integración automática** con sistemas externos (Pocket, Raindrop, etc.)

## Approach

### Arquitectura Feature-First

Crearemos un módulo autocontenido en `extension/features/scanner/` siguiendo la convención **Feature-First + Layered Modular** del proyecto:

```
extension/features/scanner/
├── scanner.js          # Content script (inyecta iconos, maneja clicks)
├── scanner.css         # Estilos no intrusivos (16x16px icons)
└── popup-handler.js    # Lógica del toggle y recepción de mensajes
```

### Flujo de Mensajería

```
[Popup] → enableScanner → [Background] → executeScript → [Content Script]
                                                       ↓
                                              Inyectar iconos en links
                                                       ↓
[User click] → linkClicked → [Background] → openPopup + chrome.storage
                                                       ↓
[Popup] ← chrome.storage.local ← Pre-cargar form
```

### Cambios Mínimos en Archivos Existentes

| Archivo | Cambios | Líneas |
|---------|---------|--------|
| `manifest.json` | Permisos `scripting`, content_scripts | +10 |
| `popup/html/popup.html` | Toggle UI en settings | +3 |
| `popup/css/popup.css` | @import scanner.css | +2 |
| `popup/js/app.js` | Init scanner feature | +3 |
| `popup/js/save-link.js` | Accept preloaded data | +2 |
| `background/service-worker.js` | Message handlers | +5 |

### Feature Flag

El scanner estará **desactivado por defecto**. Para deshabilitarlo completamente en producción, basta comentar 1 línea en `manifest.json`:

```json
// "content_scripts": [/* ... */]  // Comentar para deshabilitar
```

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `extension/features/scanner/` | **New** | Nuevo módulo con content script y estilos |
| `extension/manifest.json` | Modified | Agregar permisos y content_scripts |
| `extension/popup/html/popup.html` | Modified | Agregar toggle en settings |
| `extension/popup/css/popup.css` | Modified | Importar scanner.css |
| `extension/popup/js/app.js` | Modified | Inicializar scanner feature |
| `extension/popup/js/save-link.js` | Modified | Leer datos pre-cargados de storage |
| `extension/background/service-worker.js` | Modified | Handlers para enableScanner y linkClicked |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| **Performance**: Páginas con 100+ links pueden volverse lentas | Medium | Debouncing al inyectar iconos; solo visibles en viewport; batch DOM updates |
| **Conflictos visuales**: Iconos pueden romper layouts existentes | Low | Usar `position: absolute` con alto z-index; shadow DOM si es necesario |
| **Permisos**: Usuario puede rechazar permiso `scripting` | Low | El permiso ya está en manifest.json; feature flag permite rollback sin reinstalar |
| **Compatibilidad**: Algunas páginas bloquean content scripts | Low | Validar protocolo antes de inyectar; try-catch en scripting.executeScript |
| **Memory leaks**: Event listeners no limpiados | Medium | Cleanup al desactivar scanner; MutationObserver con disconnect |

## Rollback Plan

### Opción 1: Deshabilitar Feature Flag
Comentar 1 línea en `manifest.json`:
```json
// "content_scripts": [/* ... */]  // Comentar esto
```

### Opción 2: Eliminar Feature por Completo
```bash
# Borrar directorio de la feature
rm -rf extension/features/scanner/

# Revertir cambios en archivos existentes
git checkout extension/manifest.json \
            extension/popup/html/popup.html \
            extension/popup/css/popup.css \
            extension/popup/js/app.js \
            extension/popup/js/save-link.js \
            extension/background/service-worker.js
```

**Tiempo estimado de rollback**: < 2 minutos

## Dependencies

- **Chrome Extension API**: `chrome.scripting.executeScript`, `chrome.storage.local`, `chrome.runtime.onMessage`
- **Runtime**: Extension ya tiene permisos necesarios (`activeTab`, `storage`)
- **Backend**: No se requieren cambios en el backend de URLoft

## Success Criteria

- [ ] Toggle funciona correctamente (ON/OFF persiste durante la sesión)
- [ ] Iconos se inyectan solo en páginas HTTP/HTTPS (no chrome://)
- [ ] Click en icono abre popup con datos pre-cargados
- [ ] Form puede editarse antes de guardar (no auto-save)
- [ ] No hay memory leaks al activar/desactivar múltiples veces
- [ ] Performance aceptable en páginas con 100+ links (< 500ms)
- [ ] Feature flag permite deshabilitar sin reinstalar extensión
- [ ] Estilos no rompen layouts de terceros (z-index alto, no intrusivo)
