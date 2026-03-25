# Documentacion - Phase 5 Background Workers

> Implementacion de background workers para health checking, reader mode, y Wayback Machine archival.
> Enfoque: Bun native `Worker` + typed message protocol + service-layer boundary (`worker -> service -> db`).

---

## Estado de Phase 5

**Completa.** Las 30 sub-tareas (5.0 – 5.5) fueron implementadas y verificadas.

---

## Intent

Phase 5 implementa procesamiento asincronico para tareas pesadas que no deben bloquear la respuesta HTTP:

1. **Health Checker** — Valida si un link sigue funcionando (HEAD + GET fallback)
2. **Reader Mode** — Extrae texto legible de paginas HTML (via `@mozilla/readability`)
3. **Wayback Machine** — Archiva links en Internet Archive para preservar contenido

Los workers se ejecutan en segundo plano, completamente desacoplados del request/response HTTP.

---

## Arquitectura

### Worker -> Service -> DB Boundary

```
┌─────────────────┐     postMessage      ┌─────────────────┐
│   Bun Worker    │ ───────────────────► │  Main Thread    │
│ (health-checker │                      │  (WorkerPool)   │
│  reader-mode    │ ◄────────────────── │                  │
│  wayback)       │   WorkerResult       │  dispatch()     │
└─────────────────┘                      └────────┬────────┘
                                                   │
                                                   ▼
                                         ┌─────────────────┐
                                         │ links.service   │
                                         │ updateLinkXxx() │
                                         └────────┬────────┘
                                                  │
                                                  ▼
                                        ┌─────────────────┐
                                        │ db/queries/     │
                                        │ links.ts        │
                                        └─────────────────┘
```

**Regla fundamental:** Los workers NUNCA importan `bun:sqlite`, `backend/db/queries/`, ni `getDatabase()`. Todos los accesos a la base de datos van por `backend/services/`.

**Por que:** Bun singletons como `getDatabase()` son thread-local. Cada worker crearia su propia instancia de DB, causando write conflicts. La arquitectura de servicios garantiza un solo punto de escritura.

---

## Componentes implementados

### 5.0 Worker Protocol (`backend/workers/types.ts`)

- `WorkerMessageType` enum: `HEALTH_CHECK`, `READER_MODE`, `WAYBACK`, `SWEEP`
- `WorkerMessage<T>` — Request tipo con `type`, `payload: T`, `id`
- `WorkerResult<T>` — Response tipo con `type`, `success`, `payload: T | null`, `error?: string`

```typescript
export type WorkerMessage<T> = {
  type: WorkerMessageType;
  payload: T;
  id: string;
};

export type WorkerResult<T> = {
  type: WorkerMessageType;
  success: boolean;
  payload?: T;
  error?: string;
};
```

### 5.1 Health Checker (`backend/workers/health-checker.worker.ts`)

- Ejecuta HEAD request (timeout: `HEALTH_CHECK_TIMEOUT_MS`, default 10s)
- Fallback a GET si HEAD falla
- Mapea errores de red a codigos sinteticos (`0` = unreachable, `-1` = timeout)
- Soporta mensaje `SWEEP` para escaneo periodico de todos los links publicos
- Intervalo de sweep: `HEALTH_CHECK_INTERVAL_MS` (default 1 hora)

**Servicio:** `links.service.updateLinkStatusCode(linkId, statusCode)`

### 5.2 Reader Mode (`backend/workers/reader-mode.worker.ts`)

- Fetch HTML con `AbortController` (timeout: `READER_MODE_TIMEOUT_MS`, default 15s)
- Extrae texto via `@mozilla/readability`
- Maneja contenido no-HTML (PDF, imagenes, binarios) con `contentText: null`
- Soporta mensaje `SWEEP` para re-extraccion de todos los links

**Servicio:** `links.service.updateLinkContentText(linkId, contentText)`

### 5.3 Wayback Machine (`backend/workers/wayback.worker.ts`)

- Envia URL a `POST https://web.archive.org/save/{url}`
- Parsea `Content-Location` header para obtener la URL del archivo
- Retry con backoff exponencial (max 3 intentos, base 2s) para 429 y 5xx
- Fallas permanentes almacenan `archiveUrl: null`

