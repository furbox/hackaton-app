# Exploration: Bug de Falso Positivo de Links Duplicados en Extensión Chrome

## Objetivo

Investigar y diagnosticar por qué la extensión Chrome muestra el mensaje "Ya tenés esta URL guardada" cuando el usuario intenta guardar un link por PRIMERA VEZ.

## Estado Actual

El usuario reporta un bug persistente:
- Usuario guarda un link por primera vez
- Aparece el mensaje: "Ya tenés esta URL guardada. Si querés actualizarla, editá el link existente en 'Mis Links'."
- El usuario está SEGURO que es la primera vez que guarda ese link
- El backend funciona correctamente (confirmado por el usuario)

Cambios previos aplicados (no resolvieron el problema):
1. ✅ Fix scroll dropdown - Funciona correctamente
2. ✅ Fix categorías no se actualizan - Funciona correctamente
3. ✅ Agregamos `userId` al session state (auth.js, app.js)
4. ✅ Agregamos verificación `link.userId === state.userId` en `_checkDuplicate()`
5. ✅ Cambiamos mensaje de error a uno más claro

## Diagrama de Flujo del Duplicate Check

```
┌─────────────────────────────────────────────────────────────┐
│ 1. Usuario abre extensión                                    │
│    init() → carga userId desde chrome.storage                │
└──────────────────────────┬──────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────┐
│ 2. Usuario navega a pestaña "Guardar"                        │
│    initSaveLink(state) → con state.userId cargado            │
└──────────────────────────┬──────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────┐
│ 3. Se obtiene URL de la pestaña activa                       │
│    chrome.tabs.query({ active: true, currentWindow: true }) │
└──────────────────────────┬──────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────┐
│ 4. Frontend llama a _checkDuplicate(url, state, elements)   │
│    → lookupLink(url, state.apiKey)                          │
│    → GET /api/skill/lookup?url=https://...                  │
└──────────────────────────┬──────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────┐
│ 5. Backend: /api/skill/lookup                               │
│    skill/extract.ts:145 → lookupSkillLinkByUrl(actor, url)  │
│    skill-extract.service.ts:102 → getSkillLinkByUrl(...)    │
│    db/queries/skill.ts:72 → query SQL:                      │
│                                                              │
│    SELECT l.id, l.url, l.title, l.description,              │
│           l.og_title, l.og_description, l.og_image,         │
│           l.category_id, c.name AS category_name            │
│    FROM links l                                              │
│    LEFT JOIN categories c ON c.id = l.category_id           │
│    WHERE l.url = ?                                           │
│      AND (                                                   │
│        l.is_public = 1          <-- PUEDE SER DE OTRO USUARIO│
│        OR (? IS NOT NULL AND l.user_id = ?)                 │
│      )                                                       │
│    ORDER BY ...                                             │
│    LIMIT 1                                                   │
│                                                              │
│    ⚠️ NO incluye l.user_id en el SELECT                     │
└──────────────────────────┬──────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────┐
│ 6. Backend transforma row a DTO                             │
│    skill-extract.service.ts:48-64 → toSkillLinkMetadata()   │
│    retorna { id, url, title, description, og_*, category }  │
│    ⚠️ NO incluye userId en el objeto de respuesta           │
└──────────────────────────┬──────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────┐
│ 7. Frontend recibe respuesta                                │
│    save-link.js:467-496 → _checkDuplicate()                 │
│    const res = await lookupLink(url, state.apiKey);         │
│    const link = res?.data?.link ?? null;                    │
│                                                              │
│    if (link && link.userId === state.userId) {  <-- BUG     │
│      // mostrar warning de duplicado                        │
│    }                                                         │
│                                                              │
│    ⚠️ link.userId es UNDEFINED (no viene del backend)       │
└──────────────────────────┬──────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────┐
│ 8. Evaluación de condición                                  │
│                                                              │
│    Si state.userId es null/undefined:                       │
│      undefined === undefined → TRUE ❌ FALSO POSITIVO       │
│                                                              │
│    Si state.userId es un número:                            │
│      undefined === 5 → FALSE (correcto, no muestra warning) │
└─────────────────────────────────────────────────────────────┘
```

## Áreas Afectadas

### Backend (Endpoint `/api/skill/lookup`)

