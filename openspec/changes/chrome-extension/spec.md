# Chrome Extension Specification — URLoft

## Purpose

Define el comportamiento observable de la extensión de Chrome para URLoft (Sprint 1 + Sprint 2). Cubre autenticación con API Key, guardado de la página actual, búsqueda de links personales y gestión inline de categorías.

---

## Requirements

### Requirement: AUTH-01 — Pantalla inicial sin API Key

El sistema MUST mostrar la vista de configuración cuando no existe API Key en `chrome.storage.local`.

#### Scenario: Primer uso de la extensión

- GIVEN que el usuario no tiene una API Key guardada en `chrome.storage.local`
- WHEN abre el popup de la extensión
- THEN ve la vista de configuración con un input para pegar la API Key
- AND ve un enlace a `urloft.site/dashboard/keys` para generar una

---

### Requirement: AUTH-02 — Conexión con API Key válida

El sistema MUST validar la API Key contra `GET /api/keys` con `Authorization: Bearer <key>` y guardar las credenciales en `chrome.storage.local` si la respuesta es 200.

#### Scenario: Usuario pega una API Key válida

- GIVEN que el usuario está en la vista de configuración
- WHEN pega una API Key con formato `urlk_` seguido de 32 caracteres hexadecimales
- AND hace click en "Conectar"
- THEN la extensión llama a `GET /api/keys` con `Authorization: Bearer <key>`
- AND al recibir 200 OK guarda `apiKey` y `userEmail` en `chrome.storage.local`
- AND muestra la vista principal de la app

#### Scenario: Validación de formato antes del request

- GIVEN que el usuario está en la vista de configuración
- WHEN pega un texto que NO coincide con el patrón `^urlk_[a-f0-9]{32}$`
- AND hace click en "Conectar"
- THEN la extensión NO realiza ningún request HTTP
- AND muestra el mensaje "Formato de API Key inválido. Debe comenzar con urlk_"

---

### Requirement: AUTH-03 — API Key inválida (backend rechaza)

El sistema MUST mostrar un mensaje de error descriptivo cuando el backend retorna 401 al validar la API Key.

#### Scenario: Usuario pega API Key con formato correcto pero inválida

- GIVEN que el usuario está en la vista de configuración
- WHEN pega una API Key con formato correcto
- AND hace click en "Conectar"
- AND el backend retorna `401 Unauthorized`
- THEN la extensión NO guarda nada en `chrome.storage.local`
- AND muestra el mensaje "API Key inválida. Verificá que esté bien copiada desde el dashboard."

---

### Requirement: AUTH-04 — Revocación automática por 401

El sistema MUST borrar la API Key de `chrome.storage.local` y redirigir a la vista de configuración cada vez que cualquier request a la API retorne 401.

#### Scenario: API Key revocada por el usuario desde el dashboard

- GIVEN que el usuario tiene una sesión activa en la extensión
- WHEN realiza cualquier acción que llama a la API (guardar link, buscar, cargar categorías)
- AND el backend retorna `401 Unauthorized`
- THEN la extensión elimina `apiKey` de `chrome.storage.local`
- AND muestra la vista de configuración con el mensaje "Tu sesión expiró. Ingresá tu API Key nuevamente."

---

### Requirement: AUTH-05 — Cerrar sesión manual

El sistema MUST permitir al usuario cerrar sesión borrando la API Key del storage local.

#### Scenario: Usuario cierra sesión voluntariamente

- GIVEN que el usuario tiene una sesión activa
- WHEN hace click en el botón de logout ("🚪")
- AND confirma la acción
- THEN la extensión elimina todos los datos de `chrome.storage.local` (apiKey, userId, userEmail, caché)
- AND muestra la vista de configuración

---

### Requirement: SAVE-01 — Pre-completar formulario con metadata de pestaña activa

El sistema MUST extraer URL, title y meta description de la pestaña activa al abrir el tab "Guardar".

