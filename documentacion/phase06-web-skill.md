# Documentacion - Phase 6 Web Skill

> Implementacion de endpoints de Skill para busqueda y extraccion de links orientada a agentes.
> Enfoque: visibilidad publica por defecto, owner scope con API key, y boundary `route -> service -> db`.

---

## Estado de Phase 6

**Completa.** Skill routes disponibles para search, extract por id y lookup por URL exacta.

---

## Intent

Phase 6 agrega una interfaz HTTP simple para que agentes consulten URLoft sin pasar por MCP cuando solo necesitan retrieval rapido.

Endpoints expuestos:

- `GET /api/skill/search`
- `GET /api/skill/extract/:id`
- `GET /api/skill/lookup?url=...`

---

## Endpoints

### 1) `GET /api/skill/search`

Busca links por texto (`q`) con filtros opcionales.

Query params:

- `q` (requerido, string no vacio)
- `category_id` (opcional, int > 0)
- `user_id` (opcional, int > 0)
- `limit` (opcional, int > 0, normalizado a max 100)
- `offset` (opcional, int >= 0)

Response (`data`):

- `items[]` con: `id`, `title`, `url`, `description`, `category`, `created_at`
- `limit`
- `offset`

Nota: este endpoint aplica rate limit y puede devolver `429` con header `Retry-After`.

### 2) `GET /api/skill/extract/:id`

Devuelve metadata de un link por id.

Path param:

- `id` (requerido, int > 0)

Response (`data`):

- `id`, `url`, `title`, `description`
- `og_title`, `og_description`, `og_image`
- `category`

### 3) `GET /api/skill/lookup?url=...`

Busca un link por URL exacta.

Query params:

- `url` (requerido, URL absoluta `http(s)`)

Response (`data`): mismo contrato que `extract/:id`.

---

## Visibilidad y autenticacion

- Sin API key: solo links publicos
- Con `Authorization: Bearer <api_key>`: se habilita owner scope (incluye privados del owner)
- En `search`, si se envia `user_id` junto con API key, debe coincidir con el owner autenticado

La validacion de API key reutiliza `verifyApiKey` desde `backend/services/api-keys.service.ts`.

---

## Skill file para agentes

`backend/skill/SKILL.md` define el playbook de uso para agentes:

- cuando usar search vs extract vs lookup
- ejemplos de curl con y sin API key
- reglas de visibilidad y manejo de errores
- formato de salida esperado para respuestas al usuario

Recomendacion: cualquier agente que necesite encontrar links o metadata debe seguir ese archivo antes de llamar endpoints.

---

## Limites de arquitectura

Boundary obligatorio:

`route (backend/skill/*.ts) -> service (backend/services/skill-*.service.ts) -> db (backend/db/queries/*)`

Reglas:

- Las rutas parsean request/params y serializan response HTTP
- Servicios aplican reglas de negocio y visibilidad
- Handlers HTTP no hacen acceso directo a DB

---

## Ejemplos minimos (curl)

### Search

```bash
curl -s "http://localhost:3000/api/skill/search?q=svelte&limit=20&offset=0"
```

Con API key:

```bash
curl -s "http://localhost:3000/api/skill/search?q=internal%20docs&user_id=42" \
  -H "Authorization: Bearer ${API_KEY}"
```

### Extract

```bash
curl -s "http://localhost:3000/api/skill/extract/123"
```

### Lookup

```bash
curl -s --get "http://localhost:3000/api/skill/lookup" \
  --data-urlencode "url=https://example.com/article"
```

---

## Tests y verificacion

Desde raiz del repo:

```bash
bun test backend/test/skill/__tests__/search.test.ts
bun test backend/test/skill/__tests__/extract.test.ts
```

Verificacion extendida (opcional):

```bash
bun test backend/test/services/__tests__/links.service.test.ts
```