**Archivo:** `backend/db/queries/skill.ts` (líneas 39-62)

```sql
const getSkillLinkMetadataByUrlVisibleToActorStmt = () =>
  getDb().prepare(`
    SELECT
      l.id,
      l.url,
      l.title,
      l.description,
      l.og_title,
      l.og_description,
      l.og_image,
      l.category_id,
      c.name AS category_name
      -- ⚠️ FALTA: l.user_id
    FROM links l
    LEFT JOIN categories c ON c.id = l.category_id
    WHERE l.url = ?
      AND (
        l.is_public = 1
        OR (? IS NOT NULL AND l.user_id = ?)
      )
    ORDER BY
      CASE WHEN (? IS NOT NULL AND l.user_id = ?) THEN 0 ELSE 1 END,
      l.created_at DESC
    LIMIT 1
  `);
```

**Problema:** La query NO incluye `l.user_id` en el SELECT, por lo tanto no está disponible en el resultado.

---

**Archivo:** `backend/services/skill-extract.service.ts` (líneas 48-64)

```typescript
export interface SkillLinkMetadata {
  id: number;
  url: string;
  title: string;
  description: string | null;
  og_title: string | null;
  og_description: string | null;
  og_image: string | null;
  category: { id: number; name: string | null } | null;
  // ⚠️ FALTA: userId: number
}

function toSkillLinkMetadata(row: SkillLinkMetadataRow): SkillLinkMetadata {
  return {
    id: row.id,
    url: row.url,
    title: row.title,
    description: row.description,
    og_title: row.og_title,
    og_description: row.og_description,
    og_image: row.og_image,
    category:
      row.category_id === null
        ? null
        : {
            id: row.category_id,
            name: row.category_name,
          },
    // ⚠️ FALTA: userId: row.user_id
  };
}
```

**Problema:** La interfaz `SkillLinkMetadata` y la función `toSkillLinkMetadata()` no incluyen el campo `userId`.

---

**Archivo:** `backend/db/queries/skill.ts` (líneas 3-13)

```typescript
export interface SkillLinkMetadataRow {
  id: number;
  url: string;
  title: string;
  description: string | null;
  og_title: string | null;
  og_description: string | null;
  og_image: string | null;
  category_id: number | null;
  category_name: string | null;
  // ⚠️ FALTA: user_id: number
}
```

**Problema:** La interfaz `SkillLinkMetadataRow` no incluye el campo `user_id` del resultset de la query.

### Frontend (Extensión Chrome)

**Archivo:** `extension/popup/js/save-link.js` (líneas 467-496)

```javascript
async function _checkDuplicate(url, state, els) {
  const { form, dupWarning, dupTitle, dupCategory, dupViewBtn } = els;
  try {
    const res = await lookupLink(url, state.apiKey);
    const link = res?.data?.link ?? null;

    if (link && link.userId === state.userId) {  // ⚠️ link.userId es undefined
      // Show duplicate warning, hide form
      if (dupTitle) {
        dupTitle.textContent = '';
        dupTitle.textContent = link.title || 'Sin título';
      }
      // ...
      if (form)       form.classList.add('hidden');
      if (dupWarning) dupWarning.classList.remove('hidden');
    }
  } catch {
    // Silently proceed
  }
}
```

**Problema:** El código asume que `link.userId` existe, pero el backend NO lo envía. Esto puede causar:
- `undefined === undefined` → `true` (si state.userId es null)
- `undefined === number` → `false` (si state.userId es válido)

---

**Archivo:** `extension/popup/js/app.js` (líneas 44-47)

```javascript
const stored = await storage.get(['apiKey', 'userEmail', 'userId']);
state.apiKey    = stored.apiKey    || null;
state.userEmail = stored.userEmail || null;
state.userId    = stored.userId    || null;  // ⚠️ Puede ser null
```

**Problema potencial:** Si `userId` no está en chrome.storage o es `null`, `state.userId` será `null`, lo que podría causar falsos positivos en la comparación.

---

**Archivo:** `extension/popup/js/auth.js` (líneas 64-73)

```javascript
await storage.set({
  apiKey:        token,
  userEmail:     user?.email ?? email,
  userId:        user?.id ?? null,  // ⚠️ Puede ser null si user.id no viene
  lastValidated: new Date().toISOString(),
});

onSuccess({ apiKey: token, userEmail: user?.email ?? email, userId: user?.id ?? null });
```