#### Scenario: Popup abierto en una página web normal

- GIVEN que el usuario tiene una sesión activa
- WHEN abre el popup en el tab "Guardar"
- THEN el campo URL se pre-completa con la URL de la pestaña activa (readonly)
- AND el campo Título se pre-completa con `document.title` de la pestaña
- AND el campo Descripción se pre-completa con el contenido de `<meta name="description">` si existe

#### Scenario: Popup abierto en página sin meta description

- GIVEN que el usuario tiene una sesión activa
- AND la pestaña activa no tiene `<meta name="description">`
- WHEN abre el popup en el tab "Guardar"
- THEN el campo Descripción aparece vacío (sin error)

---

### Requirement: SAVE-02 — Guardar link exitosamente

El sistema MUST realizar `POST /api/links` con la API Key en el header y mostrar feedback visual al completarse.

#### Scenario: Usuario guarda link sin categoría

- GIVEN que el usuario tiene una sesión activa
- AND el formulario está pre-completado con URL y título
- AND no selecciona ninguna categoría
- WHEN hace click en "Guardar Link"
- THEN la extensión llama a `POST /api/links` con `{ url, title, description, isPublic, categoryId: null }`
- AND al recibir `201 Created` muestra un toast de éxito "¡Link guardado! 🎉"
- AND el badge counter del ícono de la extensión se incrementa en 1

#### Scenario: Usuario guarda link con categoría seleccionada

- GIVEN que el usuario tiene una sesión activa
- AND selecciona una categoría del dropdown
- WHEN hace click en "Guardar Link"
- THEN la extensión llama a `POST /api/links` con `categoryId` igual al ID de la categoría seleccionada
- AND al recibir `201 Created` muestra un toast de éxito

---

### Requirement: SAVE-03 — Detección de duplicados

El sistema MUST verificar si la URL ya existe llamando a `GET /api/skill/lookup?url=<encoded_url>` antes de mostrar el formulario. Si existe, MUST mostrar el aviso de duplicado en lugar del formulario.

#### Scenario: URL ya está guardada por el usuario

- GIVEN que el usuario tiene una sesión activa
- AND la URL de la pestaña activa ya está guardada
- WHEN el popup carga el tab "Guardar"
- THEN la extensión llama a `GET /api/skill/lookup?url=<encoded_url>`
- AND al recibir una respuesta con `data.link` no nulo, oculta el formulario
- AND muestra el mensaje "⚠️ Ya tenés este link guardado" con el título del link existente y su categoría
- AND muestra el botón "Ver link existente" y el botón "Cancelar"

#### Scenario: URL no está guardada (no duplicado)

- GIVEN que el usuario tiene una sesión activa
- AND la URL de la pestaña activa no está guardada
- WHEN el popup carga el tab "Guardar"
- THEN la extensión llama a `GET /api/skill/lookup?url=<encoded_url>`
- AND al recibir `data.link` nulo (o error 404), muestra el formulario de guardar normalmente

---

### Requirement: SAVE-04 — Error de API al guardar

El sistema MUST mostrar un mensaje de error útil al usuario si `POST /api/links` falla.

#### Scenario: Error interno del servidor al guardar

- GIVEN que el usuario tiene una sesión activa
- AND completa el formulario
- WHEN hace click en "Guardar Link"
- AND el backend retorna `500 Internal Server Error`
- THEN la extensión muestra un toast de error con el mensaje "Error al guardar el link. Intentá de nuevo."
- AND el formulario permanece con los datos intactos

---

### Requirement: BADGE-01 — Badge counter

El sistema MUST mantener un contador en `chrome.storage.local` de links guardados hoy, resetear al inicio de cada día, y reflejarlo en el badge del ícono.

#### Scenario: Badge se incrementa al guardar link exitosamente

