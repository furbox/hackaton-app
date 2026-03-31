# Delta for Extension

## ADDED Requirements

### Requirement: SCANNER-01 — Toggle activation

El sistema MUST permitir al usuario activar/desactivar el scanner de links desde el popup de la extensión. El estado del toggle MUST persistir durante la sesión pero MUST resetear a OFF al cerrar el browser.

#### Scenario: Activar Scanner

- GIVEN Usuario en popup de extensión con API Key configurada
- WHEN Usuario hace click en toggle "🔍 Scanner de links"
- THEN Toggle cambia a estado ON
- AND Sistema envía mensaje `enableScanner` al background service worker
- AND Background ejecuta content script en la pestaña activa

#### Scenario: Desactivar Scanner

- GIVEN Scanner activo con iconos visibles en página
- WHEN Usuario desactiva toggle en popup
- THEN Toggle cambia a estado OFF
- AND Content script elimina todos los iconos inyectados
- AND Event listeners son removidos para evitar memory leaks

---

### Requirement: SCANNER-02 — Inyección de iconos en links

El sistema MUST inyectar iconos clickeables (~16x16px) en todos los elementos `<a>` con atributo `href` de la página activa. Los iconos MUST usar alto z-index y positionamiento no intrusivo.

#### Scenario: Scanner inyecta iconos en página HTTP

- GIVEN Scanner activado
- AND Usuario en página web normal (http/https)
- WHEN Content script se inyecta
- THEN Busca todos los elementos `<a>` con href válido
- AND Inyecta un icono adyacente a cada link
- AND Iconos son clickeables y tienen z-index > 9999
- AND Estilos no rompen el layout de la página

#### Scenario: Scanner no funciona en páginas especiales

- GIVEN Usuario en página chrome://, about:, edge://, u otro protocolo especial
- WHEN Scanner intenta inyectarse
- THEN NO se inyecta ningún icono
- AND Popup muestra mensaje: "⚠️ Scanner no disponible en esta página"

---

### Requirement: SCANNER-03 — Click en icono precarga popup

El sistema MUST capturar URL y título del link al hacer click en un icono, enviar mensaje al background, y abrir el popup con los datos pre-cargados en el formulario.

#### Scenario: Click en icono abre popup precargado

- GIVEN Scanner activo con iconos visibles
- WHEN Usuario hace click en icono de un link
- THEN Content script captura URL del atributo `href`
- AND Content script captura texto del link como título
- AND Envía mensaje `linkClicked` al background con `{ url, title }`
- AND Background abre popup de extensión
- AND Popup muestra formulario con URL (readonly) y título precargados

---

### Requirement: SCANNER-04 — Edición y guardado de link escaneado

El sistema MUST permitir al usuario editar campos precargados (título, descripción, categoría) antes de guardar. El formulario MUST comportarse idéntico al flujo normal de guardado.

#### Scenario: Usuario edita y guarda link escaneado

- GIVEN Popup abierto con URL y título precargados desde scanner
- WHEN Usuario edita título
- AND Usuario agrega descripción
- AND Usuario selecciona categoría
- AND Usuario hace click en "Guardar"
- THEN Link se guarda con `POST /api/links`
- AND Toast de confirmación aparece: "¡Link guardado! 🎉"
- AND Badge counter se incrementa

---

### Requirement: SCANNER-05 — Performance con muchos links

El sistema MUST limitar la inyección de iconos en páginas con 100+ links para evitar degradación de performance. El límite SHOULD ser 50 iconos o usar IntersectionObserver para lazy loading.

#### Scenario: Performance en página con 100+ links

- GIVEN Página con más de 100 links
- WHEN Scanner se activa
- THEN Solo muestra iconos en primeros 50 links del viewport
- OR Usa IntersectionObserver para cargar iconos bajo demanda
- AND Tiempo de inyección < 500ms
- AND Página no se ralentiza (scroll suave)

#### Scenario: Scroll con IntersectionObserver

- GIVEN Scanner activo con IntersectionObserver implementado
- AND Usuario hace scroll en página larga
- THEN Iconos aparecen cuando links entran al viewport
- AND Iconos fuera del viewport NO se renderizan