**Problema potencial:** Si el backend de Better Auth no retorna `user.id`, el `userId` será `null`.

## Análisis de Causas Raíz (Ordenadas por Probabilidad)

### 🔴 CAUSA #1 (Más Probable): Backend NO envía `userId` en `/api/skill/lookup`

**Evidencia:**
- La query SQL en `skill.ts` NO incluye `l.user_id` en el SELECT
- La interfaz `SkillLinkMetadata` NO tiene el campo `userId`
- La función `toSkillLinkMetadata()` NO mapea `userId`
- El frontend espera `link.userId` pero siempre recibe `undefined`

**Cómo causa el bug:**
1. Usuario A guarda un link público con URL "https://example.com"
2. Usuario B (que nunca guardó ese link) intenta guardar la MISMA URL
3. Frontend llama a `/api/skill/lookup?url=https://example.com`
4. Backend devuelve el link del Usuario A porque es público (`l.is_public = 1`)
5. Backend NO incluye `userId` en la respuesta
6. Frontend recibe `link = { id: 123, url: "https://example.com", ..., userId: undefined }`
7. Frontend compara: `link.userId === state.userId` → `undefined === 5` → `false`
8. **NO muestra el warning** (comportamiento correcto en este caso)

**PERO, si `state.userId` también es `undefined`/`null`:**
7. Frontend compara: `undefined === undefined` → `true`
8. **Muestra el warning de duplicado** ❌ **FALSO POSITIVO**

**Confirmación:**
```javascript
// En la consola del navegador:
console.log('link.userId:', link.userId);  // undefined
console.log('state.userId:', state.userId);  // null o undefined
console.log('Son iguales?', link.userId === state.userId);  // true ❌
```

---

### 🟡 CAUSA #2 (Posible): `state.userId` es `null`/`undefined` en runtime

**Evidencia:**
- `storage.get()` puede devolver `{ userId: undefined }`
- `auth.js` guarda `user?.id ?? null` (si `user.id` no viene, es `null`)
- `app.js` asigna `stored.userId || null` (si no existe, es `null`)

**Cómo causa el bug:**
1. Usuario inicia sesión
2. Backend Better Auth retorna `{ token, user: { ... } }` pero SIN `user.id`
3. Frontend guarda `userId: null` en chrome.storage
4. Al cargar, `state.userId = null`
5. Al verificar duplicados: `link.userId === null` → `undefined === null` → `false`
6. **NO debería mostrar el warning**, pero...

**Si por alguna razón `state.userId` es `undefined`:**
5. `link.userId === state.userId` → `undefined === undefined` → `true`
6. **Muestra el warning** ❌

**Posible razón:**
- Hubo un bug en la autenticación que dejó `state.userId` como `undefined` en lugar de `null`
- El usuario tiene datos "sucios" en chrome.storage de versiones anteriores de la extensión

---

### 🟢 CAUSA #3 (Menos Probable): Race condition en `initSaveLink`

**Evidencia:**
- `initSaveLink(state)` se llama con el `state` global
- Si el `state` cambia mientras se está ejecutando la verificación, podría causar problemas

**Análisis:**
- `initSaveLink` captura el `state` al momento de la llamada
- El check es `await`, así que no hay race condition con la URL
- Pero si `state.userId` cambia mientras se hace el fetch, podría usar el valor incorrecto

**Verdict:** Poco probable, pero posible si el usuario cierra sesión mientras está en la pestaña "Guardar".

---

### 🔵 CAUSA #4 (Improbable): Error 409 del backend

**Evidencia:**
- El backend tiene una restricción UNIQUE `(user_id, url)` (línea 98 de schema.sql)
- Si hay un duplicado en la BD, retorna error 409 con código `CONFLICT`
- El frontend maneja esto en líneas 224-225 de save-link.js

**Análisis:**
- El usuario dice que el backend funciona perfectamente
- Si realmente fuera un 409, el mensaje sería diferente
- El frontend mostraría el error en el formulario, no en el popup de duplicado

**Verdict:** No es la causa, el usuario lo descartó explícitamente.

## Escenarios de Reproducción

### Escenario 1: `state.userId` es `null`

