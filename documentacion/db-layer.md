# Documentación - Database Layer (Phase 2)

> **URLoft Base de Datos - Guía completa de implementación**
>
> Fecha: 2026-03-24  
> Versión: 1.0.0

---

## 📚 Tabla de Contenidos

1. [Arquitectura General](#arquitectura-general)
2. [Esquema de Base de Datos](#esquema-de-base-de-datos)
3. [Componentes del Sistema](#componentes-del-sistema)
4. [Patrones y Best Practices](#patrones-y-best-practices)
5. [API de Consultas](#api-de-consultas)
6. [Testing](#testing)
7. [Troubleshooting](#troubleshooting)

---

## Arquitectura General

### Stack Tecnológico

- **Motor de Base de Datos**: SQLite 3
- **Runtime**: Bun (JavaScript/TypeScript)
- **Módulo SQLite**: `bun:sqlite` (implementación nativa de Bun)
- **Buscador Full-Text**: SQLite FTS5
- **Modo de Escritura**: WAL (Write-Ahead Logging)

### ¿Por qué SQLite?

**Ventajas para URLoft:**
- ✅ Zero-config - No requiere servidor de base de datos
- ✅ Embebido - Un solo archivo (`backend/db/database.sqlite`)
- ✅ Ultrarrápido - Queries síncronas sin overhead de red
- ✅ FTS5 nativo - Búsqueda full-text integrada
- ✅ Portátil - Backup completo copiando un archivo
- ✅ Transaccional - ACID compliance garantizado

---

## Esquema de Base de Datos

### Tablas Principales (10)

#### 1. `ranks` - Sistema de Gamificación
```sql
CREATE TABLE ranks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT UNIQUE NOT NULL,                  -- newbie, active, power_user, legend, god_mode
  min_links INTEGER NOT NULL,                 -- Mínimo de links para alcanzar el rango
  max_links INTEGER,                          -- Máximo (NULL para ilimitado)
  display_name TEXT NOT NULL,                 -- "🌱 Newbie", "⚡ Active", etc.
  badge_url TEXT,                             -- URL al icono/badge
  color TEXT DEFAULT '#6366f1',              -- Color para UI
  description TEXT,                           -- Descripción del rango
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

**Datos iniciales**: 5 rangos preconfigurados (newbie → god_mode)

---

#### 2. `users` - Usuarios
```sql
CREATE TABLE users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT UNIQUE NOT NULL,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,                -- Bcrypt/Argon2id hash
  avatar_url TEXT,
  bio TEXT,
  rank_id INTEGER NOT NULL DEFAULT 1,        -- FK → ranks(id)
  email_verified INTEGER DEFAULT 0,           -- SQLite usa INTEGER para BOOLEAN
  verification_token TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (rank_id) REFERENCES ranks(id) ON DELETE RESTRICT
);
```

**FK Constraints**:
- `rank_id` → `ranks(id)` con `ON DELETE RESTRICT` (no borrar rangos con usuarios)

---

#### 3. `password_resets` - Recuperación de Contraseña
```sql
CREATE TABLE password_resets (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  token TEXT UNIQUE NOT NULL,                  -- Token de recuperación (UUID)
  expires_at DATETIME NOT NULL,               - Validación (ej: 1 hora)
  used INTEGER DEFAULT 0,                     -- SQLite usa INTEGER para BOOLEAN
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
```

**Cascade Behavior**: Al eliminar un usuario, se eliminan sus tokens de recuperación.

---

#### 4. `categories` - Categorías de Links
```sql
CREATE TABLE categories (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  name TEXT NOT NULL,
  color TEXT DEFAULT '#6366f1',              -- Color hex para UI
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  UNIQUE(user_id, name)                       -- Un nombre único por usuario
);
```

---

#### 5. `links` - Links (Tabla Principal)
```sql
CREATE TABLE links (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  url TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  short_code TEXT UNIQUE NOT NULL,            -- Código para short URLs (ej: "abc12")
  is_public INTEGER DEFAULT 1,                -- SQLite usa INTEGER para BOOLEAN
  category_id INTEGER,
  views INTEGER DEFAULT 0,                     - Contador de vistas
  og_title TEXT,                              -- Open Graph metadata (auto-extraído)
  og_description TEXT,
  og_image TEXT,
  status_code INTEGER DEFAULT 200,            - HTTP status (link rot detection)
  archive_url TEXT,                           - Copia en Wayback Machine
  content_text TEXT,                          - Texto extraído (Reader Mode + FTS5)
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE SET NULL,
  UNIQUE(user_id, url)                        - Un usuario no puede duplicar URLs
);
```

**Open Graph Metadata**: Se extraen automáticamente al crear el link.

**Link Rot Detection**: `status_code` se actualiza periódicamente para detectar links rotos.

---

#### 6. `links_fts` - Búsqueda Full-Text (FTS5)
```sql
CREATE VIRTUAL TABLE links_fts USING fts5(
  title,
  description,
  url,
  content_text,
  content='links',
  content_rowid='id'
);
```

**External Content Table**: No duplica datos, solo indexa la tabla `links`.

---

#### 7. `likes` - Likes en Links
```sql
CREATE TABLE likes (
  user_id INTEGER NOT NULL,
  link_id INTEGER NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (user_id, link_id),             - Un usuario puede dar like solo una vez
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (link_id) REFERENCES links(id) ON DELETE CASCADE
);
```

**Cascade**: Si se elimina el usuario o el link, se eliminan los likes.

---

#### 8. `favorites` - Favoritos
```sql
CREATE TABLE favorites (
  user_id INTEGER NOT NULL,
  link_id INTEGER NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (user_id, link_id),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (link_id) REFERENCES links(id) ON DELETE CASCADE
);
```

---

#### 9. `sessions` - Sesiones de Usuario
```sql
CREATE TABLE sessions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  token_jti TEXT UNIQUE NOT NULL,             - JWT ID único
  ip_address TEXT NOT NULL,
  user_agent TEXT NOT NULL,
  fingerprint TEXT NOT NULL,                  - hash(IP + User-Agent)
  is_active INTEGER DEFAULT 1,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  expires_at DATETIME NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
```

**Security**: `fingerprint` previene robo de tokens de sesión.

---

#### 10. `audit_logs` - Auditoría de Seguridad
```sql
CREATE TABLE audit_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER,                            - Nullable para eventos del sistema
  event TEXT NOT NULL,                        - login, logout, token_rejected, etc.
  ip_address TEXT,
  user_agent TEXT,
  metadata TEXT,                              - JSON con detalles extra
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
```

**Eventos Auditados**:
- Login/logout
- Token verification failures
- Password changes
- API key creation/revocation

---

#### 11. `api_keys` - API Keys (MCP Server / Web Skill)
```sql
CREATE TABLE api_keys (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  name TEXT NOT NULL,                         - Nombre descriptivo (ej: "Claude Desktop")
  key_hash TEXT UNIQUE NOT NULL,              - Hash de la API key (nunca en texto plano)
  key_prefix TEXT NOT NULL,                   - Primeros 8 caracteres (ej: "urlk_a1b2")
  permissions TEXT DEFAULT 'read',            - 'read' o 'read+write'
  last_used_at DATETIME,
  expires_at DATETIME,
  is_active INTEGER DEFAULT 1,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
```

**Security**: Las API keys se almacenan hasheadas (Bcrypt/Argon2id).

---

## Triggers - FTS5 Sync

Los triggers son **CRÍTICOS** porque SQLite FTS5 no actualiza automáticamente el índice.

### Trigger 1: `links_ai` (AFTER INSERT)
```sql
CREATE TRIGGER links_ai AFTER INSERT ON links BEGIN
  INSERT INTO links_fts(rowid, title, description, url, content_text)
  VALUES (new.id, new.title, new.description, new.url, new.content_text);
END;
```

**Propósito**: Agregar nuevos links al índice FTS5 cuando se crean.

---

### Trigger 2: `links_ad` (AFTER DELETE)
```sql
CREATE TRIGGER links_ad AFTER DELETE ON links BEGIN
  INSERT INTO links_fts(links_fts, rowid, title, description, url, content_text)
  VALUES('delete', old.id, old.title, old.description, old.url, old.content_text);
END;
```

**Propósito**: Eliminar links del índice FTS5 cuando se borran.

---

### Trigger 3: `links_au` (AFTER UPDATE)
```sql
CREATE TRIGGER links_au AFTER UPDATE ON links BEGIN
  INSERT INTO links_fts(links_fts, rowid, title, description, url, content_text)
  VALUES('delete', old.id, old.title, old.description, old.url, old.content_text);
  INSERT INTO links_fts(rowid, title, description, url, content_text)
  VALUES (new.id, new.title, new.description, new.url, new.content_text);
END;
```

**Propósito**: Actualizar el índice FTS5 cuando se modifica un link.

---

## Componentes del Sistema

### 1. `backend/db/schema.sql` (225 líneas)

**Propósito**: Definición completa del esquema de base de datos.

**Contenido**:
- 11 tablas (10 normales + 1 FTS5 virtual)
- 3 triggers para sincronización FTS5
- 5 rangos iniciales
- Constraints y FK relationships

**Uso**:
- Ejecutado por `migrations.ts` en `initializeDatabase()`
- También puede usarse para referencia manual

---

### 2. `backend/db/connection.ts` (122 líneas)

**Propósito**: Wrapper de conexión a la base de datos con patrón Singleton.

**Key Features**:
- **Singleton Pattern**: Una sola conexión durante toda la aplicación
- **Foreign Keys habilitados**: `PRAGMA foreign_keys = ON;` automáticamente
- **Ubicación de la DB**: El archivo ahora vive en `backend/db/database.sqlite` para mejor organización.
- **Type-safe**: Devuelve tipo `Database` de Bun SQLite

**API**:
```typescript
import { getDatabase, closeDatabase } from "./connection";

// Obtener conexión (siempre la misma instancia)
const db = getDatabase();

// Cerrar conexión (útil para tests)
closeDatabase();
```

**¿Por qué Singleton?**
- SQLite tiene límites en writes concurrentes
- WAL mode mejora concurrencia pero una sola conexión es óptimo
- Evita "database is locked" errors

---

### 3. `backend/db/verify.ts` (91 líneas)

**Propósito**: Componente encargado de realizar el "Smoke Test" de la base de datos al inicio del servidor.

**Funciones**:
- **`verifyDatabaseConnection()`**: Realiza un chequeo exhaustivo antes de arrancar la aplicación.

**Qué verifica**:
1. ✅ **Conectividad**: Que se puede abrir el archivo de la base de datos.
2. ✅ **Inicialización**: Que las tablas principales (`users`, `links`, etc.) existan.
3. ✅ **Modo WAL**: Que el Write-Ahead Logging esté activo para concurrencia.
4. ✅ **Salud del Esquema**: Que el conteo de tablas core sea correcto.

**Uso en `backend/index.ts`**:
```typescript
import { verifyDatabaseConnection } from "./db/verify";

if (!verifyDatabaseConnection()) {
  console.error("⛔ Cannot start server without a valid database");
  process.exit(1);
}
// Solo si pasa, se inicia Bun.serve()
```

---

### 4. `backend/db/migrations.ts` (119 líneas)

**Propósito**: Sistema de inicialización y migraciones de base de datos.

**Funciones**:

#### `initializeDatabase()`
```typescript
import { initializeDatabase } from "./migrations";

await initializeDatabase();
// ✅ Database initialized successfully
//    - Schema executed
//    - WAL mode enabled
```

**Qué hace**:
1. Lee `schema.sql` usando `Bun.file()` (API nativa de Bun)
2. Ejecuta el schema SQL en la conexión
3. Habilita WAL mode: `PRAGMA journal_mode=WAL;`
4. Maneja errores con logging detallado

---

#### `isDatabaseInitialized()`
```typescript
import { isDatabaseInitialized } from "./migrations";

if (!isDatabaseInitialized()) {
  await initializeDatabase();
}
```

**Qué hace**: Verifica si la tabla `users` existe (indica que el schema está cargado).

---

### 5. `backend/db/setup.ts` (68 líneas)

**Propósito**: Entry point para ejecutar migraciones desde CLI.

**Uso**:
```bash
$ bun run db:setup
🚀 Initializing database...
✅ Database initialized successfully
   - Schema executed
   - WAL mode enabled
🎉 Database is ready to use!
```

**Qué hace**:
- Verifica si la DB ya está inicializada
- Si no, llama a `initializeDatabase()`
- Logea mensajes de éxito/error amigables

---

### 6. `backend/db/queries.ts` (~1,000 líneas)

**Propósito**: Layer de prepared statements para operaciones CRUD.

**Por qué prepared statements?**
- **Performance**: SQL compilado una vez, ejecutado muchas veces
- **Security**: Previene SQL injection automáticamente
- **Type-safe**: Parámetros tipados con TypeScript

---

#### User Queries (5 funciones)

**`createUser(params)`**
```typescript
import { createUser } from "./queries";

const userId = createUser({
  username: "johndoe",
  email: "john@example.com",
  password_hash: "$2b$12$...", // Bcrypt hash
  bio: "Full stack developer"
});
// Returns: number (userId)
```

---

**`getUserByEmail(email)`**
```typescript
const user = getUserByEmail("john@example.com");
// Returns: User | null
```

---

**`getUserById(id)`**
```typescript
const user = getUserById(123);
// Returns: User | null
```

---

**`updateUser(id, params)`**
```typescript
updateUser(123, {
  bio: "Updated bio",
  avatar_url: "https://example.com/avatar.jpg"
});
// Actualiza solo campos proporcionados (null = no cambiar)
```

**Nota**: Usa `COALESCE(?, column)` para permitir actualizaciones parciales.

---

**`verifyEmail(token)`**
```typescript
verifyEmail("abc123token");
// Marca email_verified = 1
```

---

#### Link Queries (7 funciones)

**`createLink(params)`**
```typescript
const linkId = createLink({
  user_id: 123,
  url: "https://example.com",
  title: "Example Site",
  description: "An example website",
  short_code: "abc12", // Opcional: se genera si no se proporciona
  category_id: 5,
  is_public: true
});
// Returns: number (linkId)
```

**Short Code**: Si no se proporciona, se genera automáticamente usando random string.

---

**`getLinksByUser(userId)`**
```typescript
const links = getLinksByUser(123);
// Returns: Link[] (todos los links del usuario)
```

---

**`getPublicLinks(filters)`**
```typescript
const links = getPublicLinks({
  sort: "likes",        // "likes" | "views" | "favorites" | "recent"
  category_id: 5,       // Opcional: filtrar por categoría
  limit: 20,
  offset: 0
});
// Returns: Link[] con agregaciones (likes_count, favorites_count)
```

**Agregaciones**:
- `likes_count`: Cuántos likes tiene cada link
- `favorites_count`: Cuántos favorites tiene cada link

---

**`getLinkById(id)`**
```typescript
const link = getLinkById(456);
// Returns: Link | null
```

---

**`updateLink(id, params)`**
```typescript
updateLink(456, {
  title: "Updated title",
  description: "Updated description"
});
// Actualiza solo campos proporcionados
```

---

**`deleteLink(id)`**
```typescript
deleteLink(456);
// Elimina el link (CASCADE en likes, favorites)
```

---

**`incrementViews(id)`**
```typescript
incrementViews(456);
// Incrementa el contador de views
// Usa SQL: views = views + 1
```

---

#### Category Queries (4 funciones)

**`createCategory(params)`**
```typescript
const categoryId = createCategory({
  user_id: 123,
  name: "Tech",
  color: "#6366f1"
});
// Returns: number (categoryId)
```

---

**`getCategoriesByUser(userId)`**
```typescript
const categories = getCategoriesByUser(123);
// Returns: Category[] con cuenta de links
```

**Incluye**: `links_count` (cuántos links tiene cada categoría)

---

**`updateCategory(id, params)`**
```typescript
updateCategory(5, {
  name: "Technology",
  color: "#3b82f6"
});
```

---

**`deleteCategory(id)`**
```typescript
deleteCategory(5, { reassign_to: null });
// Si reassign_to es null, links quedan con category_id = NULL
// Si reassign_to es un ID, links se reasignan a esa categoría
```

---

#### Interaction Queries (4 funciones)

**`toggleLike(userId, linkId)`**
```typescript
const result = toggleLike(123, 456);
// Returns: { action: "added" | "removed", like: Like }
```

**Lógica**:
- Si ya existe like → lo elimina
- Si no existe like → lo crea

---

**`toggleFavorite(userId, linkId)`**
```typescript
const result = toggleFavorite(123, 456);
// Returns: { action: "added" | "removed", favorite: Favorite }
```

**Misma lógica** que `toggleLike`.

---

**`checkIfLiked(userId, linkId)`**
```typescript
const isLiked = checkIfLiked(123, 456);
// Returns: boolean
```

---

**`checkIfFavorited(userId, linkId)`**
```typescript
const isFavorited = checkIfFavorited(123, 456);
// Returns: boolean
```

---

#### FTS5 Search Query (1 función)

**`searchLinks(query, filters?)`**
```typescript
const links = searchLinks("machine learning tutorials", {
  category_id: 5,    // Opcional
  limit: 20,
  offset: 0
});
// Returns: Link[] (resultados de FTS5 search)
```

**FTS5 Features**:
- Búsqueda booleana: `"react OR vue"`, `"python AND tutorial"`
- Phrase search: `'"machine learning"'`
- Filtro por categoría: `category_id` opcional
- Ranking por relevancia (FTS5 lo hace automáticamente)

**SQL Interno**:
```sql
SELECT DISTINCT links.* FROM links
WHERE id IN (
  SELECT rowid FROM links_fts 
  WHERE links_fts MATCH ?
)
ORDER BY links.created_at DESC
LIMIT ? OFFSET ?
```

---

## Patrones y Best Practices

### 1. Singleton Pattern (Connection)

**Problema**: Múltiples conexiones a SQLite causan "database is locked".

**Solución**: Una sola conexión compartida con la ruta de DB corregida:

```typescript
// backend/db/connection.ts
let databaseInstance: Database | null = null;

export function getDatabase(): Database {
  if (databaseInstance !== null) {
    return databaseInstance; // Reutilizar instancia
  }
  
  // Ahora la DB vive dentro de la carpeta db/
  const db = new Database("./db/database.sqlite");
  db.run("PRAGMA foreign_keys = ON;"); // CRÍTICO
  databaseInstance = db;
  return db;
}
```

**Beneficios**:
- ✅ Evita "database is locked"
- ✅ Mejora performance (no overhead de abrir/cerrar)
- ✅ FK constraints habilitados automáticamente

---

### 2. Prepared Statements Cache

**Problema**: Compilar SQL cada vez es lento.

**Solución**: Cachear statements a nivel módulo:

```typescript
// ❌ MAL - Compila SQL cada vez
function getUser(id: number) {
  return db.query("SELECT * FROM users WHERE id = ?").get(id);
}

// ✅ BIEN - Compila una vez, reutiliza
const getUserStmt = db.prepare("SELECT * FROM users WHERE id = ?");

function getUser(id: number) {
  return getUserStmt.get(id);
}
```

**Implementación en `queries.ts`**:
```typescript
// Lazy initialization pattern
function createUserStmt() {
  return db.prepare(`
    INSERT INTO users (username, email, password_hash, avatar_url, bio)
    VALUES (?, ?, ?, ?, ?)
  `);
}

export function createUser(params: CreateUserParams): number {
  const stmt = createUserStmt(); // Crea statement cacheado
  const result = stmt.run(
    params.username,
    params.email,
    params.password_hash,
    params.avatar_url || null,
    params.bio || null
  );
  return Number(result.lastInsertRowid);
}
```

---

### 3. Forward Compatibility - `db.run` vs `db.exec`

**Problema**: `db.exec` es un alias heredado que Bun podría remover en futuras versiones para reducir bloat.

**Solución**: Siempre usar `db.run` para comandos que no devuelven datos (INSERT, UPDATE, DELETE, PRAGMA):

```typescript
// ❌ Usar alias (podría desaparecer en Bun 2.0)
db.exec("INSERT INTO users ...");

// ✅ Usar método principal (future-proof y explícito)
db.run("INSERT INTO users ...");
```

**Razón**: `exec = this.run` es solo un alias. Los aliases son los primeros en eliminarse durante refactors de librerías. Usar `run` es más cercano al motor nativo.

---

### 4. Accediendo a `lastInsertRowid` (Fix Crítico)

**Problema**: En `bun:sqlite`, la propiedad `db.lastInsertRowid` **NO EXISTE** globalmente en la instancia. Intentar acceder a ella devolverá `undefined` o causará errores de tipo.

**Solución**: Capturar SIEMPRE el objeto de retorno de `db.run()`:

```typescript
// ❌ INCORRECTO - Error garantizado
db.run("INSERT INTO users ...");
const id = db.lastInsertRowid; // Property doesn't exist

// ✅ CORRECTO - Patrón obligatorio en URLoft
const result = db.run("INSERT INTO users ...");
const id = result.lastInsertRowid; // result = { changes, lastInsertRowid }
```

**Importante**: Este patrón es obligatorio para todas las inserciones que requieran recuperar el ID generado para evitar race conditions y asegurar compatibilidad.

---

### 5. Foreign Keys - ON DELETE Behavior

**Tipos de CASCADE**:

| Constraint | Comportamiento | Uso |
|------------|----------------|-----|
| `ON DELETE CASCADE` | Elimina registros hijos | Users → Links, Likes, Favorites |
| `ON DELETE SET NULL` | Pone NULL en FK | Links → Categories |
| `ON DELETE RESTRICT` | No permite borrar si hay hijos | Ranks → Users |

**Ejemplo**:
```sql
-- Si se elimina un usuario, se eliminan sus links
CREATE TABLE links (
  ...
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Si se elimina una categoría, links.category_id queda NULL
CREATE TABLE links (
  ...
  FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE SET NULL
);
```

---

### 6. WAL Mode (Write-Ahead Logging)

**Problema**: SQLite default mode puede bloquear lecturas durante writes.

**Solución**: Habilitar WAL mode:

```typescript
db.run("PRAGMA journal_mode=WAL;");
```

**Beneficios**:
- ✅ Lecturas no bloquean escrituras
- ✅ Escrituras no bloquean lecturas
- ✅ Mejor concurrencia
- ✅ Better crash recovery

**Archivos creados**:
- `database.sqlite` - DB principal
- `database.sqlite-wal` - Write-Ahead Log
- `database.sqlite-shm` - Shared memory index

---

## Testing

### Suite de Tests: 21 tests (100% passing)

#### Connection Tests (7 tests)
```bash
$ bun test backend/db/__tests__/connection.test.ts
✅ 7 pass
```

**Qué prueban**:
1. Singleton pattern (misma instancia)
2. Module-level caching
3. Foreign keys PRAGMA habilitado
4. PRAGMA queries funcionan
5. Manejo de errores
6. APIs nativas de Bun (db.query, db.run, db.prepare, db.close)

---

#### Schema Tests (14 tests)
```bash
$ bun test backend/db/__tests__/schema.test.ts
✅ 14 pass
```

**Qué prueban**:
1. ✅ Todas las tablas se crean
2. ✅ Columnas correctas en `users`
3. ✅ Columnas correctas en `links`
4. ✅ Foreign keys constraint habilitado
5. ✅ Rejects insert con FK inválida
6. ✅ CASCADE delete funciona (user → links)
7. ✅ SET NULL funciona (category → links.category_id)
8. ✅ FTS5 virtual table creada
9. ✅ FTS5 trigger sync on INSERT
10. ✅ FTS5 trigger sync on UPDATE
11. ✅ FTS5 trigger sync on DELETE
12. ✅ WAL mode PRAGMA aceptado
13. ✅ Ranks iniciales insertados
14. ✅ Total tables >= 11 (incluye system tables)

---

### Ejecutar Todos los Tests

```bash
# Desde el directorio backend
$ bun test

# Output esperado:
✅ 21 pass (0 fail)
├── 7 connection tests
└── 14 schema tests
```

---

## Troubleshooting

### Error: "database is locked"

**Causa**: Múltiples conexiones escribiendo simultáneamente.

**Solución**: Asegurarse de usar el Singleton pattern:

```typescript
// ❌ MAL - Crear múltiples conexiones
const db1 = new Database("mydb.sqlite");
const db2 = new Database("mydb.sqlite");

// ✅ BIEN - Una sola conexión
import { getDatabase } from "./connection";
const db1 = getDatabase();
const db2 = getDatabase(); // Mismo objeto
```

---

### Error: "NOT NULL constraint failed"

**Causa**: Insertando registros sin todas las columnas requeridas.

**Solución**: Proporcionar todos los campos NOT NULL:

```typescript
// ❌ MAL - Falta password_hash
db.run("INSERT INTO users (username, email) VALUES (?, ?)", ["john", "john@example.com"]);

// ✅ BIEN - Todos los campos requeridos
db.run("INSERT INTO users (username, email, password_hash) VALUES (?, ?, ?)", 
  ["john", "john@example.com", "hashedpassword"]);
```

---

### Error: "Property 'lastInsertRowid' does not exist"

**Causa**: Intentando acceder a `db.lastInsertRowid` directamente.

**Solución**: Capturar el retorno de `db.run()`:

```typescript
// ❌ MAL
db.run("INSERT INTO users ...");
const id = db.lastInsertRowid;

// ✅ BIEN
const result = db.run("INSERT INTO users ...");
const id = result.lastInsertRowid;
```

---

### FTS5 Search No Funciona

**Causa**: Olvidaste crear los triggers.

**Solución**: Ejecutar el schema completo que incluye los triggers:

```typescript
// schema.sql incluye los 3 triggers
db.run(schemaSql); // Esto ejecuta CREATE TRIGGER también
```

**Verificar**:
```sql
SELECT name FROM sqlite_master WHERE type='trigger' AND name LIKE 'links_%';
-- Debe retornar: links_ai, links_ad, links_au
```

---

### Tests Fallan con "TypeError: Cannot read property... of undefined"

**Causa**: Tests corriendo sin la base de datos inicializada.

**Solución**: Asegurarse que cada test cree su propia DB:

```typescript
test("mi test", () => {
  const db = createTestDatabase(); // ✅ DB limpia para cada test
  // ... hacer queries ...
  db.close(); // ✅ Limpiar después
});
```

---

## Performance Tips

### 1. Usar Prepared Statements

**Sin prepared statements** (lento):
```typescript
for (let i = 0; i < 1000; i++) {
  db.query(`INSERT INTO links (url) VALUES ('${url}')`).run();
}
```

**Con prepared statements** (100x más rápido):
```typescript
const stmt = db.prepare("INSERT INTO links (url) VALUES (?)");
for (let i = 0; i < 1000; i++) {
  stmt.run(url);
}
```

---

### 2. Usar Transacciones para Bulk Inserts

**Sin transacciones** (muy lento):
```typescript
links.forEach(link => {
  db.run("INSERT INTO links ..."); // 1000 writes
});
```

**Con transacciones** (100x más rápido):
```typescript
const insertLink = db.prepare("INSERT INTO links ...");
const insertMany = db.transaction((links) => {
  for (const link of links) insertLink.run(link);
});

insertMany(links); // Todo en una transacción
```

---

### 3. Habilitar WAL Mode

**Sin WAL** (lecturas bloquean durante writes):
```typescript
// Escritura bloquea todas las lecturas
db.run("INSERT INTO links ...");
// Durante este write, las lecturas esperan
```

**Con WAL** (lecturas y escrituras concurrentes):
```typescript
db.run("PRAGMA journal_mode=WAL;");
db.run("INSERT INTO links ...");
// Las lecturas continúan mientras se escribe
```

---

## Seguridad

### 1. SQL Injection Prevention

**Peligro**: Concatenar strings en SQL (vulnerable):

```typescript
// ❌ PELIGROSO - SQL Injection
db.query(`SELECT * FROM users WHERE email = '${email}'`).get();
// Si email = "'; DROP TABLE users; --"
// SQL: SELECT * FROM users WHERE email = ''; DROP TABLE users; --'
```

**Solución**: Usar prepared statements:

```typescript
// ✅ SEGURO - Parámetros escapados
const stmt = db.query("SELECT * FROM users WHERE email = ?");
stmt.get(email); // Safe automáticamente
```

---

### 2. Password Hashing

**Usar Bun.password** (API nativa):

```typescript
import { Bun } from "bun";

// Hash password
const password = "super-secret";
const hash = await Bun.password.hash(password, {
  algorithm: "bcrypt",
  cost: 12
});

// Verify password
const isValid = await Bun.password.verify(password, hash);
console.log(isValid); // true
```

**Nunca** almacenar passwords en texto plano.

---

### 3. API Keys Hashing

**Almacenar** solo el hash:

```typescript
import { Bun } from "bun";

const apiKey = "urlk_abc123..."; // Key real
const hash = await Bun.password.hash(apiKey);

// Guardar SOLO el hash en DB
db.run("INSERT INTO api_keys (user_id, name, key_hash, key_prefix) VALUES (?, ?, ?, ?)", 
  [userId, "Claude Desktop", hash, apiKey.slice(0, 8)]);

// Para verificar: leer hash, hacer verify
const stored = db.query("SELECT key_hash FROM api_keys WHERE key_prefix = ?").get(apiKey.slice(0, 8));
const isValid = await Bun.password.verify(apiKey, stored.key_hash);
```

---

## Archivos del Sistema

| Archivo | Líneas | Propósito |
|---------|--------|-----------|
| `backend/db/schema.sql` | 225 | Definición completa del esquema |
| `backend/db/connection.ts` | 122 | Singleton wrapper + FK + Ubicación DB |
| `backend/db/verify.ts` | 91 | Smoke Test de conexión y salud |
| `backend/db/migrations.ts` | 119 | Sistema de inicialización |
| `backend/db/setup.ts` | 68 | Entry point CLI |
| `backend/db/queries.ts` | ~1,000 | CRUD operations con prepared statements |
| `backend/db/__tests__/connection.test.ts` | 103 | Tests de conexión |
| `backend/db/__tests__/schema.test.ts` | 381 | Tests de schema |
| `backend/db/database.sqlite` | - | Base de datos (generada) |
| `backend/db/database.sqlite-wal` | - | Write-Ahead Log |
| `backend/db/database.sqlite-shm` | - | Shared memory index |

**Total**: ~2,600 líneas de código TypeScript + tests

---

## Próximos Pasos

Phase 2 está **COMPLETADA**. El siguiente paso es:

### Phase 3: Authentication Layer
- Refactor de `backend/index.ts` con entry point limpio y smoke test
- Better Auth setup
- JWT con fingerprint
- Email verification (Resend)
- Password recovery
- Session management

---

**Documentación mantenida por**: Equipo URLoft  
**Última actualización**: 2026-03-24  
**Versión**: 1.0.0
