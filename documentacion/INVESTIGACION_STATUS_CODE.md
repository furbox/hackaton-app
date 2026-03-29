# 🔍 INVESTIGACIÓN: Campo status_code en tabla links

## 📊 RESUMEN EJECUTIVO

✅ **No hay error en el nombre del campo** - Todo está correctamente configurado como `status_code` (snake_case)

❌ **El problema real:** El controlador `home.controller.ts` NO normaliza los links, mientras que `explore.controller.ts` SÍ lo hace.

---

## 1. ✅ SCHEMA DE LA TABLA (CORRECTO)

**Archivo:** `backend/db/schema.sql` (línea 92)

```sql
CREATE TABLE links (
  ...
  status_code INTEGER DEFAULT 200,   -- ✅ snake_case
  ...
);
```

**Verificación con query real:**
```bash
sqlite3 backend/db/database.sqlite "SELECT sql FROM sqlite_master WHERE type='table' AND name='links';"
```

Resultado: ✅ Campo confirmado como `status_code`

---

## 2. ✅ DATOS REALES (CORRECTOS)

**Query ejecutado:**
```sql
SELECT id, title, status_code FROM links LIMIT 3;
```

**Resultado:**
```json
[
  {
    "id": 1,
    "title": "Google Search",
    "status_code": 200      // ✅ Campo existe con datos
  },
  {
    "id": 7,
    "title": "Obtener ayuda",
    "status_code": 200      // ✅ Campo existe con datos
  },
  {
    "id": 8,
    "title": "Personalizar Firefox",
    "status_code": 200      // ✅ Campo existe con datos
  }
]
```

---

## 3. ✅ INTERFZ TYPESCRIPT (CORRECTA)

**Archivo:** `backend/db/queries/links.ts` (línea 32)

```typescript
export interface Link {
  ...
  status_code: number;    // ✅ snake_case
  ...
}
```

---

## 4. ✅ HEALTH CHECKER WORKER (CORRECTO)

**Archivo:** `backend/workers/health-checker.worker.ts` (línea 229)

```typescript
// Retorna statusCode (camelCase) internamente
return {
  linkId: payload.linkId,
  statusCode,    // camelCase aquí
  checkedAt: new Date().toISOString(),
};
```

**Archivo:** `backend/workers/pool.ts` (línea 256)

```typescript
// Pero actualiza status_code (snake_case) en la DB
const updateResult = this.updates.updateLinkStatusCode(
  result.data.linkId,
  result.data.statusCode
);
```

**Archivo:** `backend/db/queries/links.ts` (línea 360)

```typescript
// ✅ La función actualiza status_code correctamente
const updateLinkStatusCodeByIdStmt = () => getDb().prepare(`
  UPDATE links
  SET status_code = ?
  WHERE id = ?
`);
```

---

## 5. ✅ FRONTEND EJS (CORRECTO)

**Archivo:** `frontend-bun-ejs/views/partials/link-card.ejs` (línea 88-93)

```ejs
<% if (typeof link.status_code === "number") { %>
  <% const isGoodStatus = link.status_code >= 200 && link.status_code < 400; %>
  <div class="absolute -top-1 -right-1 z-10 flex h-5 w-5 items-center justify-center rounded-full border-2 border-slate-900 bg-<%= isGoodStatus ? 'emerald-500' : 'red-500' %> text-white shadow-lg">
    <%= isGoodStatus ? '✓' : '✕' %>
  </div>
<% } %>
```

✅ El EJS espera `link.status_code` (snake_case)

---

## 6. ❌ EL PROBLEMA: NORMALIZACIÓN INCONSISTENTE

### ✅ Explore Controller (CORRECTO)

**Archivo:** `frontend-bun-ejs/src/controllers/explore.controller.ts`

```typescript
// Línea 220-223: ✅ NORMALIZA los links
const rawLinks = extractArray<unknown>(linksResult.data, ["items", "links"]);
const links = rawLinks
  .map(normalizeLink)      // ← ✅ AQUÍ NORMALIZA
  .filter((link): link is Link => link !== null);
```

**Función normalizeLink (línea 185-190):**
```typescript
status_code:
  typeof source.status_code === "number"
    ? source.status_code
    : typeof source.statusCode === "number"
      ? source.statusCode        // ← ✅ Convierte camelCase → snake_case
      : undefined,
```

### ❌ Home Controller (INCORRECTO)

