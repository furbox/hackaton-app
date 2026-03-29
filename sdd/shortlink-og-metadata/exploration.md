# Exploration: Shortlink Open Graph Metadata

## Current State

El flujo actual del shortlink es un **redirect HTTP 302 simple** sin metadata OG:

```
Usuario/Red Social → GET https://urloft.site/s/abc123
                  ↓
         Frontend (short-link.controller.ts)
                  ↓
         Backend (api/short.ts) → HTTP 302 → Location: https://original-url.com
                  ↓
         Frontend hace proxy del redirect (HTTP 302)
                  ↓
         Red Social sigue redirect al sitio original
                  ↓
         Red Social usa OG metadata del SITIO ORIGINAL ✅
```

### Archivos clave del flujo actual:

1. **`frontend-bun-ejs/src/controllers/short-link.controller.ts`** (líneas 89-204)
   - Maneja `GET /s/:code`
   - Hace proxy del request al backend: `GET /api/s/${code}`
   - Si el backend responde con 302, hace `Response.redirect(location, 302)`
   - Si el backend responde con 200 JSON, extrae la URL y hace redirect
   - Casos de error renderizan HTML (404, 403, 502, 503)

2. **`backend/routes/api/short.ts`** (líneas 85-118)
   - Maneja `GET /api/s/:code`
   - Llama al servicio `resolveShortCode`
   - **Retorna `Response.redirect(result.data.url, 302)` directamente**
   - En caso de error, retorna JSON con el error

3. **`backend/services/short-links.service.ts`** (líneas 52-107)
   - `resolveShortCode()` retorna solo `{ url, id }`
   - Incrementa views y registra visita
   - Valida permisos para links privados

### ¿El shortlink retorna HTML con OG metadata?

**NO** - Solo hace redirect HTTP 302. No hay HTML intermedio con meta tags OG.

### ¿Qué se muestra al compartir en redes sociales?

- **Twitter/Facebook/LinkedIn**: Ven el redirect a `https://original-url.com`
- Hacen un segundo request al sitio original
- **Usan los OG metadata del SITIO ORIGINAL**, no de URLoft
- **Resultado**: El card muestra el título/descripción/imagen del sitio original

## Affected Areas

- `frontend-bun-ejs/src/controllers/short-link.controller.ts`
  - Controller actual que hace proxy del redirect
  - Necesita modificar para retornar HTML con OG o cambiar la lógica

- `backend/routes/api/short.ts`
  - Ruta que retorna HTTP 302 actualmente
  - Necesita modificar para retornar datos del link (no solo redirect)

- `backend/services/short-links.service.ts`
  - `resolveShortCode()` retorna solo `{ url, id }`
  - Necesita retornar también `title`, `description`, `og_title`, `og_description`, `og_image`

- `frontend-bun-ejs/views/layouts/base.ejs`
  - Template base con OG metadata genéricos de URLoft
  - Necesita crear template específico para shortlink con OG dinámicos

- `backend/db/queries/links.ts`
  - Interfaz `Link` ya tiene los campos necesarios: `og_title`, `og_description`, `og_image`
  - `getLinkByShortCodeVisibleToActor()` ya retorna el link completo

## Approaches

### 1. **Página Intermedia con OG Metadata (RECOMENDADA)**

**Descripción:**
- Crear una página HTML intermedia con meta tags OG del link
- Incluir JavaScript para auto-redirect después de X segundos
- Mostrar un mensaje "Redirigiendo a [título]..." o "Continuar al sitio"

**Ventajas:**
- ✅ Control total de OG metadata al compartir
- ✅ Branding de URLoft en el card (logo, colores)
- ✅ Muestra título/descripción del link guardado (no del sitio original)
- ✅ Puede mostrar stats del link (views, likes, autor)
- ✅ Perfecto para redes sociales que respetan meta tags
- ✅ Incrementa views correctamente (la página intermedia cuenta la visita)

**Desventajas:**
- ❌ Requiere un click extra del usuario (o auto-redirect con delay)
- ❌ Latencia adicional (~200-500ms)
- ❌ Más complejo de implementar

**Cambios requeridos:**

1. **Backend (`backend/routes/api/short.ts`):**
   ```typescript
   // En lugar de hacer redirect, retornar JSON con datos del link
   if (result.ok) {
     return Response.json({
       url: result.data.url,
       title: result.data.title,
       description: result.data.description,
       og_title: result.data.og_title,
       og_description: result.data.og_description,
       og_image: result.data.og_image,
       views: result.data.views,
       owner_username: result.data.owner_username,
     });
   }
   ```

2. **Backend (`backend/services/short-links.service.ts`):**
   ```typescript
   export type ResolvedLinkDTO = {
     url: string;
     id: number;
     title: string;
     description: string | null;
     og_title: string | null;
     og_description: string | null;
     og_image: string | null;
     views: number;
     owner_username: string;
   };
   ```

3. **Frontend (`frontend-bun-ejs/src/controllers/short-link.controller.ts`):**
   ```typescript
   // Si el backend responde 200 con datos, renderizar HTML con OG
   if (response.status === 200) {
     const linkData = await response.json();
     return renderPage("short-link", {
       data: {
         title: `${linkData.title} — via URLoft`,
         url: linkData.url,
         og_title: linkData.og_title || linkData.title,
         og_description: linkData.og_description || linkData.description,
         og_image: linkData.og_image,
         views: linkData.views,
         owner: linkData.owner_username,
       },
     });
   }
   ```