1. Usuario instala extensión por primera vez
2. Usuario inicia sesión pero Better Auth NO retorna `user.id`
3. `storage.set({ userId: null })`
4. `state.userId = null`
5. Usuario intenta guardar un link que otro usuario ya tiene como público
6. Frontend llama a `/api/skill/lookup?url=https://...`
7. Backend devuelve el link público (SIN `userId` en la respuesta)
8. Frontend evalúa: `undefined === null` → `false` ✅ Correcto

**Este escenario NO causa el bug.**

---

### Escenario 2: `state.userId` es `undefined`

1. Usuario actualiza extensión de una versión vieja
2. Chrome.storage tiene `{ apiKey: "...", userEmail: "..." }` pero SIN `userId`
3. `storage.get(['userId'])` retorna `{ userId: undefined }`
4. `state.userId = undefined` (no pasa por el `|| null`)
5. Usuario intenta guardar un link
6. Frontend evalúa: `undefined === undefined` → `true` ❌ **BUG**

**Este escenario SÍ causa el bug.**

---

### Escenario 3: Backend no retorna `user.id` en login

1. Usuario inicia sesión con credenciales válidas
2. Backend Better Auth retorna `{ token: "...", user: { email: "..." } }` SIN `id`
3. `auth.js` guarda `userId: user?.id ?? null` → `null`
4. `state.userId = null`
5. Este es el Escenario 1, NO causa el bug

**PERO, si hay un código viejo que no guarda `userId`:**
3. `storage.set({ apiKey: token, userEmail: email })` (sin userId)
4. `state.userId = undefined` (línea 47 de app.js)
5. Este es el Escenario 2, SÍ causa el bug

## Recomendación de Fix

### Fix #1 (Backend): Agregar `userId` a `/api/skill/lookup`

**Cambios requeridos:**

1. **`backend/db/queries/skill.ts`** - Agregar `l.user_id` al SELECT:

```typescript
const getSkillLinkMetadataByUrlVisibleToActorStmt = () =>
  getDb().prepare(`
    SELECT
      l.id,
      l.user_id,  -- ✅ AGREGAR
      l.url,
      l.title,
      l.description,
      l.og_title,
      l.og_description,
      l.og_image,
      l.category_id,
      c.name AS category_name
    FROM links l
    LEFT JOIN categories c ON c.id = l.category_id
    WHERE l.url = ?
      AND (
        l.is_public = 1
        OR (? IS NOT NULL AND l.user_id = ?)
      )
    ORDER BY
      CASE WHEN (? IS NOT NULL AND l.user_id = ?) THEN 0 ELSE 1 END,
      l.created_at DESC
    LIMIT 1
  `);
```

2. **`backend/db/queries/skill.ts`** - Actualizar interfaz:

```typescript
export interface SkillLinkMetadataRow {
  id: number;
  user_id: number;  // ✅ AGREGAR
  url: string;
  title: string;
  description: string | null;
  og_title: string | null;
  og_description: string | null;
  og_image: string | null;
  category_id: number | null;
  category_name: string | null;
}
```

3. **`backend/services/skill-extract.service.ts`** - Actualizar interfaz y mapper:

```typescript
export interface SkillLinkMetadata {
  id: number;
  userId: number;  // ✅ AGREGAR
  url: string;
  title: string;
  description: string | null;
  og_title: string | null;
  og_description: string | null;
  og_image: string | null;
  category: { id: number; name: string | null } | null;
}

function toSkillLinkMetadata(row: SkillLinkMetadataRow): SkillLinkMetadata {
  return {
    id: row.id,
    userId: row.user_id,  // ✅ AGREGAR
    url: row.url,
    title: row.title,
    description: row.description,
    og_title: row.og_title,
    og_description: row.og_description,
    og_image: row.og_image,
    category:
      row.category_id === null
        ? null
        : {
            id: row.category_id,
            name: row.category_name,
          },
  };
}
```

**Ventajas:**
- Soluciona el problema de raíz
- El frontend puede verificar correctamente si el link pertenece al usuario
- No introduce cambios breaking en el contrato del API (solo agrega un campo)

**Riesgos:**
- Bajo - Solo agrega un campo existente en la BD a la respuesta

---

### Fix #2 (Frontend): Protección contra `state.userId` undefined

**Archivo:** `extension/popup/js/app.js` (líneas 44-47)

**Cambio:**