**Archivo:** `frontend-bun-ejs/src/controllers/home.controller.ts`

```typescript
// Línea 48-54: ❌ NO NORMALIZA los links
let featuredLinks: Link[] = [];
if (linksResult.data) {
  if (Array.isArray(linksResult.data)) {
    featuredLinks = linksResult.data;        // ← ❌ ASIGNACIÓN DIRECTA
  } else if (Array.isArray((linksResult.data as { links: Link[] }).links)) {
    featuredLinks = (linksResult.data as { links: Link[] }).links;  // ← ❌ ASIGNACIÓN DIRECTA
  }
}
```

---

## 7. 📊 FLUJO DE DATOS

```
┌─────────────────────────────────────────────────────────────────────┐
│                          BASE DE DATOS                              │
│                     campo: status_code                              │
└──────────────────────────────┬──────────────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────────────┐
│                        API /api/links                               │
│              devuelve: { status_code: 200 }                         │
└──────────────────────────────┬──────────────────────────────────────┘
                               │
                ┌──────────────┴──────────────┐
                │                             │
                ▼                             ▼
    ┌───────────────────────┐     ┌───────────────────────┐
    │  explore.controller   │     │   home.controller     │
    │                       │     │                       │
    │  ✅ normalizeLink()   │     │   ❌ SIN NORMALIZAR   │
    │  status_code ✅       │     │   status_code ❌      │
    └───────────────────────┘     └───────────────────────┘
                │                             │
                ▼                             ▼
    ┌───────────────────────┐     ┌───────────────────────┐
    │     EJS link-card     │     │     EJS link-card     │
    │                       │     │                       │
    │  ✅ Indicador visible │     │   ❌ Indicador OCULTO │
    └───────────────────────┘     └───────────────────────┘
```

---

## 8. 💡 SOLUCIÓN

### Opción 1: Agregar normalizeLink a home.controller.ts (RECOMENDADO)

**Archivo:** `frontend-bun-ejs/src/controllers/home.controller.ts`

```typescript
// AGREGAR ESTA FUNCIÓN (copiar de explore.controller.ts)
function normalizeLink(raw: unknown): Link | null {
  if (!raw || typeof raw !== "object") {
    return null;
  }

  const source = raw as Record<string, unknown>;
  const id = typeof source.id === "number" ? source.id : null;
  const title = typeof source.title === "string" ? source.title.trim() : "";
  const url =
    typeof source.url === "string" && source.url.trim().length > 0
      ? source.url
      : null;

  if (id === null || url === null) {
    return null;
  }

  // ... resto de la función (copiar completa de explore.controller.ts)

  return {
    id,
    title,
    url,
    description:
      typeof source.description === "string" ? source.description : undefined,
    short_code:
      typeof source.short_code === "string"
        ? source.short_code
        : typeof source.shortCode === "string"
          ? source.shortCode
          : undefined,
    likes_count:
      typeof source.likes_count === "number"
        ? source.likes_count
        : typeof source.likesCount === "number"
          ? source.likesCount
          : 0,
    favorites_count:
      typeof source.favorites_count === "number"
        ? source.favorites_count
        : typeof source.favoritesCount === "number"
          ? source.favoritesCount
          : 0,
    views: typeof source.views === "number" ? source.views : 0,
    liked_by_me:
      typeof source.liked_by_me === "boolean"
        ? source.liked_by_me
        : typeof source.likedByMe === "boolean"
          ? source.likedByMe
          : false,
    favorited_by_me:
      typeof source.favorited_by_me === "boolean"
        ? source.favorited_by_me
        : typeof source.favoritedByMe === "boolean"
          ? source.favoritedByMe
          : false,
    status_code:
      typeof source.status_code === "number"
        ? source.status_code
        : typeof source.statusCode === "number"
          ? source.statusCode
          : undefined,
    category: null,
  };
}

// LUEGO MODIFICAR ESTA PARTE:
const [user, statsResult, linksResult] = await Promise.all([
  getSession(request),
  apiFetch<GlobalStats>("/api/stats/global", { method: "GET" }, request),
  apiFetch<{ links: Link[] } | Link[]>(
    "/api/links?sort=likes&limit=6",
    { method: "GET" },
    request
  ),
]);

const statsData = unwrapDataEnvelope<GlobalStats>(statsResult.data);
const stats: GlobalStats = statsData
  ? {
      totalUsers: statsData.totalUsers ?? 0,
      totalLinks: statsData.totalLinks ?? 0,
      totalCategories: statsData.totalCategories ?? 0,
    }
  : { totalUsers: 0, totalLinks: 0, totalCategories: 0 };

// ✅ MODIFICACIÓN: Normalizar links
let rawLinks: Link[] = [];
if (linksResult.data) {
  if (Array.isArray(linksResult.data)) {
    rawLinks = linksResult.data;
  } else if (Array.isArray((linksResult.data as { links: Link[] }).links)) {
    rawLinks = (linksResult.data as { links: Link[] }).links;
  }
}

const featuredLinks = rawLinks
  .map(normalizeLink)      // ← ✅ AGREGAR ESTO
  .filter((link): link is Link => link !== null);

const flash = getFlash(request);

return renderPage("home", {
  data: {
    title: "Home",
    user,
    flash,
    stats,
    featuredLinks,  // ← Ahora normalizados
    headline: "Tu biblioteca inteligente de links",
    subtitle:
      "Guarda, organiza y encontra cualquier enlace en segundos. Todo en un solo lugar: desde links del dia a dia hasta recursos clave para tu equipo.",
  },
});
```

