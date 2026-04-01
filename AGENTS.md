# 🔧 URLoft - Technical Documentation

> **Complete technical architecture and implementation details for developers and contributors.**
>
> 📖 **For feature overview and user value**, see the main [README.md](README.md).

---

## 🛠 Tech Stack

| Capa | Tecnología |
|------|-----------|
| **Runtime** | [Bun](https://bun.sh) — JavaScript runtime ultra rápido |
| **Frontend** | [EJS](https://ejs.co) — Motor de plantillas renderizado por Bun (SSR) |
| **Base de Datos** | [SQLite](https://sqlite.org) — embebida, cero config + FTS5 para búsqueda full-text |
| **Email** | [Resend](https://resend.com) — API moderna para emails transaccionales |
| **Auth** | [Better Auth](https://better-auth.com) — Framework-agnostic auth with native SQLite support |
| **Seguridad** | Rate limiting inteligente por IP y por API key |
| **IA Integrations** | MCP Server + Web Skill — conecta cualquier IA a tus links |
| **Extensión** | Chrome Extension (Manifest V3) + HTML/JS popup |
| **PWA** | Service Worker + Web App Manifest — instalable en móvil |
| **Lenguaje** | TypeScript |

### ¿Por qué este stack?

- **Bun** elimina la necesidad de múltiples herramientas (bundler, test runner, package manager) — todo en uno. Además, el proyecto explota a fondo su ecosistema zero-dependency utilizando:
  - `Bun.serve` (con enrutamiento nativo) para un servidor HTTP ultrarrápido, prescindiendo de Express o Fastify.
  - `bun:sqlite` para acceso a la base de datos de forma síncrona y con altísimo rendimiento.
  - `Bun.password` para el hasheo seguro de contraseñas (Argon2id/Bcrypt) de forma nativa, sin requerir librerías externas.
  - `Web Workers` (`new Worker()`) soportados nativamente por Bun para ejecutar background jobs (Health Checker, Reader Mode, Wayback Machine) sin bloquear el hilo principal.
- **EJS + Bun SSR**: Elegimos una arquitectura de **Server-Side Rendering (SSR) radical**. En lugar de usar frameworks pesados con Virtual DOM, usamos el motor de plantillas EJS renderizado directamente por las APIs nativas de Bun. Esto garantiza:
  - **Zero-JS Bundle**: El navegador recibe HTML puro, eliminando el tiempo de "hidratación" y logrando una carga instantánea.
  - **Simplicidad**: Menos dependencias en el lado del cliente y mayor robustez ante errores de red.
  - **SEO Nativo**: Al renderizar todo en el servidor, los motores de búsqueda e IAs pueden indexar el contenido sin ejecutar scripts complejos.
- **Better Auth** es nuestra solución de autenticación porque soporta SQLite de forma nativa (integración directa con `bun:sqlite`, sin adapter adicional), y usa sesiones stateful (validadas contra la DB en cada request) en lugar de JWTs stateless, lo que nos permite revocación inmediata de sesiones y máxima seguridad sin el overhead criptográfico.
- **SQLite** es perfecta para hackathons: cero setup, un solo archivo, queries rápidas — con FTS5 para búsqueda full-text sin servicios externos
- **Resend** envía emails con una sola llamada a su API, sin configurar SMTP ni servicios complejos

---

## 📐 Decisiones de Arquitectura

1. **Procesamiento Asíncrono (Background Jobs):** La extracción de texto (Reader Mode), validación de links (Health Checker) y el guardado en Internet Archive (Wayback Machine) NO bloquean la creación del link. Al guardar un link, se responde inmediatamente al cliente (alta velocidad/UX) y estas tareas pesadas o que dependen de APIs lentas se ejecutan en background (Eventual Consistency), actualizando la base de datos de forma silenciosa al terminar.
2. **SQLite WAL Mode y Backups:** Al usar `PRAGMA journal_mode=WAL;`, SQLite genera 3 archivos (`.sqlite`, `-wal`, y `-shm`) permitiendo lecturas y escrituras concurrentes. Para la función de Backup, el sistema ejecuta un `PRAGMA wal_checkpoint(TRUNCATE);` para consolidar los datos y luego simplemente hace un stream del archivo principal `.sqlite` al usuario, garantizando un backup íntegro en milisegundos sin bloquear la base de datos.

### Convención de Arquitectura Backend (Feature-First + Layered Modular)

El backend se implementa como **monolito modular** sobre Bun (no microservicios distribuidos), organizado por feature con capas internas bien definidas.

**Flujo estándar para cualquier endpoint nuevo:**

`Route (HTTP) -> Service (use case/lógica de negocio) -> Repository/DB (persistencia)`

#### Responsabilidades por capa

- **Routes (`backend/routes/`)**: parsean request/params, validan input HTTP, llaman servicios, serializan response y códigos de estado.
- **Services (`backend/services/`)**: concentran reglas de negocio, orquestación de casos de uso, permisos y coordinación con workers u otros servicios.
- **Repository/DB (`backend/db/`)**: encapsulan acceso a datos (queries, transacciones, mapeo básico) sin reglas de negocio.

#### Dirección de dependencias y anti-patterns

- **Dirección permitida:** `routes -> services -> db`.
- **No permitido:** rutas consultando `db` directo para saltarse servicios.
- **No permitido:** lógica de negocio (ranking, permisos, reglas de visibilidad) en handlers HTTP.
- **No permitido:** servicios acoplados a detalles HTTP (`Request`, `Response`) o a rendering.
- **Nota MVC:** evitamos lenguaje MVC pesado porque este backend es **API-first**; no renderiza vistas del servidor, expone contratos JSON para frontend Svelte/SvelteKit, extensión y clientes MCP.

#### Nomenclatura y ubicación para nuevas features

- Crear archivos por dominio funcional con sufijos explícitos: `*.route.ts`, `*.service.ts`, `*.repository.ts` (si aplica) o integración en `backend/db/queries.ts` cuando corresponda.
- Mantener rutas en `backend/routes/` y servicios en `backend/services/`; si la feature crece, crear subcarpetas por feature para mantener cohesión.
- Nombrar casos de uso con verbos claros (`createLink`, `toggleFavorite`, `importBookmarks`) y evitar nombres genéricos (`processData`, `handleAction`).

#### Guía de testing por capa

- **Routes:** tests de integración HTTP (status codes, payloads, auth/rate-limit middleware).
- **Services:** tests unitarios de reglas de negocio con dependencias mockeadas.
- **Repository/DB:** tests de persistencia con SQLite en memoria para queries, constraints y triggers.
- **End-to-end opcional:** validar flujos críticos completos sin reemplazar cobertura por capa.

---

## 📂 Estructura del Proyecto

```
urloft/
├── backend/               # API server (Bun)
│   ├── auth/              # Better Auth config, middleware y permisos
│   ├── routes/            # Endpoints de la API (auth, audit, admin)
│   ├── middleware/        # Cross-cutting middleware (rate limiting, etc.)
│   ├── db/                # Esquema, conexión, migraciones y tests SQLite
│   ├── emails/            # Templates de email (Resend)
│   ├── mcp/               # MCP Server (tools y handlers)
│   ├── skill/             # Web Skill (search y extract)
│   └── services/          # Lógica de negocio
├── frontend/              # SvelteKit app
│   ├── src/
│   │   ├── routes/        # Rutas file-based (públicas + dashboard)
│   │   └── lib/           # Utilidades y componentes compartidos
│   └── static/            # Assets estáticos del frontend
├── extension/             # Extensión de Chrome
│   ├── manifest.json      # Manifest V3
│   ├── popup/             # UI del popup (Svelte)
│   ├── background/        # Service worker
│   └── icons/             # Iconos de la extensión
├── public/                # Assets estáticos
│   ├── manifest.json      # Web App Manifest (PWA)
│   ├── sw.js              # Service Worker (PWA)
│   └── icons/             # Iconos PWA (192x192, 512x512)
├── backend/db/database.sqlite # BD principal (generada automáticamente)
├── backend/package.json
├── frontend/package.json
└── README.md
```

---

### Estrategia de Renderizado (SSR Nativo)

Aprovechamos la velocidad de **Bun.serve** para manejar el renderizado en el servidor:

- **Todo el sitio** → **SSR (Server-Side Rendering)**
  - Home (`/`), Explore (`/explore`), Perfiles (`/u/:username`), Dashboard.
  - **Por qué:** Máxima velocidad de carga percibida y SEO impecable. No hay una "pantalla de carga" mientras el JS se descarga; el usuario recibe el contenido final de inmediato.
  - **Implementación:** Templates EJS procesados dinámicamente con los datos de la base de datos en cada request.

### Integración Frontend ↔ Backend

Al no usar una SPA, la comunicación es directa mediante **HTML Forms** y **Redirects**, lo que simplifica enormemente el flujo de datos y elimina la necesidad de una API REST separada para las acciones de la UI:

```html
<!-- index.ejs -->
<form method="POST" action="/links/create">
  <input name="url" placeholder="https://..." required />
  <button type="submit">Guardar</button>
</form>
```

**Beneficio:** Robustez total. La app funciona incluso con JavaScript desactivado (progressive enhancement), y no hay desincronización de estado entre cliente y servidor.

### Procesamiento en Segundo Plano (Workers)

Las tareas pesadas (Health Check, Reader Mode, Wayback Machine) se ejecutan en **background workers** usando `Bun.Worker` sin bloquear el servidor web ni la UX del usuario.

---

## 📡 API Reference

### Rutas del Frontend

| Ruta | Página | Acceso |
|------|--------|--------|
| `/` | Página principal — hero, links destacados, usuarios top, stats globales | Pública |
| `/explore` | Explorar links públicos — búsqueda, filtros, tarjetas con like/favorito | Pública |
| `/u/:username` | Perfil público — avatar, bio, rango, links del usuario | Pública |
| `/auth/login` | Iniciar sesión | Pública |
| `/auth/register` | Registro | Pública |
| `/auth/forgot-password` | Recuperar contraseña | Pública |
| `/auth/reset-password/:token` | Restablecer contraseña | Pública |
| `/auth/verify/:token` | Verificar email | Pública |
| `/dashboard` | Panel principal — resumen y estadísticas | Privada |
| `/dashboard/profile` | Editar perfil (nombre, avatar, bio, contraseña) | Privada |
| `/dashboard/links` | CRUD de mis links con estadísticas | Privada |
| `/dashboard/categories` | CRUD de mis categorías | Privada |
| `/dashboard/keys` | Gestión de API keys | Privada |
| `/dashboard/favorites` | Links guardados como favoritos | Privada |
| `/dashboard/import` | Importar bookmarks del navegador | Privada |

### Endpoints de la API

#### Auth
| Método | Ruta | Descripción |
|--------|------|-------------|
| `POST` | `/api/auth/register` | Crear cuenta (envía email de verificación) |
| `POST` | `/api/auth/login` | Iniciar sesión |
| `GET` | `/api/auth/verify/:token` | Verificar email con token |
| `POST` | `/api/auth/forgot-password` | Solicitar recuperación de contraseña |
| `POST` | `/api/auth/reset-password` | Restablecer contraseña con token |
| `POST` | `/api/auth/logout` | Cerrar sesión (invalida token) |

#### Sesiones y Auditoría
| Método | Ruta | Descripción |
|--------|------|-------------|
| `GET` | `/api/sessions` | Listar sesiones activas del usuario |
| `DELETE` | `/api/sessions/:id` | Cerrar una sesión específica |
| `GET` | `/api/audit-log` | Ver historial de eventos de seguridad |

#### Links
| Método | Ruta | Descripción |
|--------|------|-------------|
| `GET` | `/api/links` | Listar links públicos (soporta filtros: `?sort=likes|views|favorites|recent&category=id&q=búsqueda`) |
| `GET` | `/api/links/:id` | Obtener detalle de un link (incluye: likes_count, views, favorites_count, liked_by_me, favorited_by_me) |
| `POST` | `/api/links` | Crear nuevo link |
| `PUT` | `/api/links/:id` | Editar link |
| `DELETE` | `/api/links/:id` | Eliminar link |
| `POST` | `/api/links/:id/like` | Dar/quitar like (toggle) |
| `POST` | `/api/links/:id/favorite` | Agregar/quitar de favoritos (toggle) |
| `POST` | `/api/links/preview` | Extraer metadata OG de una URL (título, descripción, imagen) |
| `GET` | `/api/links/me` | Listar mis links (públicos y privados) con estadísticas |
| `GET` | `/api/links/me/favorites` | Listar links que guardé como favoritos |
| `POST` | `/api/links/import` | Importar bookmarks (recibe archivo HTML, retorna resumen: importados, categorías creadas, duplicados) |

#### Categorías
| Método | Ruta | Descripción |
|--------|------|-------------|
| `GET` | `/api/categories` | Listar categorías del usuario (con cantidad de links) |
| `POST` | `/api/categories` | Crear categoría |
| `PUT` | `/api/categories/:id` | Editar categoría (nombre, color) |
| `DELETE` | `/api/categories/:id` | Eliminar categoría (con opción de reasignar links) |

#### Perfil
| Método | Ruta | Descripción |
|--------|------|-------------|
| `GET` | `/api/users/:username` | Ver perfil público (avatar, bio, rango, stats, links públicos) |
| `PUT` | `/api/users/me` | Editar perfil (nombre, bio, avatar) |
| `PUT` | `/api/users/me/password` | Cambiar contraseña |
| `POST` | `/api/users/me/avatar` | Subir/cambiar avatar |

#### Estadísticas (Dashboard)
| Método | Ruta | Descripción |
|--------|------|-------------|
| `GET` | `/api/stats/me` | Stats del usuario: total links, likes recibidos, views totales, rango |
| `GET` | `/api/stats/global` | Stats globales: total usuarios, links, categorías (para la home) |

#### Short Links
| Método | Ruta | Descripción |
|--------|------|-------------|
| `GET` | `/s/:code` | Redirección al link original (incrementa views) |

#### API Keys
| Método | Ruta | Descripción |
|--------|------|-------------|
| `GET` | `/api/keys` | Listar API keys del usuario |
| `POST` | `/api/keys` | Crear nueva API key |
| `DELETE` | `/api/keys/:id` | Revocar una API key |

#### MCP Server
| Protocolo | Ruta | Descripción |
|-----------|------|-------------|
| `MCP` | `/mcp` | Endpoint MCP — CRUD de links autenticado con API key |

**Tools expuestos vía MCP:**

| Tool | Descripción |
|------|-------------|
| `create_link` | Crear un nuevo link con título, URL, categoría y visibilidad |
| `get_links` | Listar links del usuario con filtros opcionales |
| `get_link` | Obtener detalle de un link por ID |
| `update_link` | Editar un link existente |
| `delete_link` | Eliminar un link |
| `search_links` | Buscar links por palabra clave |
| `get_categories` | Listar categorías del usuario |

#### Web Skill
| Método | Ruta | Descripción |
|--------|------|-------------|
| `GET` | `/api/skill/search` | Buscar links por query, categoría o filtros |
| `GET` | `/api/skill/extract/:id` | Extraer metadata e información de un link |
| `GET` | `/api/skill/lookup` | Buscar links por URL exacta |

---

## 🗃 Modelo de Datos

> **Nota importante sobre SQLite:** Para que las restricciones `ON DELETE CASCADE` funcionen correctamente, es necesario ejecutar `PRAGMA foreign_keys = ON;` en cada conexión a la base de datos.

```sql
-- Usuarios
CREATE TABLE users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT UNIQUE NOT NULL,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  avatar_url TEXT,
  bio TEXT,
  rank TEXT DEFAULT 'newbie',
  email_verified BOOLEAN DEFAULT false,
  verification_token TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Recuperación de contraseña
CREATE TABLE password_resets (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  token TEXT UNIQUE NOT NULL,
  expires_at DATETIME NOT NULL,
  used BOOLEAN DEFAULT false,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Links
CREATE TABLE links (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  url TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  short_code TEXT UNIQUE NOT NULL,
  is_public BOOLEAN DEFAULT true,
  category_id INTEGER,
  views INTEGER DEFAULT 0,
  og_title TEXT,                     -- Open Graph title (auto-extraído)
  og_description TEXT,               -- Open Graph description (auto-extraída)
  og_image TEXT,                     -- Open Graph image URL (auto-extraída)
  status_code INTEGER DEFAULT 200,   -- HTTP status code para detectar Link Rot
  archive_url TEXT,                  -- URL de la copia en Wayback Machine
  content_text TEXT,                 -- Contenido extraído para Reader Mode y FTS5
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE SET NULL,
  UNIQUE(user_id, url)
);

-- Búsqueda full-text (FTS5)
CREATE VIRTUAL TABLE links_fts USING fts5(
  title,
  description,
  url,
  content_text,
  content='links',
  content_rowid='id'
);

-- Categorías
CREATE TABLE categories (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  name TEXT NOT NULL,
  color TEXT DEFAULT '#6366f1',
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  UNIQUE(user_id, name)
);

-- Likes
CREATE TABLE likes (
  user_id INTEGER NOT NULL,
  link_id INTEGER NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (user_id, link_id),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (link_id) REFERENCES links(id) ON DELETE CASCADE
);

-- Favoritos
CREATE TABLE favorites (
  user_id INTEGER NOT NULL,
  link_id INTEGER NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (user_id, link_id),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (link_id) REFERENCES links(id) ON DELETE CASCADE
);

-- Sesiones (fingerprint por sesión)
CREATE TABLE sessions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  token_jti TEXT UNIQUE NOT NULL,       -- ID único de sesión
  ip_address TEXT NOT NULL,
  user_agent TEXT NOT NULL,
  fingerprint TEXT NOT NULL,            -- hash(IP + User-Agent)
  is_active BOOLEAN DEFAULT true,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  expires_at DATETIME NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Audit Log (eventos de seguridad)
CREATE TABLE audit_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER,
  event TEXT NOT NULL,                  -- login, logout, token_rejected, password_change, etc.
  ip_address TEXT,
  user_agent TEXT,
  metadata TEXT,                        -- JSON con detalles extra
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- API Keys (para MCP y Skill)
CREATE TABLE api_keys (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  name TEXT NOT NULL,                   -- nombre descriptivo (ej: "Claude Desktop")
  key_hash TEXT UNIQUE NOT NULL,        -- hash de la API key (nunca se guarda en texto plano)
  key_prefix TEXT NOT NULL,             -- primeros 8 chars para identificación (ej: "urlk_a1b2")
  permissions TEXT DEFAULT 'read',      -- 'read' o 'read+write'
  last_used_at DATETIME,
  expires_at DATETIME,
  is_active BOOLEAN DEFAULT true,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Triggers para mantener FTS5 sincronizado
-- NOTA: Estos triggers son necesarios porque SQLite FTS5 no se actualiza automáticamente
-- al insertar, actualizar o borrar en la tabla original de links.

CREATE TRIGGER links_ai AFTER INSERT ON links BEGIN
  INSERT INTO links_fts(rowid, title, description, url, content_text)
  VALUES (new.id, new.title, new.description, new.url, new.content_text);
END;

CREATE TRIGGER links_ad AFTER DELETE ON links BEGIN
  INSERT INTO links_fts(links_fts, rowid, title, description, url, content_text)
  VALUES('delete', old.id, old.title, old.description, old.url, old.content_text);
END;

CREATE TRIGGER links_au AFTER UPDATE ON links BEGIN
  INSERT INTO links_fts(links_fts, rowid, title, description, url, content_text)
  VALUES('delete', old.id, old.title, old.description, old.url, old.content_text);
  INSERT INTO links_fts(rowid, title, description, url, content_text)
  VALUES (new.id, new.title, new.description, new.url, new.content_text);
END;
```

---

## 🧪 Testing Strategy

### Prioridad 1: Backend & Lógica de Negocio (Bun Test)
Usamos el test runner nativo de Bun (`bun:test`) para validación rápida de API, servicios y base de datos.
- **Sintaxis Jest-compatible:** `test()`, `expect()`, `describe()` sin configuración extra.
- **SQLite en memoria:** Tests de base de datos con `new Database(":memory:")` para no contaminar el archivo real.
- **Mocking nativo:** Función `mock()` integrada para aislar dependencias externas.
- **Coverage:** Ejecutar `bun test --coverage` para ver el reporte de cobertura.

```bash
# Correr todos los tests
bun test

# Tests con watch mode
bun test --watch

# Coverage
bun test --coverage
```

### Prioridad 2: Frontend (Vitest + Testing Library)
Para componentes de UI Svelte, usamos Vitest con `@testing-library/svelte` para pruebas centradas en el comportamiento del usuario.
- **Vitest:** Integrado con Vite/SvelteKit, UI moderna y ejecución ultrarrápida.
- **Testing Library:** Enfoque en lo que el usuario ve y tocá, no en implementación interna.

```bash
# Correr tests de componentes
bun run --cwd frontend test:unit -- --run
```

### Prioridad 3: E2E (Playwright) - Opcional
Si el tiempo lo permite, Playwright permite simular interacciones reales del usuario en un navegador Chrome headless.
- Validación de flujos completos (Registro → Guardar Link → Ver Dashboard).

```bash
# Correr tests E2E
bunx playwright test
```

---

## 🎨 Estilos con Tailwind CSS

Utilizamos **Tailwind CSS v4** con el nuevo plugin oficial para Vite, proporcionando una solución de estilos utility-first con cero archivos CSS que mantener.

### ¿Por qué Tailwind CSS v4?

- **Plugin oficial para Vite** (`@tailwindcss/vite`) — integración nativa y ultrarrápida con el build system
- **Utility-first** — estilos directamente en el HTML/Svelte, sin archivos CSS enormes
- **Zero-config** — el plugin detecta automáticamente las clases usadas y genera solo el CSS necesario
- **Tema personalizable** — configuración centralizada para colores, espaciados y tipografía

### Setup Inicial

```bash
# Instalar Tailwind CSS v4 y el plugin de Vite
bun add -D tailwindcss @tailwindcss/vite
```

```typescript
// vite.config.ts
import { tailwindcss } from "@tailwindcss/vite";

export default {
  plugins: [
    tailwindcss(),
    // ... otros plugins
  ],
};
```

```css
/* frontend/src/app.css (o punto de entrada CSS) */
@import "tailwindcss";

/* Opcional: customizaciones de tema */
@theme {
  --color-primary: #6366f1;
  --font-sans: "Inter", sans-serif;
}
```

### Uso en Componentes Svelte

```svelte
<div class="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
  <h1 class="text-2xl font-bold text-gray-900 dark:text-white">
    Mi Link
  </h1>
  <button class="mt-4 px-4 py-2 bg-primary text-white rounded hover:opacity-90">
    Guardar
  </button>
</div>
```

### Ventajas

- **No más archivos CSS** — cada estilo vive junto al componente
- **Consistencia visual** — diseño system predefinido
- **Responsive automático** — clases como `md:flex lg:grid` sin media queries manuales
- **Dark mode nativo** — `dark:` prefijo para variantes oscuras
- **Bundle ultraligero** — solo se incluye el CSS que realmente usas

---

## 🚢 Deployment

```bash
# Build para producción
bun run build

# Iniciar en producción
bun run start
```

La app está diseñada para correr en cualquier servidor que soporte Bun. Opciones recomendadas:
- **Railway** — deploy directo desde GitHub
- **Fly.io** — con Dockerfile
- **VPS** — cualquier Linux con Bun instalado

---

## 🌐 Estrategia de Deploy y Hosting

Nuestra arquitectura de infraestructura está diseñada para **maximizar la velocidad durante el hackatón** y **escalar eficientemente en producción**.

### Fase 1: Hackatón (Deploy en España)

Durante el evento, desplegamos en un servidor ubicado en **España** (misma región que los jueces y asistentes).

**Por qué:**
- **Latencia mínima (~20ms):** Los jueces experimentan una app ultrarrápida.
- **Mejor impresión:** "¡Esta app vuela!" vs "Esta app se siente lenta".
- **Demo impecable:** Caché de estáticos en Cloudflare + API cerca de la audiencia.

**Stack:**
- **VPS/Hosting en España** (cualquier proveedor con data center europeo).
- **Cloudflare:** CDN global + DDoS protection + SSL gratuito.

---

### Fase 2: Producción (Post-Hackatón)

Migramos a la infraestructura patrocinada para escalar globalmente.

**Hosting:**
- **CubePath (Florida, USA):** Servidor principal con Bun + SQLite.
- **Cloudflare:** CDN global para contenido estático y seguridad.

**Por qué CubePath + Cloudflare:**
- **Patrocinador del hackatón:** Aprovechamos soporte y visibilidad.
- **CDN global:** Usuarios en cualquier parte del mundo descargan JS/CSS desde el edge más cercano (~20ms).
- **Optimizaciones:**
  - `Cache-Control` agresivo en rutas públicas (Home, Explore).
  - HTTP/3 para mayor velocidad.
  - DDoS protection incluido.

**Consideración de latencia:**
- **Usuarios España:** ~200ms (API viaja a Florida) — aceptable.
- **Usuarios LATAM/EE.UU:** ~30-50ms (óptimo).

---

### Plan de Migración (España → CubePath)

Si el proyecto crece post-evento:
1. Exportar base de datos SQLite (`database.sqlite`).
2. Configurar variables de entorno en CubePath.
3. Deploy via `bun run build && bun run start`.
4. Actualizar DNS en Cloudflare para apuntar al nuevo servidor.

La **arquitectura simple** hace esta migración trivial.

---

## 📦 Instalación

### Prerrequisitos

- [Bun](https://bun.sh) v1.0+

### Setup

```bash
# Clonar el repositorio
git clone https://github.com/tu-usuario/urloft.git
cd urloft

# Instalar dependencias (backend + frontend)
cd backend && bun install
cd ../frontend && bun install
cd ..

# Configurar variables de entorno del backend
cp .env.example backend/.env

# Inicializar la base de datos
cd backend && bun run db:setup
cd ..

# Iniciar backend (terminal 1)
cd backend && bun run dev

# Iniciar frontend (terminal 2)
cd frontend && bun run dev
```

### Variables de Entorno

```env
# Server
PORT=3000
HOST=localhost

# Database
DATABASE_URL=./database.sqlite

# Auth (Better Auth)
BETTER_AUTH_SECRET=tu-secreto-super-seguro
BETTER_AUTH_URL=http://localhost:3000
TRUST_PROXY=false                 # Habilitar solo detrás de proxy confiable

# Email (Resend)
RESEND_API_KEY=re_xxxxxxxxxx
EMAIL_FROM=noreply@urloft.site

# Short Links
BASE_URL=https://urloft.site
SHORT_PREFIX=s

# API Keys
API_KEY_PREFIX=urlk                # Prefijo para las keys generadas (ej: urlk_a1b2c3d4)
API_RATE_LIMIT=100                 # Requests por minuto por key
```

---

## 🗺 Roadmap

- [x] CRUD de links
- [x] Sistema de categorías
- [x] Links públicos/privados
- [x] Short links
- [x] Sistema de likes
- [x] Sistema de favoritos
- [x] Contador de views
- [x] Perfiles de usuario
- [x] Sistema de rangos
- [x] Verificación de email (Resend)
- [x] Recuperación de contraseña (Resend)
- [x] Autenticación Better Auth con sesiones stateful + fingerprint
- [x] Audit log de eventos de seguridad
- [x] Sistema de API Keys
- [x] MCP Server (CRUD de links para IAs)
- [x] Web Skill (búsqueda y extracción de info)
- [x] Extensión de Chrome
- [x] Link Preview (extracción automática de metadata OG)
- [x] Búsqueda full-text con SQLite FTS5
- [x] Rate limiting por IP y por API key
- [x] PWA (Progressive Web App)
- [x] Dashboard privado (perfil, links, categorías, API keys, favoritos)
- [x] Página principal con links destacados y stats globales
- [x] Explorar links públicos con filtros (likes, views, favoritos, categoría, fecha)
- [x] Perfiles públicos con rango, stats y links del usuario
- [x] Trazabilidad de clicks vía short links
- [x] Importar bookmarks del navegador (Chrome y Firefox)
- [ ] Modo colaborativo (colecciones compartidas)

---

## 🤝 Contribuir

1. Fork del proyecto
2. Crea tu feature branch (`git checkout -b feature/nueva-feature`)
3. Commit tus cambios (`git commit -m 'feat: agregar nueva feature'`)
4. Push al branch (`git push origin feature/nueva-feature`)
5. Abre un Pull Request

---

## 👥 Equipo

| Nombre | Rol | GitHub |
|--------|-----|--------|
| TBD | Full Stack Dev | [@tu-usuario](https://github.com/tu-usuario) |

---

## 📄 Licencia

Este proyecto está bajo la Licencia MIT. Ver el archivo [LICENSE](LICENSE) para más detalles.

---

> Hecho con ❤️ para el Hackathon 2026 midudev
