# Documentacion - Phase 6 MCP Server

> Implementacion del endpoint MCP para exponer herramientas de URLoft via JSON-RPC 2.0.
> Enfoque: API key auth reutilizando servicios existentes + limite arquitectonico `route -> service -> db`.

---

## Estado de Phase 6

**Completa.** MCP server operativo en `POST /mcp` con herramientas de links, search y categorias.

---

## Intent

Phase 6 agrega una capa MCP para que clientes AI (Claude Desktop, etc.) operen links sin acoplarse a endpoints HTTP internos.

El endpoint habla JSON-RPC 2.0 y expone dos metodos:

- `tools/list` - lista metadata de herramientas disponibles
- `tools/call` - ejecuta una herramienta puntual con `name` + `input`

---

## Endpoint y protocolo

### Endpoint

- `POST /mcp` - request JSON-RPC 2.0
- `GET /mcp` - info del servidor (`name`, `endpoint`, `protocol`, `methods`)

### JSON-RPC request/response shape

Request minimo:

```json
{
  "jsonrpc": "2.0",
  "method": "tools/list",
  "id": 1
}
```

Response de exito:

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "result": {
    "tools": []
  }
}
```

Response de error:

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "error": {
    "code": -32601,
    "message": "Method not found"
  }
}
```

---

## Autenticacion

- Header requerido: `Authorization: Bearer <api_key>`
- Validacion delegada a `verifyApiKey` del service layer (`backend/services/api-keys.service.ts`)
- El handler MCP no consulta DB directo; reutiliza la misma logica de API keys de rutas REST

Si falta o es invalido el bearer token, responde 401 con error MCP `-32001`.

---

## Herramientas expuestas

- `create_link` - crea un link del usuario autenticado (requiere permiso `read+write`)
- `get_links` - lista links visibles para el actor autenticado
- `get_link` - obtiene detalle de un link visible por `id`
- `update_link` - actualiza un link propio (requiere permiso `read+write`)
- `delete_link` - elimina un link propio (requiere permiso `read+write`)
- `search_links` - busca links via FTS5 y filtra por owner del actor
- `get_categories` - lista categorias del usuario autenticado

---

## Mapeo de errores

- `-32700` Parse error - body JSON invalido
- `-32600` Invalid request - envelope JSON-RPC invalido/incompleto
- `-32601` Method not found - metodo JSON-RPC desconocido o tool inexistente
- `-32602` Invalid params - parametros invalidos en `tools/call`
- `-32603` Internal error - fallo inesperado del servidor o tool
- `-32001` Authentication error - API key ausente/invalida

HTTP status mapping en route:

- `400` parse, request o params invalidos
- `401` auth error
- `404` method/tool no encontrado
- `500` internal error

---

## Limites de arquitectura

Boundary obligatorio:

`route (backend/mcp/server.ts) -> services/tools -> db queries`

Reglas:

- El handler de `/mcp` parsea HTTP/JSON-RPC, autentica y despacha tools
- La logica de negocio vive en servicios/tools
- No se permite SQL ni `getDatabase()` directo en handlers HTTP

---

## Ejemplos minimos

### `tools/list`

```bash
curl -s http://localhost:3000/mcp \
  -X POST \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer ${API_KEY}" \
  -d '{"jsonrpc":"2.0","method":"tools/list","id":1}'
```

### `tools/call` (`get_link`)

```bash
curl -s http://localhost:3000/mcp \
  -X POST \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer ${API_KEY}" \
  -d '{"jsonrpc":"2.0","method":"tools/call","params":{"name":"get_link","input":{"id":123}},"id":2}'
```

---

## Tests y verificacion

Desde raiz del repo:

```bash
bun test backend/test/mcp/__tests__/server.test.ts
bun test backend/test/mcp/__tests__/tools.test.ts
```

Verificacion extendida (opcional):

```bash
bun test backend/test/services/__tests__/api-keys.service.test.ts
bun test backend/test/db/__tests__/queries.api-keys.test.ts
```