### Opción 2: Crear un helper compartido

Mejor aún, extraer `normalizeLink` a un archivo compartido:

```typescript
// frontend-bun-ejs/src/utils/normalize-link.ts
export function normalizeLink(raw: unknown): Link | null {
  // ... misma implementación
}
```

Y usarlo en ambos controladores:

```typescript
import { normalizeLink } from "../utils/normalize-link.ts";

const featuredLinks = rawLinks
  .map(normalizeLink)
  .filter((link): link is Link => link !== null);
```

---

## 9. ✅ VERIFICACIÓN DESPUÉS DE LA CORRECCIÓN

### Test manual en EJS

Agregar log temporal en `link-card.ejs`:

```ejs
<% console.log('DEBUG link.status_code:', link.status_code, typeof link.status_code); %>
<% if (typeof link.status_code === "number") { %>
  <!-- indicador visible -->
<% } else { %>
  <!-- indicador oculto -->
<% } %>
```

### Test con curl

```bash
curl http://localhost:3000/api/links?sort=likes&limit=3 | jq '.data.links[0].status_code'
```

Debería retornar:
```json
200
```

---

## 10. 📝 CAMPOS AFECTADOS

No es solo `status_code`. La normalización también maneja:

| Campo DB (snake_case) | Alternativa (camelCase) |
|----------------------|-------------------------|
| `status_code` | `statusCode` |
| `short_code` | `shortCode` |
| `likes_count` | `likesCount` |
| `favorites_count` | `favoritesCount` |
| `is_public` | `isPublic` |
| `category_id` | `categoryId` |
| `liked_by_me` | `likedByMe` |
| `favorited_by_me` | `favoritedByMe` |
| `owner_username` | `ownerUsername` |
| `owner_avatar_url` | `ownerAvatarUrl` |

---

## 11. 🎯 CONCLUSIÓN

✅ **NO hay error en el nombre del campo** - es `status_code` (snake_case) en todas partes:
- Schema SQL ✅
- Queries ✅
- Interfaz TypeScript ✅
- Base de datos ✅
- Worker update ✅
- EJS template ✅

❌ **El problema es que `home.controller.ts` no normaliza los datos**

💡 **La solución es agregar `normalizeLink()` en `home.controller.ts`**

---

## 12. 📚 REFERENCIAS

- Archivo schema: `backend/db/schema.sql` (línea 92)
- Archivo queries: `backend/db/queries/links.ts` (línea 32, 360)
- Archivo worker: `backend/workers/health-checker.worker.ts` (línea 229)
- Archivo pool: `backend/workers/pool.ts` (línea 256)
- Archivo EJS: `frontend-bun-ejs/views/partials/link-card.ejs` (línea 88)
- Archivo explore controller: `frontend-bun-ejs/src/controllers/explore.controller.ts` (línea 185, 220)
- Archivo home controller: `frontend-bun-ejs/src/controllers/home.controller.ts` (línea 48)
- Helper normalize: `frontend-bun-ejs/src/utils/query-helpers.ts` (línea 241)

---

**Fecha de investigación:** 2026-03-28
**Estado:** ✅ DIAGNÓSTICO COMPLETO - LISTO PARA CORREGIR
