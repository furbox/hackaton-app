# Proposal: Chrome Extension for URLoft

## Intent
- Implementar una extensión de Chrome para URLoft utilizando Vanilla JS (sin frameworks, sin build steps).
- **Puntos fuertes**: Permitir a los usuarios AGREGAR links rápidamente desde cualquier pestaña y BUSCAR sus links guardados sin salir del contexto de navegación.
- **Autenticación**: Uso de API Keys para simplificar la integración y evitar problemas de CORS/Cookies en el popup de la extensión.
- **MVP (Sprint 1-2)**: Autenticación básica, guardado de la página actual y búsqueda funcional.
- **Post-MVP**: Detección automática de links en la página visitada, gestión avanzada de categorías y modo sidebar.

## Scope

### Included
- **Manifest V3**: Configuración moderna para extensiones de Chrome.
- **Vanilla JS (ES6 Modules)**: Desarrollo limpio sin dependencias externas pesadas.
- **Autenticación con API Key**: Interfaz para ingresar y validar la API Key personal.
- **Guardar Página Actual**: Extracción de título, URL y posibilidad de asignar categoría. Manejo de duplicados reportado por el backend.
- **Búsqueda de Links**: Interfaz de búsqueda con filtros básicos, paginación y caché local para velocidad.
- **Badge Counter**: Mostrar el total de links guardados hoy (u otra métrica relevante) en el ícono de la extensión.
- **Background Service Worker**: Gestión de eventos y comunicación con el backend.
- **Toast Notifications**: Feedback visual al usuario tras acciones (éxito/error).

### Excluded
- **Content Scripts Avanzados**: Detección proactiva de links dentro del DOM de la página visitada (Sprint 3).
- **Offline Mode**: La extensión requerirá conexión para sincronizar con el backend (Post-MVP).
- **Keyboard Shortcuts**: Atajos personalizados para acciones rápidas (Post-MVP).
- **Sidebar Mode**: Panel lateral persistente (Post-MVP).

## Approach
- **Vanilla JS puro**: Uso de módulos ES6 nativos (`type="module"`) para organizar el código.
- **CSS Vanilla (BEM)**: Estilos modulares y predecibles sin necesidad de procesadores.
- **chrome.storage.local**: Persistencia de la API Key, preferencias del usuario y caché de búsqueda.
- **Fetch API**: Comunicación directa con los endpoints de URLoft (API Keys ya soportadas por el backend).
- **Comunicación**: Uso de `chrome.runtime.sendMessage` para coordinar el Popup y el Service Worker.

## Risks
- **CORS/Cookies**: Las extensiones a veces enfrentan restricciones; se mitiga usando API Keys en el header `Authorization` o similar.
- **XSS**: Dado que se manejan títulos y descripciones de links externos, se aplicará una sanitización estricta (usando `textContent` en lugar de `innerHTML`).
- **Storage Security**: `chrome.storage.local` es accesible por la extensión; se considera aceptable para una API Key de usuario en el MVP, advirtiendo al usuario sobre su uso personal.

## Success Criteria
- [ ] La extensión se instala correctamente en Chrome (o navegadores Chromium) sin errores de manifiesto.
- [ ] El flujo de autenticación permite guardar y validar la API Key.
- [ ] La acción de "Guardar Link" crea exitosamente un registro en el backend de URLoft.
- [ ] El backend detecta duplicados y la extensión muestra el mensaje correspondiente.
- [ ] La interfaz de búsqueda retorna resultados filtrados correctamente.
- [ ] El badge counter se actualiza al realizar acciones.

## Rollback Plan
- En caso de fallos críticos, se puede deshabilitar la extensión desde el panel de extensiones de Chrome.
- Dado que es una extensión desacoplada del frontend principal, el riesgo para la web app es mínimo.

## Affected Modules
- **Backend**: Verificación de endpoints de API Keys y CRUD de links (ya existentes, pero asegurar compatibilidad con el User-Agent de la extensión).
- **Extension Directory**: Creación de toda la estructura bajo `extension/`.