**Servicio:** `links.service.updateLinkArchiveUrl(linkId, archiveUrl)`

### 5.4 Worker Pool (`backend/workers/pool.ts`)

- `WorkerPool` singleton que instancia los 3 workers
- `dispatch(message)` routing por tipo de mensaje
- `onmessage` handlers que llaman servicios en el main thread
- Crash recovery: reinicio automatico despues de 5s
- `shutdown()` para terminacion limpia

```typescript
export const workerPool = {
  dispatch: (message: WorkerMessage<unknown>) => void,
  shutdown: () => Promise<void>,
  // ...
};
```

### 5.5 Integracion Fire-and-Forget

En `links.service.ts` — `createLink`:

```typescript
// Dispatch asincronico (no await)
if (workerPool) {
  workerPool.dispatch({ type: 'HEALTH_CHECK', payload: { linkId, url }, id: uuid() });
  workerPool.dispatch({ type: 'READER_MODE', payload: { linkId, url }, id: uuid() });
  workerPool.dispatch({ type: 'WAYBACK', payload: { linkId, url }, id: uuid() });
}
```

- No bloquea la respuesta HTTP
- Pool inicializado con guard para entornos de test

---

## Verificacion de arquitectura

### Comando de checking

```bash
bun run --cwd backend check:phase5-architecture
```

Salida esperada:

```
[PHASE5_BOUNDARY_OK] workers=backend/workers
```

El checker valida que no haya imports de `bun:sqlite`, `backend/db/queries/`, ni `getDatabase()` dentro de `backend/workers/`.

### Tests

```bash
# Workers
bun test backend/test/workers/__tests__/health-checker.worker.test.ts
bun test backend/test/workers/__tests__/reader-mode.worker.test.ts
bun test backend/test/workers/__tests__/wayback.worker.test.ts
bun test backend/test/workers/__tests__/pool.test.ts
bun test backend/test/workers/__tests__/integration.test.ts

# Servicios
bun test backend/test/services/__tests__/links.service.test.ts
```

Todos los tests pasan con cero fallas.

---

## Variables de entorno

| Variable | Default | Descripcion |
|----------|---------|-------------|
| `HEALTH_CHECK_TIMEOUT_MS` | 10000 | Timeout para requests del health checker |
| `HEALTH_CHECK_INTERVAL_MS` | 3600000 | Intervalo de sweep automatico (1 hora) |
| `READER_MODE_TIMEOUT_MS` | 15000 | Timeout para fetch y extraccion de contenido |
| `WAYBACK_RETRY_BASE_MS` | 2000 | Base delay para retry exponencial |
| `WAYBACK_MAX_RETRIES` | 3 | Maximo intentos de archivado |

---

## Resumen de archivos

```
backend/workers/
├── types.ts                 # WorkerMessage, WorkerResult, WorkerMessageType
├── health-checker.worker.ts # Validacion de links (HEAD/GET)
├── reader-mode.worker.ts    # Extraccion de texto via Readability
├── wayback.worker.ts        # Archivado en Internet Archive
├── pool.ts                  # Lifecycle management (singleton)
└── __tests__/
    ├── health-checker.worker.test.ts
    ├── reader-mode.worker.test.ts
    ├── wayback.worker.test.ts
    ├── pool.test.ts
    └── integration.test.ts
```

```
backend/services/
└── links.service.ts         # updateLinkStatusCode, updateLinkContentText, updateLinkArchiveUrl
```

---

## Notas de implementacion

- Los workers usan `.ts` specifiers en todos los imports locales (no `.js`)
- Los workers se comunican exclusivamente via `postMessage` / `addEventListener('message')`
- El main thread nunca `await` worker result antes de responder al cliente HTTP
- El pool es lazy singleton: se inicializa en `backend/index.ts` al inicio del servidor
- Los resultados de workers actualizan la DB via servicios, nunca directamente

---

## Phase 6 (pendiente)

El procesamiento de contenido de los workers puede integrarse con FTS5 para busqueda full-text. Los `content_text` extraidos se indexan automaticamente via triggers SQLite.