4. **Frontend (`frontend-bun-ejs/views/pages/short-link.ejs`):**
   ```ejs
   <!DOCTYPE html>
   <html lang="es">
   <head>
     <meta property="og:type" content="website" />
     <meta property="og:title" content="<%= og_title %>" />
     <meta property="og:description" content="<%= og_description %>" />
     <meta property="og:image" content="<%= og_image || '/public/logo-urloft.png' %>" />
     <meta property="og:url" content="<%= url %>" />
     <meta name="twitter:card" content="summary_large_image" />
     <meta name="twitter:title" content="<%= og_title %>" />
     <meta name="twitter:description" content="<%= og_description %>" />
     <meta name="twitter:image" content="<%= og_image || '/public/logo-urloft.png' %>" />
     <title><%= title %></title>

     <style>
       body { font-family: system-ui; text-align: center; padding: 2rem; }
       .card { max-width: 600px; margin: 0 auto; }
     </style>

     <script>
       // Auto-redirect después de 2 segundos
       setTimeout(() => {
         window.location.href = '<%= url %>';
       }, 2000);
     </script>
   </head>
   <body>
     <div class="card">
       <h1><%= og_title %></h1>
       <p><%= og_description %></p>
       <p>👁 <%= views %> views • Guardado en URLoft</p>
       <p>Redirigiendo al sitio...</p>
       <a href="<%= url %>">Click aquí si no redirige automáticamente</a>
     </div>
   </body>
   </html>
   ```

**Estimación de tiempo:** 2-3 horas

---

### 2. **Mantener Redirect Simple (actual)**

**Descripción:**
- No hacer cambios
- Seguir haciendo HTTP 302 al sitio original
- Dejar que las redes sociales usen los OG del sitio original

**Ventajas:**
- ✅ No requiere click extra
- ✅ Latencia mínima
- ✅ Sin cambios en el código

**Desventajas:**
- ❌ Sin control de OG metadata
- ❌ Sin branding de URLoft
- ❌ El card puede mostrar información diferente a lo que el usuario guardó

**Estimación de tiempo:** 0 horas (actual)

---

### 3. **Meta Refresh Redirect (NO RECOMENDADO)**

**Descripción:**
- Retornar HTML con `<meta http-equiv="refresh" content="0;url=...">`
- Incluir meta tags OG en el HTML

**Ventajas:**
- ✅ Muestra OG metadata
- ✅ Auto-redirect inmediato

**Desventajas:**
- ❌ **No funciona en todas las redes sociales** (Facebook lo respeta, Twitter no siempre)
- ❌ Considerado mala práctica
- ❌ Puede ser bloqueado por filtros de seguridad

**Estimación de tiempo:** 1-2 horas

---

## Recommendation

**Elegir la Opción 1: Página Intermedia con OG Metadata**

**Justificación:**

1. **Control total de la experiencia al compartir:**
   - El card de Twitter/Facebook/LinkedIn muestra el título y descripción que el usuario guardó
   - Muestra branding de URLoft (logo, colores)
   - Puede incluir stats del link (views, likes)

2. **Mejor UX para el usuario final:**
   - Ve información del enlace antes de hacer click
   - Sabe que el enlace es seguro (viene de URLoft)
   - Auto-redirect de 2 segundos es imperceptible para la mayoría

3. **Diferenciador competitivo:**
   - Bit.ly, TinyURL, etc. no tienen OG metadata personalizados
   - URLoft puede ofrecer "cards bonitos" al compartir
   - Perfecto para el demo del hackatón

4. **Implementación limpia:**
   - Sigue la arquitectura actual (frontend + backend separados)
   - Reutiliza datos que ya tenemos en la BD (og_title, og_description, og_image)
   - No requiere cambios complejos

**Tradeoff aceptable:**
- El delay de 2 segundos es un precio pequeño a cambio de control total de OG metadata
- La mayoría de los usuarios no notarán el delay (es imperceptible)
- Para usuarios que prefieren velocidad, pueden copiar la URL original directamente

## Risks

1. **Latencia adicional:**
   - Página intermedia + auto-redirect = ~200-500ms extra
   - **Mitigación:** Usar un delay corto (2 segundos) o hacerlo inmediato con JavaScript

2. **Compatibilidad con redes sociales:**
   - Algunas redes sociales podrían no seguir el JavaScript redirect
   - **Mitigación:** Incluir link manual "Click aquí si no redirige"

3. **SEO:**
   - Los shortlinks podrían ser indexados por Google
   - **Mitigación:** Agregar `<meta name="robots" content="noindex, follow">` en la página intermedia

4. **Datos OG faltantes:**
   - Si el link no tiene og_image, mostrar una imagen por defecto
   - **Mitigación:** Usar logo de URLoft como fallback

## Ready for Proposal

**Sí** - El análisis está completo y la recomendación es clara.

**Siguiente paso:**
El orchestrator debe presentarle al usuario esta exploración y preguntar si desea proceder con la Opción 1 (página intermedia con OG metadata).

Si el usuario confirma, se debe crear una **proposal** con:
- Intent: Agregar OG metadata personalizados a los shortlinks
- Scope: Modificar backend (API + servicio), frontend (controller), crear nueva vista
- Approach: Página intermedia HTML con meta tags OG + JavaScript auto-redirect
- Tasks breakdown: Lista de tareas específicas para implementación