- GIVEN que el usuario guarda un link con éxito
- WHEN el toast de éxito se muestra
- THEN `stats.linksAddedToday` en `chrome.storage.local` se incrementa en 1
- AND el badge del ícono muestra el nuevo valor con fondo color `#6366f1`

#### Scenario: Badge se resetea al inicio del día

- GIVEN que es un nuevo día (fecha distinta a `stats.lastResetDate`)
- WHEN el background service worker actualiza el badge
- THEN `stats.linksAddedToday` se resetea a 0
- AND el badge del ícono se limpia (sin texto)

#### Scenario: Badge de error por falta de autenticación

- GIVEN que no hay API Key en `chrome.storage.local`
- WHEN el background service worker actualiza el badge
- THEN el ícono de la extensión muestra `!` con fondo rojo `#ef4444`

---

### Requirement: SEARCH-01 — Lista de links al abrir "Mis Links"

El sistema MUST cargar y mostrar los links del usuario al activar el tab "Mis Links", usando `GET /api/links/me`.

#### Scenario: Usuario abre el tab "Mis Links"

- GIVEN que el usuario tiene una sesión activa
- WHEN hace click en el tab "Mis Links"
- THEN la extensión llama a `GET /api/links/me` con `Authorization: Bearer <key>`
- AND muestra la lista de links con título, URL y categoría (si tiene)
- AND los links se ordenan por `recent` por defecto

#### Scenario: Sin links guardados

- GIVEN que el usuario no tiene ningún link guardado
- WHEN hace click en el tab "Mis Links"
- THEN la extensión muestra el mensaje "No encontraste nada. ¡Empezá a guardar links!"

---

### Requirement: SEARCH-02 — Búsqueda por texto

El sistema MUST filtrar los links enviando el parámetro `q` en `GET /api/links/me` al escribir en el search bar.

#### Scenario: Usuario escribe en el search bar

- GIVEN que el usuario está en el tab "Mis Links"
- WHEN escribe texto en la barra de búsqueda
- THEN la extensión llama a `GET /api/links/me?q=<texto>` (con debounce ≥ 300ms)
- AND la lista se actualiza con los resultados filtrados

#### Scenario: Búsqueda sin resultados

- GIVEN que el usuario está buscando en "Mis Links"
- WHEN la query retorna una lista vacía
- THEN la extensión muestra el mensaje "No encontraste nada para tu búsqueda."

---

### Requirement: SEARCH-03 — Filtrar por categoría

El sistema MUST enviar `categoryId` como query param al filtrar por categoría.

#### Scenario: Usuario selecciona una categoría como filtro

- GIVEN que el usuario está en el tab "Mis Links"
- WHEN selecciona una categoría en el selector de filtros
- THEN la extensión llama a `GET /api/links/me?categoryId=<id>`
- AND la lista muestra solo links de esa categoría

---

### Requirement: SEARCH-04 — Ordenamiento

El sistema MUST enviar el parámetro `sort` al cambiar el criterio de ordenamiento.

#### Scenario: Usuario ordena por likes

- GIVEN que el usuario está en el tab "Mis Links"
- WHEN selecciona "Más populares" (sort por likes) en el selector de orden
- THEN la extensión llama a `GET /api/links/me?sort=likes`
- AND la lista se reordena según la respuesta del backend

#### Scenario: Opciones de sort disponibles

- GIVEN que el usuario está en el tab "Mis Links"
- THEN el selector de orden MUST ofrecer las opciones: Recientes (`recent`), Más vistos (`views`), Más likes (`likes`), Más favoritos (`favorites`)

---

### Requirement: SEARCH-05 — Abrir link en nueva pestaña

El sistema MUST abrir la URL original del link en una nueva pestaña al hacer click sobre él.

#### Scenario: Usuario hace click en un link de la lista

- GIVEN que el usuario está en el tab "Mis Links" con resultados
- WHEN hace click sobre el título o la URL de un link
- THEN el browser abre la URL original en una nueva pestaña
- AND el popup permanece abierto

