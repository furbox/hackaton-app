# 🔗 URLoft

**Tu biblioteca personal de links. Guarda, organiza y comparte todos tus enlaces en un solo lugar.**

🌐 [Sitio Web](https://urloft.site) · ✨ [Features](#-features) · 📦 [Instalación](#-instalación) · 🚀 [Uso](#-uso) · 🤝 [Contribuir](#-contribuir) · 📖 [Documentación Técnica](AGENTS.md)

---

## 🧠 ¿Qué problema resuelve?

Todos tenemos decenas (o cientos) de links útiles repartidos entre notas, favoritos del navegador, chats y correos. **URLoft** centraliza todo en un solo lugar con búsqueda rápida, categorías personalizadas y la posibilidad de compartir o mantener privados tus enlaces. Además, genera short links para que compartas cualquier URL de forma limpia.

---

## 🏅 Highlights del Proyecto

> **Lo que hace especial a URLoft** — features clave para los jueces.

| Feature | Descripción |
|---------|-------------|
| 🔐 **Autenticación Segura** | Sesiones seguras con verificación de email y recuperación de contraseña |
| 🔗 **URL Shortener** | Cada link guardado genera un short link único listo para compartir |
| 🔒 **Público / Privado** | Control granular de visibilidad por enlace |
| 🏆 **Gamificación (Rangos)** | Sistema de rangos que premia la actividad del usuario |
| ❤️ **Social** | Likes, views y perfiles públicos para descubrir links de otros usuarios |
| 🏷️ **Categorías Custom** | Cada usuario crea y gestiona sus propias categorías con colores |
| 🔑 **API Keys** | Los usuarios generan sus propias API keys para conectar servicios externos |
| 🤖 **Integración con IA** | MCP Server y Web Skill para conectar cualquier IA a tus links |
| 🌐 **Extensión de Chrome** | Guarda la página actual con un click o consulta tus links sin salir del navegador |
| 📸 **Link Preview** | Al pegar una URL se extraen automáticamente el título, descripción e imagen OG |
| 📊 **Dashboard Completo** | Panel privado para gestionar perfil, links, categorías, API keys y favoritos |
| 🔍 **Búsqueda Full-Text** | Búsqueda ultrarrápida que encuentra cualquier link al instante |
| 🛡️ **Seguridad Avanzada** | Rate limiting y protección contra abuso |
| 📱 **PWA** | Instala URLoft como app nativa en tu celular desde el navegador |
| 📥 **Importar Bookmarks** | Sube el archivo HTML de Chrome/Firefox y tus bookmarks se importan automáticamente |

---

## ✨ Features

### 🔗 Gestión de Links

- **Guardar enlaces** con título, descripción y URL original
- **📸 Link Preview automático** — al pegar una URL se extraen automáticamente el título, descripción e imagen OG del sitio
- **🩺 Link Health Checker** — verifica periódicamente el estado de tus enlaces para detectar "Link Rot"
- **🏛️ Wayback Machine** — guarda una copia permanente de la URL al momento de agregarla
- **📖 Reader Mode** — extrae el texto limpio de los artículos para lectura sin distracciones
- **🔍 Búsqueda full-text** — búsqueda ultrarrápida que encuentra cualquier link al instante
- **Organización por categorías** propias y personalizadas
- **Favoritos** — marca los links que más usas para acceso inmediato

### 🔒 Privacidad y Visibilidad

- **Links públicos o privados** — tú decides quién ve cada enlace
- **Perfil público** — comparte tu colección con el mundo o mantenla solo para ti

### 📧 Sistema de Emails

- **Verificación de email** — al registrarte se envía un correo de confirmación
- **Recuperación de contraseña** — ¿olvidaste tu password? Recibe un link seguro para restablecerla
- **Emails transaccionales** — notificaciones limpias y profesionales

### 🔥 Interacción Social

- **Sistema de likes** — dale like a los links que te gusten de otros usuarios
- **Contador de views** — visualiza cuántas veces se ha visto cada link
- **Guardados en favoritos** — visualiza cuántas veces otros usuarios guardaron un link
- **Perfiles de usuario** — cada usuario tiene su perfil con sus links publicados

### 📊 Dashboard Privado

Panel de control completo para gestionar tu cuenta y todo tu contenido:

**Perfil:**
- Editar nombre de usuario, avatar y bio
- Cambiar contraseña de forma segura
- Ver tu rango actual y progreso

**Mis Links:**
- Listar todos tus links (públicos y privados)
- Crear, editar y eliminar links
- Ver estadísticas por link (views, likes, favoritos)
- Filtrar y buscar entre tus links

**Mis Categorías:**
- Crear categorías con nombre y color personalizado
- Editar y eliminar categorías
- Reasignar links al eliminar categorías

**Mis API Keys:**
- Crear nuevas API keys con permisos personalizados
- Listar y revocar API keys
- Ver última fecha de uso

**Mis Favoritos:**
- Acceso rápido a los links que guardaste de otros usuarios

**Importar Bookmarks:**
- Sube el archivo HTML de Chrome o Firefox
- Vista previa antes de importar
- Las carpetas se convierten en categorías automáticamente

### 🌍 Páginas Públicas

**Página Principal (`/`):**
- Hero section con call-to-action
- Links destacados con más likes y views
- Usuarios top por rango
- Estadísticas globales de la plataforma

**Explorar Links (`/explore`):**
- Listado de links públicos con paginación
- Búsqueda por nombre en tiempo real
- Filtros avanzados: likes, views, favoritos, categoría, fecha
- Tarjetas con imagen OG, título, creador, rangos y contadores

**Perfil Público de Usuario (`/u/:username`):**
- Info del usuario (avatar, nombre, bio, rango)
- Estadísticas del perfil
- Links públicos del usuario con todos los filtros

### 🏆 Sistema de Rangos

Sube de rango mientras más links publiques:

| Rango | Links publicados |
|-------|-----------------|
| 🌱 Newbie | 0 – 10 |
| ⚡ Active | 11 – 50 |
| 🔥 Power User | 51 – 150 |
| 💎 Legend | 151 – 500 |
| 👑 GOD Mode | 500+ |

### 🔗 URL Shortener

- **Short links integrados** — genera URLs cortas automáticamente para cada enlace guardado
- Formato: `urloft.site/s/{code}`
- Trazabilidad de clicks y estadísticas de views

### 🔑 API Keys

- **Generación de API keys** — crea keys desde tu panel para autenticar servicios externos
- **Permisos granulares** — cada key puede tener permisos de solo lectura o lectura/escritura
- **Gestión completa** — lista, crea y revoca tus API keys en cualquier momento
- **Rate limiting** — protección contra abuso con límites por key

### 🤖 MCP Server (Model Context Protocol)

Servidor MCP integrado para que cualquier IA compatible (Claude, GPT, etc.) pueda interactuar con tus links:

- **Lectura global y privada** — la IA puede buscar y leer todos tus links
- **CRUD seguro** — la IA solo puede modificar tus propios links
- **Autenticación vía API key** — conexión segura limitada a tu contexto

```json
// Ejemplo de configuración MCP en Claude Desktop
{
  "mcpServers": {
    "urloft": {
      "url": "https://urloft.site/mcp",
      "headers": {
        "Authorization": "Bearer tu-api-key"
      }
    }
  }
}
```

### 🧠 Web Skill

Skill diseñado para que las IAs busquen y extraigan información de tus links:

- **Buscar URLs** — encontrar links por palabra clave, categoría o contenido
- **Extraer información** — obtener metadata, descripciones y datos específicos
- **Filtros avanzados** — búsqueda por categoría, visibilidad, fecha o popularidad

### 🌐 Extensión de Chrome

Extensión oficial para tener URLoft siempre a la mano mientras navegas:

- **Guardar la página actual** — un click y la URL se guarda con título y descripción auto-detectados
- **Elegir categoría y visibilidad** — asigna categoría y privacidad desde el popup
- **Consultar tus links** — busca y navega entre tus links sin salir de la pestaña actual
- **Acceso rápido a favoritos** — tus links favoritos siempre visibles
- **Indicador de link duplicado** — si la URL ya está guardada, la extensión te lo indica

### 🛡️ Seguridad

- **Rate limiting por IP** — protección contra DDoS y scraping
- **Rate limiting por API key** — cada key tiene su propio límite
- **Headers informativos** — cada respuesta incluye info sobre tu límite
- **Sesiones seguras** — validación en cada request con revocación inmediata

### 📱 PWA (Progressive Web App)

Instala URLoft como app nativa directamente desde el navegador:

- **Instalable** — agrega URLoft a tu pantalla de inicio sin pasar por una tienda de apps
- **Offline ready** — accede a tus links aunque no tengas conexión
- **Experiencia nativa** — sin barra de navegador, splash screen personalizado

### 📥 Importar Bookmarks

Migra todos tus favoritos del navegador a URLoft en segundos:

- **Soporta Chrome y Firefox** — sube el archivo `.html` que exportas desde tu navegador
- **Mapeo automático** — las carpetas se convierten en categorías automáticamente
- **Detección de duplicados** — si un link ya existe, no se crea otra vez
- **Resumen de importación** — cuántos links se importaron y cuántos duplicados se omitieron

---

## 🛠 Tech Stack

| Capa | Tecnología |
|------|-----------|
| **Runtime** | [Bun](https://bun.sh) — JavaScript runtime ultra rápido |
| **Frontend** | [Svelte](https://svelte.dev) — framework reactivo y ligero |
| **Base de Datos** | [SQLite](https://sqlite.org) — embebida, cero config |
| **Email** | [Resend](https://resend.com) — API moderna para emails |
| **Auth** | [Better Auth](https://better-auth.com) — Framework-agnostic auth |
| **IA Integrations** | MCP Server + Web Skill |
| **Extensión** | Chrome Extension (Manifest V3) |
| **PWA** | Service Worker + Web App Manifest |
| **Lenguaje** | TypeScript |

**¿Por qué este stack?**
- **Bun**: Todo en uno (runtime, bundler, test runner, package manager) — máximo rendimiento
- **Svelte**: Compilador que genera vanilla JS optimizado — bundles ultrapequeños
- **SQLite**: Cero setup, un solo archivo, queries rápidas — perfecto para hackathons
- **Better Auth**: Sesiones stateful con SQLite nativa — seguridad por diseño
- **Resend**: Emails con una sola llamada a la API — sin configurar SMTP

> 📖 **Para más detalles técnicos y arquitectura, ver [AGENTS.md](AGENTS.md)**

---

## 📦 Instalación

### Prerrequisitos

- [Bun](https://bun.sh) v1.0+

### Setup

```bash
# Clonar el repositorio
git clone https://github.com/tu-usuario/urloft.git
cd urloft

# Instalar dependencias
bun install

# Configurar variables de entorno
cp .env.example .env

# Inicializar la base de datos
bun run db:setup

# Iniciar en modo desarrollo
bun run dev

# (Opcional) Compilar extensión de Chrome
bun run ext:build
```

### Variables de Entorno

Crea un archivo `.env` con las siguientes variables:

```env
# Server
PORT=3000
HOST=localhost

# Database
DATABASE_URL=./database.sqlite

# Auth
JWT_SECRET=tu-secreto-super-seguro
JWT_EXPIRY=7d

# Email (Resend)
RESEND_API_KEY=re_xxxxxxxxxx
EMAIL_FROM=noreply@urloft.site

# Short Links
BASE_URL=https://urloft.site
SHORT_PREFIX=s

# API Keys
API_KEY_PREFIX=urlk
API_RATE_LIMIT=100
```

> 📖 **Documentación técnica completa en [AGENTS.md](AGENTS.md)**

---

## 🚀 Uso

### Crear una cuenta
1. Entra a [urloft.site](https://urloft.site)
2. Regístrate con tu email
3. Recibes un correo de verificación
4. Confirma tu email haciendo click en el link
5. Personaliza tu perfil

### Guardar un link
1. Click en **"Nuevo Link"**
2. Pega la URL — el título, descripción e imagen se extraen automáticamente
3. Ajusta los datos si quieres y elige categoría
4. Elige si es **público** o **privado**
5. Se genera automáticamente un short link

### Instalar como app (PWA)
- **Móvil**: entra a [urloft.site](https://urloft.site) desde Chrome/Safari → "Agregar a pantalla de inicio"
- **Desktop**: Chrome mostrará un botón de instalación en la barra de dirección

### Explorar links públicos
1. Ve a [urloft.site/explore](https://urloft.site/explore)
2. Busca por nombre o usa los filtros (más likes, más vistas, más guardados, por categoría)
3. Dale **like** o guárdalo como **favorito**
4. Click en el creador → navega a su perfil público

### Dashboard
1. Entra a [urloft.site/dashboard](https://urloft.site/dashboard)
2. **Perfil** → edita tu nombre, avatar y bio
3. **Mis Links** → crea, edita, elimina y ve estadísticas
4. **Mis Categorías** → crea y gestiona categorías
5. **Mis API Keys** → genera keys para MCP, Skill y extensión
6. **Mis Favoritos** → accede a los links que guardaste
7. **Importar Bookmarks** → sube el HTML de Chrome/Firefox

### Extensión de Chrome
1. Instala la extensión desde `extension/` (modo desarrollador)
2. Ingresa tu **API key** (la generas desde tu panel)
3. Navega a cualquier sitio y haz click en **"Guardar"**

---

## 🤝 Contribuir

¡Las contribuciones son bienvenidas!

1. Fork del proyecto
2. Crea tu feature branch (`git checkout -b feature/nueva-feature`)
3. Commit tus cambios (`git commit -m 'feat: agregar nueva feature'`)
4. Push al branch (`git push origin feature/nueva-feature`)
5. Abre un Pull Request

---

## 📄 Licencia

Este proyecto está bajo la Licencia MIT. Ver el archivo [LICENSE](LICENSE) para más detalles.

---

## 👥 Equipo

| Nombre | Rol | GitHub |
|--------|-----|--------|
| TBD | Full Stack Dev | [@tu-usuario](https://github.com/tu-usuario) |

---

## 📖 Documentación

- **[AGENTS.md](AGENTS.md)** — Documentación técnica completa (arquitectura, API, modelo de datos, testing, deployment)

---

> Hecho con ❤️ para el Hackathon 2026