---

### Requirement: SCANNER-06 — Validación de protocolos

El sistema MUST validar el protocolo de la página antes de inyectar content script. Solo http/https son válidos; chrome://, about:, edge://, etc. MUST rechazarse.

#### Scenario: Validación previa a inyección

- GIVEN Scanner activado
- AND Pestaña activa tiene protocolo inválido (chrome://)
- WHEN Background intenta ejecutar `chrome.scripting.executeScript`
- THEN Validación detecta protocolo inválido
- AND NO se ejecuta content script
- AND Popup muestra mensaje de error en badge

---

### Requirement: SCANNER-07 — Prevención de memory leaks

El sistema MUST limpiar todos los event listeners y MutationObservers al desactivar el scanner. Cada activación/desactivación MUST ser idempotente.

#### Scenario: Limpieza al desactivar scanner

- GIVEN Scanner activo con iconos y listeners
- WHEN Usuario desactiva toggle
- THEN Todos los iconos se remueven del DOM
- AND Event listeners se eliminan
- AND MutationObserver hace disconnect()
- AND Variables globales se resetean

#### Scenario: Activaciones múltiples sin memory leak

- GIVEN Usuario activa/desactiva scanner 10 veces
- WHEN Usuario inspecciona memoria del browser
- THEN NO hay crecimiento de memoria
- AND Performance se mantiene constante

---

## Non-Functional Requirements

| ID | Requirement | Priority |
|----|-------------|----------|
| NFR-01 | Tiempo de inyección de iconos < 500ms en páginas con ≤50 links | MUST |
| NFR-02 | Iconos no deben afectar layout de páginas terceras (position: absolute) | MUST |
| NFR-03 | Scanner debe respetar prefers-color-scheme del usuario | SHOULD |
| NFR-04 | Content script debe sobrevive a navigations SPA (history API) | SHOULD |

---

## Constraints

| Constraint | Description |
|------------|-------------|
| C-01 | NO se permite selección múltiple de links (solo uno a la vez) |
| C-02 | Estado del scanner NO persiste entre sesiones del browser (siempre OFF al iniciar) |
| C-03 | Iconos no deben interferir con clicks nativos de los links originales |
| C-04 | Tamaño máximo de icono: 16x16px con padding de 2px |
| C-05 | Feature flag en manifest.json permite deshabilitar sin reinstalar extensión |

---

## Acceptance Criteria

### Done State

- [ ] Toggle ON/OFF funciona correctamente en popup
- [ ] Iconos se inyectan solo en páginas HTTP/HTTPS (no chrome://, about:, edge://)
- [ ] Click en icono abre popup con URL y título precargados
- [ ] Form permite editar campos antes de guardar (no auto-save)
- [ ] No hay memory leaks tras 10 activaciones/desactivaciones
- [ ] Performance aceptable en páginas con 100+ links (< 500ms)
- [ ] Feature flag permite deshabilitar sin reinstalar extensión
- [ ] Estilos no rompen layouts de terceros (z-index alto, no intrusivo)
- [ ] Mensaje de error en páginas especiales es claro y visible

### Edge Cases Covered

- [ ] Páginas sin links (no icons, scanner activo pero silencioso)
- [ ] Páginas con links dinámicos (SPA, infinite scroll) → IntersectionObserver
- [ ] Páginas con Shadow DOM → iconos fuera de shadow root o traversal
- [ ] Links con href vacío o javascript:void(0) → NO inyectar icono
- [ ] Usuario cierra popup antes de guardar → datos precargados se pierden
- [ ] API Key expira durante uso del scanner → AUTH-04 aplica normalmente

### Measurable Outcomes

- **Time to inject**: < 500ms en páginas con ≤50 links (medido con Performance API)
- **Memory impact**: < 5MB tras 10 activaciones/desactivaciones (Chrome DevTools Memory profiler)
- **Visual impact**: Overlay occupy < 2% of page viewport area
- **User workflow**: Guardar link desde scanner toma 2 clicks vs 4 acciones en flujo manual