```javascript
// ANTES (vulnerable a undefined):
const stored = await storage.get(['apiKey', 'userEmail', 'userId']);
state.apiKey    = stored.apiKey    || null;
state.userEmail = stored.userEmail || null;
state.userId    = stored.userId    || null;  // undefined pasa a null, pero undefined === undefined es true

// DESPUÉS (seguro):
const stored = await storage.get(['apiKey', 'userEmail', 'userId']);
state.apiKey    = stored.apiKey    ?? null;
state.userEmail = stored.userEmail ?? null;
state.userId    = stored.userId ?? null;  // Asegura que nunca sea undefined
```

**Explicación:** El operador `??` (nullish coalescing) es más estricto que `||`. Convierte `undefined` a `null` explícitamente, evitando comparaciones `undefined === undefined`.

---

### Fix #3 (Frontend): Validación defensiva en `_checkDuplicate`

**Archivo:** `extension/popup/js/save-link.js` (líneas 467-496)

**Cambio:**

```javascript
async function _checkDuplicate(url, state, els) {
  const { form, dupWarning, dupTitle, dupCategory, dupViewBtn } = els;
  try {
    const res = await lookupLink(url, state.apiKey);
    const link = res?.data?.link ?? null;

    // ✅ AGREGAR validación: solo mostrar warning si userId existe Y coincide
    if (link && link.userId != null && link.userId === state.userId) {
      // Show duplicate warning, hide form
      if (dupTitle) {
        dupTitle.textContent = '';
        dupTitle.textContent = link.title || 'Sin título';
      }
      if (dupCategory) {
        dupCategory.textContent = '';
        dupCategory.textContent = link.category?.name || 'Sin categoría';
      }
      if (dupViewBtn && link.shortCode) {
        dupViewBtn.href = `https://api.urloft.site/api/s/${link.shortCode}`;
      } else if (dupViewBtn) {
        dupViewBtn.href = link.url || '#';
      }
      if (form)       form.classList.add('hidden');
      if (dupWarning) dupWarning.classList.remove('hidden');
    }
  } catch {
    // Silently proceed — duplicate check is best-effort.
  }
}
```

**Ventajas:**
- Protege contra el caso donde `link.userId` es `undefined`
- No muestra el warning si no podemos confirmar que el link pertenece al usuario
- Es un "defensive programming" que complementa el Fix #1

**Riesgos:**
- Muy bajo - Solo agrega una validación adicional

---

### Fix #4 (Frontend): Debug logging temporal

**Archivo:** `extension/popup/js/save-link.js` (líneas 467-496)

**Agregar logs temporales:**

```javascript
async function _checkDuplicate(url, state, els) {
  const { form, dupWarning, dupTitle, dupCategory, dupViewBtn } = els;
  try {
    console.log('[URLoft Duplicate Check] URL:', url);
    console.log('[URLoft Duplicate Check] state.userId:', state.userId);
    console.log('[URLoft Duplicate Check] state.userId type:', typeof state.userId);

    const res = await lookupLink(url, state.apiKey);
    const link = res?.data?.link ?? null;

    console.log('[URLoft Duplicate Check] link:', link);
    console.log('[URLoft Duplicate Check] link.userId:', link?.userId);
    console.log('[URLoft Duplicate Check] link.userId type:', typeof link?.userId);
    console.log('[URLoft Duplicate Check] ¿Son iguales?', link?.userId === state.userId);

    if (link && link.userId === state.userId) {
      console.log('[URLoft Duplicate Check] ⚠️ Mostrando warning de duplicado');
      // ... resto del código
    } else {
      console.log('[URLoft Duplicate Check] ✅ No es duplicado, permitiendo guardar');
    }
  } catch (err) {
    console.log('[URLoft Duplicate Check] ❌ Error en lookup:', err);
  }
}
```

**Propósito:** Ayudar a diagnosticar el problema en producción si los fixes no funcionan.

## Resumen de Recomendaciones

### Acción Inmediata (Prioridad Alta)

1. **Implementar Fix #1 (Backend)** - Agregar `userId` a la respuesta de `/api/skill/lookup`
   - Este es el problema de raíz
   - Sin este fix, el frontend nunca puede verificar correctamente el duplicado

2. **Implementar Fix #3 (Frontend)** - Agregar validación `link.userId != null`
   - Es un "safety net" que previene falsos positivos mientras se deploya el fix del backend
   - Es muy rápido de implementar (una línea)

3. **Implementar Fix #4 (Frontend)** - Agregar logs temporales
   - Para confirmar el diagnóstico en producción
   - Se pueden eliminar después de verificar que el bug está resuelto

### Acción Subsecuente (Prioridad Media)

4. **Implementar Fix #2 (Frontend)** - Usar `??` en lugar de `||`
   - Previene bugs sutiles con `undefined` vs `null`
   - Es una buena práctica de defensive programming

### Acción Opcional (Prioridad Baja)

5. **Agregar test E2E** - Verificar el flujo completo de duplicate check
   - Escenario: Usuario A guarda link público, Usuario B guarda misma URL
   - Verificar que Usuario B NO vea el warning de duplicado

6. **Investigar Better Auth** - Verificar por qué `user.id` podría no venir en login
   - Revisar el endpoint `/api/auth/login` en el backend
   - Confirmar que siempre retorna `user.id`

## Riesgos y Consideraciones

### Riesgo: Breaking Change en el API

**Análisis:** Agregar `userId` a la respuesta de `/api/skill/lookup` NO es un breaking change porque:
- Solo agrega un campo, no elimina ni modifica existentes
- Los clientes que no usan `userId` simplemente lo ignoran
- La convención de JSON es tolerante a campos adicionales

**Mitigación:** Ninguna necesaria.

---

### Riesgo: Performance

**Análisis:** Agregar `l.user_id` al SELECT no impacta la performance porque:
- Ya estamos haciendo JOIN con `links` que tiene `user_id`
- Es una columna adicional en un resultset de 1 fila
- No cambia el plan de ejecución de la query

**Mitigación:** Ninguna necesaria.

---

### Riesgo: Datos Sucios en chrome.storage

**Análisis:** Es posible que usuarios tengan datos de versiones anteriores donde `userId` no existe en chrome.storage.

**Mitigación:**
- Fix #2 usa `?? null` para normalizar `undefined` a `null`
- Fix #3 valida `link.userId != null` antes de comparar
- Opcional: Agregar migration script en `storage.init()` para limpiar datos viejos

## Lista de Verificación de Diagnóstico

Antes de implementar el fix, verificar:

- [ ] Confirmar que `/api/skill/lookup` NO retorna `userId` en la respuesta
  - `curl -H "Authorization: Bearer $API_KEY" "https://api.urloft.site/api/skill/lookup?url=https://example.com"`
  - Verificar que el JSON NO tiene `userId`

- [ ] Confirmar el valor de `state.userId` en runtime
  - Abrir console de la extensión (F12 en el popup)
  - Ejecutar: `console.log(state.userId)`
  - Si es `undefined`, confirmar la Causa #2

- [ ] Confirmar que el frontend está comparando `link.userId === state.userId`
  - Agregar logs temporales (Fix #4)
  - Guardar un link y revisar los logs

- [ ] Confirmar que NO es un error 409 del backend
  - Abrir Network tab en DevTools
  - Buscar request a `/api/links` (POST)
  - Verificar que NO retorna 409

## Conclusión

El bug de falso positivo de duplicados tiene **dos causas que actúan en conjunto**:

1. **Problema primario (Backend):** El endpoint `/api/skill/lookup` NO incluye `userId` en la respuesta, por lo que el frontend no puede verificar si el link pertenece al usuario actual.

2. **Problema secundario (Frontend):** Si `state.userId` es `undefined` (en lugar de `null`), la comparación `undefined === undefined` evalúa a `true`, causando un falso positivo.

**Recomendación:** Implementar ambos Fix #1 (Backend) y Fix #3 (Frontend) simultáneamente para una solución completa y robusta.

## ¿Listo para Proposal?

**Sí** - La exploración está completa. Se identificó la causa raíz, se documentaron todos los escenarios, y se proponen soluciones concretas con análisis de riesgos.

**Siguientes pasos:**
1. Crear propuesta de cambio (proposal) con los fixes propuestos
2. Especificar los requisitos (specs) con los casos de prueba
3. Desglosar en tareas (tasks) con los archivos a modificar
4. Implementar los cambios (apply)
5. Verificar que el bug está resuelto (verify)