---

### Requirement: SEARCH-06 — Paginación infinita

El sistema MUST cargar más links al hacer scroll hasta el final de la lista usando el parámetro `page`.

#### Scenario: Usuario hace scroll hasta el fondo con más páginas disponibles

- GIVEN que el usuario está en el tab "Mis Links"
- AND hay más de una página de resultados (`pagination.totalPages > 1`)
- WHEN hace scroll hasta el final de la lista
- THEN la extensión llama a `GET /api/links/me?page=2` (página siguiente)
- AND los nuevos links se agregan al final de la lista existente (no se reemplaza)

#### Scenario: No hay más páginas

- GIVEN que el usuario llegó a la última página de resultados
- WHEN hace scroll hasta el final
- THEN NO se realiza ningún nuevo request
- AND la lista muestra el mensaje "No hay más links."

---

### Requirement: CAT-01 — Cargar categorías en el formulario de guardar

El sistema MUST llamar a `GET /api/categories` al abrir el tab "Guardar" y popular el dropdown de categorías.

#### Scenario: Formulario de guardar carga categorías

- GIVEN que el usuario tiene una sesión activa y tiene categorías creadas
- WHEN abre el tab "Guardar"
- THEN la extensión llama a `GET /api/categories` con `Authorization: Bearer <key>`
- AND el dropdown de categorías muestra la opción "Sin categoría" más cada categoría del usuario
- AND las categorías se muestran con su nombre y color

#### Scenario: Usuario sin categorías

- GIVEN que el usuario no tiene categorías creadas
- WHEN abre el tab "Guardar"
- THEN el dropdown muestra solo la opción "Sin categoría"

---

### Requirement: CAT-02 — Crear categoría inline

El sistema MUST permitir crear una nueva categoría desde el formulario de guardar link usando `POST /api/categories` y seleccionarla automáticamente.

#### Scenario: Usuario crea una nueva categoría

- GIVEN que el usuario está en el formulario de guardar link
- WHEN hace click en "+ Nueva"
- THEN aparece un modal con input de nombre y selector de color (6 opciones predefinidas)
- AND completa el nombre y selecciona un color
- AND hace click en "Crear"
- THEN la extensión llama a `POST /api/categories` con `{ name, color }`
- AND al recibir la respuesta exitosa, la nueva categoría se agrega al dropdown
- AND queda seleccionada automáticamente en el dropdown

#### Scenario: Error al crear categoría (nombre duplicado)

- GIVEN que el usuario está en el modal de nueva categoría
- WHEN ingresa un nombre que ya existe para su usuario
- AND hace click en "Crear"
- AND el backend retorna error (`CONFLICT` o `VALIDATION_ERROR`)
- THEN el modal muestra el mensaje de error de la API
- AND permanece abierto para corrección

---

## Notas Técnicas

| Nota | Detalle |
|------|---------|
| Auth header | `Authorization: Bearer <apiKey>` en todos los requests a `/api/*` |
| Formato API Key | Regex: `^urlk_[a-f0-9]{32}$` — validar en cliente antes de cada request |
| Sanitización XSS | Usar `textContent` en lugar de `innerHTML` para renderizar títulos/descripciones externas |
| Cache búsqueda | TTL de 5 minutos en `chrome.storage.local`; invalidar tras guardar un nuevo link |
| Debounce search | Mínimo 300ms antes de llamar a `GET /api/links/me?q=...` |
| 401 automático | Interceptar en el cliente HTTP global (`api.js`) — no tratar caso a caso |
| Badge reset diario | Comparar `new Date().toISOString().split('T')[0]` con `stats.lastResetDate` |
| Colores predefinidos | `#ef4444`, `#f97316`, `#eab308`, `#22c55e`, `#3b82f6`, `#a855f7` |
| `shortCode` en POST | El campo es opcional en el request; el backend lo genera automáticamente si se omite |
