# Documentación Técnica - URLoft

> Documentación técnica detallada del proyecto URLoft.

---

## 📋 Tabla de Contenidos

- [Tech Stack](#tech-stack)
- [Arquitectura](#arquitectura)
- [Estructura del Proyecto](#estructura-del-proyecto)
- [Decisiones Técnicas](#decisiones-técnicas)
- [Features Implementados](#features-implementados)
- [Guías de Desarrollo](#guías-de-desarrollo)

---

## Tech Stack

> **¿Por qué este stack?** Este stack fue diseñado para maximizar velocidad de desarrollo y performance durante un hackathon, sin sacrificar escalabilidad para producción.

---

### 🔵 Runtime

#### **Bun**
JavaScript runtime ultra rápido que reemplaza Node.js, npm, webpack, y otros tools.

**Por qué lo elegimos:**
- **Todo-en-uno:** Elimina la necesidad de múltiples herramientas (bundler, test runner, package manager)
- **Ecosistema zero-dependency:** Explotamos al máximo sus capacidades nativas

**Características clave usadas en URLoft:**
- **`Bun.serve`** - Servidor HTTP ultrarrápido con enrutamiento nativo (sin Express/Fastify)
- **`bun:sqlite`** - Acceso síncrono a SQLite con altísimo rendimiento
- **`Bun.password`** - Hasheo seguro de contraseñas (Argon2id/Bcrypt) nativo
- **`Bun.Worker`** - Web Workers nativos para background jobs sin bloquear el hilo principal

**Documentación:** [bun.sh](https://bun.sh)

---

### 🟢 Frontend

#### **EJS** (Embedded JavaScript Templates)
Template engine del lado del servidor para renderizar HTML dinámico.

**Por qué lo elegimos:**
- **Simple y rápido** - Sin build step complejo, templates renderizados en el servidor
- **Full-stack JavaScript** - Mismo lenguaje en frontend y backend
- **Integración nativa con Bun** - Renderizado ultrarrápido sin overhead

**Características clave usadas en URLoft:**
- **Server-side rendering** - HTML completo enviado al cliente (SEO friendly)
- **`<%= %>`** - Output escapado (seguro contra XSS)
- **`<%- %>`** - Include partials (nav, footer, flash messages)
- **Tags de template** - `<% %>` para lógica JavaScript en el servidor

**Documentación:** [ejs.co](https://ejs.co)

---

#### **Alpine.js**
Framework ligero para interactividad cliente similar a Vue/JQuery pero moderno.

**Por qué lo elegimos:**
- **Zero build step** - Se carga vía CDN, sin compilación
- **Perfecto para SPA ligera** - Interactividad sin complejidad de React/Vue
- **Directiva `x-data`** - Estado reactivo simple en componentes

**Características clave usadas en URLoft:**
- **`x-data`** - Estado reactivo en elementos HTML (mobile menu, modals)
- **`x-show` / `x-hide`** - Mostrar/ocultar elementos condicionalmente
- **`x-for`** - Iterar arrays (video cards, link lists)
- **`x-text` / `:src`** - Binding de texto y atributos
- **`@click`** - Event handlers (abrir modals, cerrar menús)
- **`@keydown.escape`** - Cerrar modals con tecla ESC
- **Transiciones `x-transition`** - Animaciones suaves

**Documentación:** [alpinejs.dev](https://alpinejs.dev)

---

#### **HTMX**
Biblioteca para actualizar el DOM desde respuestas del servidor.

**Por qué lo elegimos:**
- **AJAX simplificado** - Atributos HTML en lugar de JavaScript
- **Incremental updates** - Actualizar partes de la página sin recargar
- **Perfecto para forms** - Submit forms sin page reload

**Características clave usadas en URLoft:**
- **hx-post** - Submit forms via AJAX (like, favorite actions)
- **hx-swap** - Reemplazar partes del DOM con respuesta HTML
- **Like/Favorite buttons** - Actualizar contadores sin recargar página

**Documentación:** [htmx.org](https://htmx.org)

---

#### **Tailwind CSS v4**
Framework utility-first para estilos con cero archivos CSS que mantener.

**Por qué lo elegimos:**
- **Plugin oficial para Vite** - Integración nativa y ultrarrápida
- **Utility-first** - Estilos directamente en el HTML/EJS
- **Zero-config** - Detecta automáticamente las clases usadas

**Características clave usadas en URLoft:**
- **Dark mode nativo** - Prefijo `dark:` para variantes oscuras
- **Responsive automático** - Clases como `md:flex lg:grid`
- **Bundle optimizado** - Solo incluye el CSS que realmente usas

**Documentación:** [tailwindcss.com](https://tailwindcss.com)

---

### 🟣 Backend

#### **SQLite** + **FTS5**
Base de datos embebida con búsqueda full-text integrada.

**Por qué la elegimos:**
- **Cero setup:** Un solo archivo, sin servidor aparte
- **Perfecta para hackathons:** Queries rápidas, configuración instantánea
- **FTS5 integrado:** Búsqueda full-text sin servicios externos

**Características clave usadas en URLoft:**
- **FTS5 (Full-Text Search)** - Búsqueda en títulos, descripciones y contenido
- **WAL Mode** - Lecturas/escrituras concurrentes con `PRAGMA journal_mode=WAL`
- **Triggers automáticos** - Sincronización entre tabla `links` y `links_fts`

**Documentación:** [sqlite.org/fts5.html](https://www.sqlite.org/fts5.html)

---

#### **Better Auth**
Framework de autenticación agnóstico con soporte nativo para SQLite.

**Por qué lo elegimos:**
- **Soporte SQLite nativo** - Integración directa con `bun:sqlite` (sin adapter)
- **Sesiones stateful** - Validadas contra DB en cada request (revocación inmediata)
- **Framework-agnostic** - Sin dependencias de framework específico

**Características clave usadas en URLoft:**
- **Email verification** - Tokens de verificación con Resend
- **Password reset** - Recuperación de contraseña segura
- **Session management** - Múltiples sesiones por usuario con fingerprint
- **Audit log** - Registro de eventos de seguridad

**Documentación:** [better-auth.com](https://better-auth.com)

---

#### **Resend**
API moderna para emails transaccionales.

**Por qué la elegimos:**
- **Una llamada API** - Sin configurar SMTP ni servidores complejos
- **Templates integrados** - HTML emails renderizados en el servidor
- **Delivery confiable** - Infraestructura de email enterprise

**Características clave usadas en URLoft:**
- **Verification emails** - Confirmación de cuenta al registrarse
- **Password reset** - Emails de recuperación de contraseña
- **Transactional templates** - EJS templates renderizados en el backend

**Documentación:** [resend.com](https://resend.com)

---

### 📖 Reader Mode

> **Procesamiento de contenido en segundo plano** - Extracción de texto legible para búsqueda full-text y modo lectura

#### **@mozilla/readability** (v0.6.0)
Biblioteca de Mozilla para extraer contenido legible de páginas web.

**Por qué la elegimos:**
- **Algoritmo probado** - Misma lógica que Firefox Reader View
- **Limpieza automática** - Elimina ads, navegación y clutter
- **Extracción precisa** - Identifica el contenido principal del artículo

**Características clave usadas en URLoft:**
- **Extracción de artículo** - Parsea HTML y extrae título + contenido principal
- **Remoción de boilerplate** - Elimina scripts, estilos, comentarios
- **Texto limpio** - Genera `textContent` optimizado para FTS5

**Documentación:** [github.com/mozilla/readability](https://github.com/mozilla/readability)

---

#### **linkedom** (v0.18.12)
Implementación ligera de DOM para Node.js/Bun.

**Por qué la elegimos:**
- **Zero dependencies** - DOM parser completo sin pesadas dependencias
- **Compatible con Bun** - Funciona nativamente en el runtime
- **API estándar** - Interfaz DOM/HTML estándar del W3C

**Características clave usadas en URLoft:**
- **`parseHTML()`** - Crea un DOM desde strings de HTML
- **Integration con Readability** - Provee el objeto `document` que necesita Mozilla Readability
- **Performance** - Parsing ultrarrápido en background workers

**Documentación:** [github.com/WebReflection/linkedom](https://github.com/WebReflection/linkedom)

---

#### **Flujo de Reader Mode**

```typescript
// 1. Fetch HTML del link original
const html = await fetch(link.url).then(r => r.text());

// 2. Parsear HTML con linkedom
const { document } = parseHTML(html);

// 3. Extraer contenido legible con Readability
const article = new Readability(document).parse();

// 4. Guardar texto extraído para FTS5
const contentText = article.textContent.trim();
```

**Procesamiento en background:**
- **Eventual Consistency** - La creación del link es instantánea, Reader Mode corre en background
- **Bun Workers** - No bloquea el servidor web ni la UX del usuario
- **Retry con exponential backoff** - Reintenta en caso de timeout o errores de red
- **Configurable** - Timeouts y max attempts vía variables de entorno

**Usos en URLoft:**
- **Full-Text Search (FTS5)** - El contenido extraído se indexa en `links_fts`
- **Búsqueda semántica** - Permite buscar dentro del contenido de los artículos
- **Reader Mode UI** - Vista de lectura limpia sin ads ni distracciones

---

### 🔶 Integraciones con IA

#### **MCP Server**
Model Context Protocol server para conectar IAs (Claude Desktop, etc.) con URLoft.

**Por qué lo implementamos:**
- **CRUD de links vía IA** - Claude puede crear, editar, buscar links
- **API Key auth** - Autenticación segura con permisos granulares
- **Type-safe tools** - Tools bien definidas para cada operación

**Tools expuestas:**
- `create_link` - Crear nuevo link
- `get_links` - Listar links con filtros
- `get_link` - Obtener detalle por ID
- `update_link` - Editar link existente
- `delete_link` - Eliminar link
- `search_links` - Búsqueda full-text
- `get_categories` - Listar categorías

**Documentación:** [modelcontextprotocol.io](https://modelcontextprotocol.io)

---

#### **Web Skill**
API HTTP para que IAs busquen y extraigan información de links.

**Endpoints:**
- `GET /api/skill/search` - Buscar links por query, categoría o filtros
- `GET /api/skill/extract/:id` - Extraer metadata e información de un link
- `GET /api/skill/lookup` - Buscar links por URL exacta

---

### 🟠 Extensiones & PWA

#### **Chrome Extension** (Manifest V3)
Extensión de navegador para guardar links instantáneamente.

**Características:**
- **Popup con EJS + Alpine.js** - UI reactiva y ligera
- **Background service worker** - Comunicación con la API
- **Manifest V3** - Estándar moderno de Chrome

---

#### **PWA** (Progressive Web App)
Aplicación web instalable en móviles y desktop.

**Características:**
- **Service Worker** - Caching offline y actualizaciones
- **Web App Manifest** - Iconos, nombre, modo standalone
- **Instalable** - "Add to Home Screen" en móviles

---

### 🟡 Lenguaje

#### **TypeScript**
Superset de JavaScript con tipado estático.

**Por qué lo usamos:**
- **Type-safe** - Errores en tiempo de compilación
- **Mejor DX** - Autocompletado y refactoring seguros
- **Documentación viva** - Los tipos documentan el código

---

### 🧪 Testing

#### **Bun Test** (`bun:test`)
Test runner nativo de Bun con sintaxis Jest-compatible.

**Uso en URLoft:**
- Tests de backend (API, servicios, DB)
- SQLite en memoria para tests de persistencia
- Mocking nativo con `mock()`

#### **Vitest** + **Testing Library** (Opcional)
Testing de componentes centrado en comportamiento del usuario.

**Uso en URLoft:**
- Tests de componentes de UI (Alpine.js interactivity)
- Integración con Vite

#### **Playwright** (Opcional)
E2E testing con navegador Chrome headless.

**Uso en URLoft:**
- Flujos completos (Registro → Guardar Link → Ver Dashboard)

---

## 🤖 Skills del Proyecto

Skills de IA especializados utilizados para desarrollar, mantener y optimizar URLoft.

---

### agent-browser
**Propósito:** Automatización de navegador para tareas web

**Características clave:**
- Navegación automatizada de páginas web
- Llenado de forms y autenticación
- Captura de screenshots
- Extracción de datos (scraping)
- Soporte para iframes, iframes anidados
- Persistencia de sesión (cookies, localStorage)
- Modo oscuro y emulación de dispositivos

**Cuándo se usa:**
- Testing E2E de flujos de usuario
- Verificación de páginas externas
- Automatización de tareas repetitivas
- Pruebas de integración con servicios externos
- Captura de screenshots para documentación

**Documentación:** [.agents/skills/agent-browser/SKILL.md](../.agents/skills/agent-browser/SKILL.md)

---

### better-auth-best-practices
**Propósito:** Guía para configurar Better Auth en proyectos TypeScript

**Características clave:**
- Configuración de servidor y cliente Better Auth
- Setup de adaptadores de base de datos (SQLite, Prisma, Drizzle)
- Gestión de sesiones y tokens
- Configuración de plugins y opciones avanzadas
- Manejo de variables de entorno
- Email verification y password reset

**Cuándo se usa:**
- Configurar autenticación con Better Auth
- Setup inicial de auth en nuevos proyectos
- Agregar OAuth o 2FA
- Troubleshooting de issues de autenticación
- Migrar desde otros sistemas de auth

**Documentación:** [.agents/skills/better-auth-best-practices/SKILL.md](../.agents/skills/better-auth-best-practices/SKILL.md)

---

### bun-development
**Propósito:** Desarrollo JavaScript/TypeScript moderno con el runtime Bun

**Características clave:**
- Setup de proyectos con Bun
- Gestión de paquetes ultra rápida
- APIs nativas (Bun.serve, bun:sqlite, Bun.password)
- Testing integrado con sintaxis Jest-compatible
- Bundling y compilación a ejecutables
- Migración desde Node.js

**Cuándo se usa:**
- Crear nuevos proyectos con Bun
- Migrar aplicaciones Node.js a Bun
- Optimizar performance de desarrollo
- Usar SQLite nativo con bun:sqlite
- Configurar HTTP servers con Bun.serve

**Documentación:** [.agents/skills/bun-development/SKILL.md](../.agents/skills/bun-development/SKILL.md)

---

### frontend-design
**Propósito:** Crear interfaces frontend distintivas y production-grade

**Características clave:**
- Diseño de UI/UX con estética única
- Evita estilos genéricos de IA
- Tipografía distintiva y paletas de color cohesivas
- Animaciones y micro-interacciones
- Layouts asimétricos y composición espacial
- Efectos visuales (gradients, noise, shadows)

**Cuándo se usa:**
- Crear landing pages y dashboards
- Diseñar componentes React/Vue/Svelte
- Aplicar estilos personalizados con CSS/Tailwind
- Crear interfaces memorables y únicas
- Evitar el look genérico de AI-generated UI

**Documentación:** [.agents/skills/frontend-design/SKILL.md](../.agents/skills/frontend-design/SKILL.md)

---

### mcp-builder
**Propósito:** Guía para crear servidores MCP (Model Context Protocol)

**Características clave:**
- Diseño de tools MCP bien estructuradas
- Implementación en TypeScript (SDK) y Python (FastMCP)
- Schemas de input/output con Zod/Pydantic
- Manejo de errores y paginación
- Testing con MCP Inspector
- Creación de evaluaciones para validar el servidor

**Cuándo se usa:**
- Construir servidores MCP para integrar APIs externas
- Crear tools que LLMs pueden usar
- Integrar servicios con Claude u otras IAs
- Diseñar schemas robustos para datos
- Evaluar quality del MCP server

**Documentación:** [.agents/skills/mcp-builder/SKILL.md](../.agents/skills/mcp-builder/SKILL.md)

---

### playwright-cli
**Propósito:** Automatización de navegador para testing y extracción de datos

**Características clave:**
- Navegación e interacción con páginas web
- Llenado de forms y clicking
- Screenshots y PDF generation
- Soporte multi-tab (tabs, new, close)
- Storage state (cookies, localStorage, sessionStorage)
- Network mocking y routing
- DevTools integration (console, network, tracing)

**Cuándo se usa:**
- Testing E2E de aplicaciones web
- Web scraping y extracción de datos
- Automatización de flujos de usuario
- Debugging con DevTools
- Pruebas de navegación y forms

**Documentación:** [.agents/skills/playwright-cli/SKILL.md](../.agents/skills/playwright-cli/SKILL.md)

---

### seo-audit
**Propósito:** Auditoría completa de SEO para diagnóstico de issues

**Características clave:**
- Análisis de crawlability e indexación
- Core Web Vitals (LCP, INP, CLS)
- Auditoría on-page (títulos, meta descriptions, headings)
- Análisis de contenido quality (E-E-A-T)
- Detección de problemas técnicos (canonicals, redirects, duplicates)
- Mobile-friendliness y HTTPS checks
- Schema markup detection

**Cuándo se usa:**
- Diagnosticar por qué un sitio no rankkea
- Auditoría técnica de SEO
- Revisión de meta tags y structured data
- Análisis de performance web
- Optimización para Core Web Vitals

**Documentación:** [.agents/skills/seo-audit/SKILL.md](../.agents/skills/seo-audit/SKILL.md)

---

### skill-creator
**Propósito:** Crear y mejorar skills de IA iterativamente

**Características clave:**
- Creación de skills desde cero
- Writing de SKILL.md con frontmatter YAML
- Test cases y evaluaciones cuantitativas
- Blind comparison entre versiones
- Optimización de descripciones para triggering
- Empaquetado de skills como .skill files

**Cuándo se usa:**
- Crear un nuevo skill personalizado
- Mejorar un skill existente
- Evaluar performance de skills con benchmarks
- Optimizar triggers de skills
- Distribuir skills a otros usuarios

**Documentación:** [.agents/skills/skill-creator/SKILL.md](../.agents/skills/skill-creator/SKILL.md)

---

### svelte-code-writer
**Propósito:** Herramientas CLI para documentación de Svelte 5 y análisis de código

**Características clave:**
- `@sveltejs/mcp` CLI para lookup de docs
- Listado de secciones de documentación
- Svelte autofixer para detectar issues comunes
- Soporte para Svelte 4 y 5
- Análisis de componentes .svelte y módulos .svelte.ts/.svelte.js

**Cuándo se usa:**
- Crear o editar componentes Svelte
- Buscar sintaxis de Svelte 5 (runes, snippets)
- Debuggear código Svelte
- Migrar de Svelte 4 a 5
- Validar código antes de commitear

**Documentación:** [.agents/skills/svelte-code-writer/SKILL.md](../.agents/skills/svelte-code-writer/SKILL.md)

---

### svelte5-best-practices
**Propósito:** Patrones y mejores prácticas de Svelte 5 y SvelteKit

**Características clave:**
- Runes ($state, $derived, $effect, $props, $bindable)
- Snippets ({#snippet}, {@render}) vs slots
- Event handling moderno (onclick vs on:click)
- TypeScript para props y componentes genéricos
- Migración de Svelte 4 a 5
- SvelteKit patterns (load functions, form actions, SSR)
- Performance optimization

**Cuándo se usa:**
- Escribir componentes Svelte 5
- Refactorizar código de Svelte 4
- Implementar runes y reactividad moderna
- Configurar TypeScript en componentes
- Optimizar performance de apps SvelteKit

**Documentación:** [.agents/skills/svelte5-best-practices/SKILL.md](../.agents/skills/svelte5-best-practices/SKILL.md)

---

## 🧠 Modelos de IA Utilizados

URLoft utiliza múltiples modelos de IA para desarrollo, debugging, documentación y optimización mediante integraciones MCP y skills especializados. Estos modelos potencian el desarrollo del proyecto y permiten capacidades avanzadas de búsqueda, extracción y generación de contenido.

---

### 🤖 OpenAI

#### **GPT-5.3 Codex**
**Proveedor:** OpenAI

**Propósito:** Generación de código y asistencia en desarrollo

**Características clave:**
- Especializado en programación y generación de código
- Alta precisión en sintaxis de múltiples lenguajes
- Excelente comprensión de contextos técnicos complejos
- Buen rendimiento en refactoring y optimización de código

**Casos de uso en URLoft:**
- Generación de componentes y módulos
- Debugging y resolución de errores
- Optimización de queries SQLite
- Refactorización de código legacy
- Documentación técnica automática

---

### 🌐 Google (Gemini)

#### **Gemini 3 Flash Preview**
**Proveedor:** Google DeepMind

**Propósito:** Respuestas rápidas y procesamiento ágil de contenido

**Características clave:**
- Modelo ligero y ultrarrápido
- Baja latencia en respuestas
- Buen balance entre velocidad y calidad
- Optimizado para tasks en tiempo real

**Casos de uso en URLoft:**
- Búsqueda instantánea de links
- Autocompletado y sugerencias rápidas
- Preview de metadata
- Clasificación automática de contenido
- Respuestas en tiempo real para MCP

---

#### **Gemini 3.1**
**Proveedor:** Google DeepMind

**Propósito:** Procesamiento general de contenido y razonamiento

**Características clave:**
- Buen balance entre velocidad y precisión
- Fuerte capacidad de razonamiento
- Multimodal (texto, imágenes, código)
- Excelente comprensión de contexto

**Casos de uso en URLoft:**
- Análisis de contenido de links
- Categorización automática
- Extracción de información estructurada
- Generación de descripciones
- Procesamiento de metadata OG

---

#### **Gemini 3 Pro Preview**
**Proveedor:** Google DeepMind

**Propósito:** Tareas complejas que requieren máximo razonamiento

**Características clave:**
- Máxima capacidad de razonamiento de la serie Gemini 3
- Mejor comprensión de contextos complejos
- Excelente en tasks de planificación y diseño
- Alta precisión en respuestas técnicas

**Casos de uso en URLoft:**
- Diseño de arquitectura y decisiones técnicas
- Análisis profundo de código
- Planificación de features y roadmap
- Resolución de problemas complejos
- Code reviews y refactoring estratégico

---

### 🧠 Anthropic

#### **Claude Sonnet 4.6**
**Proveedor:** Anthropic

**Propósito:** Asistencia general con enfoque en seguridad y precisión

**Características clave:**
- Excelente comprensión de contexto técnico
- Respuestas bien estructuradas y detalladas
- Fuerte enfoque en seguridad y alineación
- Buen rendimiento en tareas de documentación

**Casos de uso en URLoft:**
- Documentación técnica y tutoriales
- Explicación de código y arquitectura
- Troubleshooting y debugging
- Code reviews con feedback detallado
- Generación de contenido para README y guías

---

### 🚀 MiniMax

#### **MiniMax M2.5 Free**
**Proveedor:** MiniMax (AI startup china)

**Propósito:** Procesamiento de contenido alternativo con excelente relación costo-efectividad

**Características clave:**
- Modelo gratuito con buen rendimiento
- Rapidez en respuestas
- Buen soporte para múltiples idiomas
- Eficiente en tasks de procesamiento de texto

**Casos de uso en URLoft:**
- Procesamiento de contenido batch
- Generación de descripciones básicas
- Clasificación simple de contenido
- Tasks auxiliares de desarrollo
- Prototipado rápido de features

---

### 🔮 Zhipu AI

#### **GLM-4.7**
**Proveedor:** Zhipu AI (China)

**Propósito:** Modelo de lenguaje general con fortalezas en multilingüismo

**Características clave:**
- Fuerte soporte multilingüe (especialmente chino-inglés)
- Buen rendimiento en tasks de comprensión
- Respuestas contextuales bien fundamentadas
- Eficiente en procesamiento de texto técnico

**Casos de uso en URLoft:**
- Traducción y localización de contenido
- Comprensión de documentación en múltiples idiomas
- Análisis de contenido internacional
- Soporte para usuarios globales
- Procesamiento de metadata en diferentes idiomas

---

### 📊 Resumen de Uso por Tipo de Task

| Tipo de Task | Modelos Preferidos | Razón |
|--------------|-------------------|-------|
| **Generación de código** | GPT-5.3 Codex, Gemini 3.1 | Especialización en programación |
| **Debugging rápido** | Gemini 3 Flash, GPT-5.3 Codex | Baja latencia y precisión técnica |
| **Documentación** | Claude Sonnet 4.6, Gemini 3 Pro | Respuestas bien estructuradas |
| **Análisis profundo** | Gemini 3 Pro, Claude Sonnet 4.6 | Máximo razonamiento |
| **Batch processing** | MiniMax M2.5 Free, Gemini 3 Flash | Eficiencia y velocidad |
| **Multilingüe** | GLM-4.7, Gemini 3.1 | Soporte multi-idioma |

---

### 🔗 Integración con MCP y Skills

Todos estos modelos son accesibles a través de:

- **MCP Server:** Tools como `create_link`, `search_links`, `get_link` permiten a cualquier IA compatible con MCP interactuar con URLoft
- **Web Skill:** Endpoints HTTP (`/api/skill/*`) para búsqueda y extracción de información
- **Skills especializados:** Cada model tiene strengths específicos que son explotados por skills como `svelte5-best-practices`, `bun-development`, `mcp-builder`, etc.

**Flujo típico:**
1. Usuario interactúa con IA (Claude Desktop, ChatGPT, etc.)
2. IA selecciona el modelo más adecuado para la task
3. Modelo usa MCP Server o Web Skill para interactuar con URLoft
4. Respuesta se entrega al usuario con la información solicitada

---

## 🎯 Herramientas de Desarrollo

Herramientas y ecosistemas utilizados para potenciar el desarrollo de URLoft con habilidades avanzadas de IA.

---

### Gentleman-AI (AI Gentle Stack)

**Nombre:** Gentleman-AI
**Enlace:** https://github.com/Gentleman-Programming/gentle-ai

#### **Qué es**

Gentleman-AI es un **ecosistema configurador** para agentes de IA de codificación. No es un instalador de agentes (la mayoría son fáciles de instalar), sino que **supercarga** cualquier agente de IA que uses con el stack Gentleman: memoria persistente, workflow de Spec-Driven Development (SDD), skills curadas, servidores MCP, switcher de proveedores de IA, persona orientada a enseñanza, y asignación de modelos por fase.

**Antes vs Después:**
- ❌ **Antes:** "Instalé Claude Code / OpenCode / Cursor, pero es solo un chatbot que escribe código"
- ✅ **Después:** Tu agente ahora tiene memoria, skills, workflow, herramientas MCP y una persona que realmente te enseña

#### **Propósito**

Transformar agentes de IA de codificación básicos en **asistentes de desarrollo completos** con:

- **Memoria persistente** - Recuerda contexto entre sesiones
- **Workflow SDD** - Spec-Driven Development estructurado
- **Skills curadas** - Conjunto de habilidades de codificación especializadas
- **Servidores MCP** - Herramientas de Model Context Protocol integradas
- **Switcher de proveedores** - Cambia entre OpenAI, Google, Anthropic, etc.
- **Persona docente** - Enfoque en enseñanza con permisos seguridad primero
- **Modelos por fase** - Cada paso de SDD puede ejecutarse en un modelo diferente

#### **Características Clave**

**8 Agentes Soportados:**

| Agente | Modelo de Delegación | Feature Principal |
|--------|---------------------|-------------------|
| **Claude Code** | Full (Task tool) | Sub-agentes, output styles |
| **OpenCode** | Full (multi-mode overlay) | Per-phase model routing |
| **Gemini CLI** | Full (experimental) | Custom agents en ~/.gemini/agents/ |
| **Cursor** | Full (native subagents) | 9 SDD agents en ~/.cursor/agents/ |
| **VS Code Copilot** | Full (runSubagent) | Parallel execution |
| **Codex** | Solo-agent | CLI-native, TOML config |
| **Windsurf** | Solo-agent | Plan Mode, Code Mode, native workflows |
| **Antigravity** | Solo-agent + Mission Control | Built-in Browser/Terminal sub-agents |

**Instalación Rápida:**

```bash
# macOS / Linux
curl -fsSL https://raw.githubusercontent.com/Gentleman-Programming/gentle-ai/main/scripts/install.sh | bash

# Windows (PowerShell)
irm https://raw.githubusercontent.com/Gentleman-Programming/gentle-ai/main/scripts/install.ps1 | iex
```

**Componentes Principales:**

- **GGA (Gentleman Go Agent)** - CLI nativa con configuración TOML
- **Skills** - Agent skills especializadas (mcp-builder, svelte5-best-practices, bun-development, etc.)
- **Presets** - Configuraciones predefinidas por tipo de proyecto
- **Engram** - Sistema de memoria persistente con FTS5
- **SDD** - Spec-Driven Development workflow (propose → explore → design → tasks → apply → verify → archive)

#### **Cómo se Usa en URLoft**

Gentleman-AI se usa **todo el tiempo** durante el desarrollo de URLoft para:

1. **Desarrollo de Features:**
   - Workflow SDD completo desde especificación hasta implementación
   - Skills especializadas (mcp-builder, better-auth-best-practices, bun-development)
   - Generación de código type-safe con Svelte 5 y Bun

2. **Documentación Automática:**
   - Este archivo `tech.md` se genera y mantiene con Gentleman-AI
   - Skills como `seo-audit`, `skill-creator` automatizan documentación técnica
   - AGENTS.md y otros archivos de configuración se generan automáticamente

3. **Testing y QA:**
   - Playwright E2E tests con la skill `playwright-cli`
   - Agent Browser para testing de integración web
   - Skills especializadas para cada tipo de test

4. **Optimización y Debugging:**
   - Análisis de SEO y performance
   - Refactoring automatizado con skills específicas
   - Detección de issues y sugerencias de fixes

5. **Gestión de MCP Servers:**
   - Desarrollo del MCP server de URLoft con `mcp-builder`
   - Testing con MCP Inspector
   - Integración con Claude Desktop, OpenCode y otros agentes

**Por qué es Fundamental:**

Sin Gentleman-AI, URLoft sería un proyecto con código vanilla y documentación básica. **Con Gentleman-AI**, tenemos:
- ✅ Memoria persistente de todas las decisiones técnicas
- ✅ Documentación técnica siempre actualizada
- ✅ Skills especializadas para cada tecnología
- ✅ Workflow SDD estructurado para cada feature
- ✅ MCP server robusto y bien documentado
- ✅ Tests E2E automatizados
- ✅ Integración multi-modelo (OpenAI, Google, Anthropic, etc.)

**Stack:** Go 84.8%, Shell 8.9%, TypeScript 3.2%, HTML 2.3%, PowerShell 0.8%

**Licencia:** MIT

**Estadísticas:**
- ⭐ 1.1k stars
- 🍴 125 forks
- 👥 11 contributors
- 📦 103 releases

---

### OpenCode.ai

**Nombre:** OpenCode.ai
**Enlace:** https://opencode.ai/

#### **Qué es**

OpenCode.ai es un **agente de codificación IA de código abierto** que ayuda a escribir código en tu terminal, IDE o aplicación de escritorio. Es una alternativa gratuita y open-source a herramientas como Cursor, GitHub Copilot Workspace o Claude Code, con la ventaja de ser completamente personalizable y respetuoso con la privacidad.

**Antes vs Después:**
- ❌ **Antes:** "Necesito pagar suscripciones costosas para tener un buen asistente de IA"
- ✅ **Después:** "Tengo un agente de IA potente, gratuito y con privacidad garantizada"

#### **Propósito**

Proporcionar un asistente de codificación con IA **accesible, privado y flexible** que:

- **Sea completamente gratuito** - Código abierto sin costos ocultos
- **Respete la privacidad** - No almacena código ni datos de contexto
- **Soporte múltiples modelos** - Claude, GPT, Gemini y 75+ proveedores más
- **Se integre con todo** - Terminal, escritorio, IDEs (VS Code, JetBrains, etc.)
- **Use tus suscripciones existentes** - GitHub Copilot, ChatGPT Plus/Pro, etc.

#### **Características Clave**

**Principales funcionalidades:**

- **✅ LSP habilitado** - Carga automáticamente los LSPs correctos para el LLM
- **✅ Multi-sesión** - Inicia múltiples agentes en paralelo en el mismo proyecto
- **✅ Compartir enlaces** - Comparte un enlace a cualquier sesión para referencia o debugging
- **✅ GitHub Copilot** - Inicia sesión con GitHub para usar tu cuenta de Copilot
- **✅ ChatGPT Plus/Pro** - Inicia sesión con OpenAI para usar tu cuenta de ChatGPT Plus o Pro
- **✅ Cualquier modelo** - Más de 75 proveedores de LLM a través de Models.dev, incluyendo modelos locales
- **✅ Cualquier editor** - Disponible como interfaz de terminal, aplicación de escritorio y extensión de IDE

**Privacidad y Seguridad:**

- **🔒 Sin almacenamiento de código** - No guarda tu código ni datos de contexto
- **🔒 Entornos sensibles** - Puede operar en entornos con requisitos de privacidad estrictos
- **🔒 Código abierto** - Código auditable por la comunidad
- **🔒 Local-first** - Opción de usar modelos locales completamente offline

**Disponibilidad:**

- **Terminal** - CLI nativa con instalación vía curl, npm, bun, brew, paru
- **Escritorio** - Aplicación nativa para macOS, Windows y Linux (beta)
- **IDE** - Extensiones para VS Code, JetBrains, Neovim, etc.

**Estadísticas de Comunidad:**

- ⭐ **132K** estrellas en GitHub
- 👥 **800** colaboradores
- 📦 **10,000+** commits
- 👨‍💻 **5M+** desarrolladores activos mensualmente

#### **Cómo se Usa en URLoft**

OpenCode.ai se puede usar como **alternativa o complemento** a otros agentes de IA en el desarrollo de URLoft:

1. **Desarrollo de Features:**
   - Generación de código con múltiples modelos (Claude, GPT, Gemini)
   - Refactoring automatizado de componentes Svelte
   - Optimización de queries SQLite

2. **Debugging y Testing:**
   - Análisis de errores con LSP habilitado
   - Generación de tests unitarios con Bun Test
   - Debugging interactivo en terminal

3. **Documentación:**
   - Generación de documentación técnica
   - Explicación de código y arquitectura
   - Creación de README y guías

4. **Integración con Stack Existente:**
   - Funciona junto con Gentleman-AI y otros agentes
   - Puede usar modelos locales para mayor privacidad
   - Comparte sesiones para colaboración en equipo

**Ventajas sobre otros agentes:**

- **100% Gratuito** - Sin suscripciones premium ni costos ocultos
- **Privacidad garantizada** - No envía código a servidores externos (si se usan modelos locales)
- **Multi-modelo** - No está atado a un solo proveedor de IA
- **Código abierto** - Comunidad activa y desarrollo transparente

#### **Integración con Gentleman-AI**

OpenCode.ai es **uno de los 8 agentes soportados** por Gentleman-AI. Esto significa que:

- **Puede ser "supercargado"** con el ecosistema Gentleman-AI
- **Adquiere memoria persistente** a través de Engram
- **Usa el workflow SDD** (Spec-Driven Development)
- **Tiene acceso a skills curadas** del ecosistema Gentleman
- **Puede ejecutarse en diferentes modelos** según la fase de SDD

**Modelo de Delegación:** Full (multi-mode overlay)
**Feature Principal:** Per-phase model routing

**En Gentleman-AI, OpenCode destaca por:**
- Su capacidad de **routing de modelos por fase** (cada paso de SDD usa un modelo diferente)
- **Soporte multi-mode overlay** para diferentes estilos de output
- **Integración perfecta** con el ecosistema Gentleman (skills, MCP, memoria)

#### **Instalación**

```bash
# macOS / Linux (curl)
curl -fsSL https://opencode.ai/install | bash

# npm
npm install -g opencode

# bun
bun install -g opencode

# macOS Homebrew
brew install opencode

# Arch Linux (paru)
paru -S opencode
```

**Documentación:** [docs.opencode.ai](https://opencode.ai/docs)
**GitHub:** [github.com/opencode-org/opencode](https://github.com/opencode-org/opencode)
**Discord:** [discord.gg/opencode](https://discord.gg/opencode)
**X (Twitter):** [@opencode_ai](https://x.com/opencode_ai)

---

## Arquitectura

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
- **Nota MVC:** evitamos lenguaje MVC pesado porque este backend es **API-first**; no renderiza vistas del servidor, expone contratos JSON para frontend EJS/Alpine.js, extensión y clientes MCP.

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

## Estructura del Proyecto

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
├── frontend-bun-ejs/      # Frontend EJS + Bun server
│   ├── views/             # Templates EJS (páginas, parciales)
│   ├── public/            # Assets estáticos (CSS, JS, imágenes)
│   ├── src/               # Source code (api, controllers, middleware, routes)
│   │   ├── controllers/   # Controladores HTTP (home, auth, dashboard, etc.)
│   │   ├── routes/        # Módulos de rutas por feature (public, auth, dashboard, api)
│   │   ├── router.ts      # Router core basado en regex
│   │   └── middleware/    # Cross-cutting middleware (auth, rate limiting)
│   ├── index.ts           # Entry point del servidor (99 líneas, modular)
│   └── package.json
├── extension/             # Extensión de Chrome
│   ├── manifest.json      # Manifest V3
│   ├── popup/             # UI del popup (EJS + Alpine.js)
│   ├── background/        # Service worker
│   └── icons/             # Iconos de la extensión
├── public/                # Assets estáticos
│   ├── manifest.json      # Web App Manifest (PWA)
│   ├── sw.js              # Service Worker (PWA)
│   └── icons/             # Iconos PWA (192x192, 512x512)
├── backend/db/database.sqlite # BD principal (generada automáticamente)
├── backend/package.json
├── frontend-bun-ejs/package.json
└── README.md
```

 ---

### Router Modular (frontend-bun-ejs)

El servidor frontend-bun-ejs utiliza un **router custom basado en regex** con una **arquitectura modular por feature**.

#### Estructura de Rutas

```
frontend-bun-ejs/src/routes/
├── index.ts              (45 líneas) - RouteDefinition type + registerRoutes() helper
├── public.routes.ts      (18 líneas) - 5 rutas públicas (/, /explore, /u/:username)
├── auth.routes.ts        (25 líneas) - 10 rutas de autenticación
├── dashboard.routes.ts   (63 líneas) - 17 rutas del dashboard
└── api.routes.ts         (17 líneas) - 3 rutas de API (HTMX partials, short links)
```

#### Tipo RouteDefinition

```typescript
export type RouteDefinition = {
  method: HttpMethod;
  pattern: string;
  handler: Controller;
};
```

#### Helper registerRoutes()

```typescript
export function registerRoutes(routes: RouteDefinition[]): void {
  for (const { method, pattern, handler } of routes) {
    // Validación de duplicados
    const existing = listRoutes().find(
      r => r.method === method && r.pattern === pattern
    );
    if (existing) {
      console.warn(`⚠️  Duplicate route detected: ${method} ${pattern}`);
      continue;
    }

    addRoute(method, pattern, handler);
  }
}
```

#### Entry Point (index.ts)

```typescript
import { registerRoutes, publicRoutes, authRoutes, dashboardRoutes, apiRoutes }
  from "./src/routes/index.ts";

// Registro modular (4 líneas vs 50+ originales)
registerRoutes(publicRoutes);      // 5 rutas
registerRoutes(authRoutes);        // 10 rutas
registerRoutes(dashboardRoutes);   // 17 rutas
registerRoutes(apiRoutes);         // 3 rutas

// Configuración de servidor (sin cambios)
const server = Bun.serve({ /* ... */ });
```

#### Métricas de Refactorización (Phase 9)

| Aspecto | Antes | Después | Mejora |
|---------|-------|---------|--------|
| **Líneas en index.ts** | 193 | 99 | **-48.7%** |
| **Imports en index.ts** | 60+ | 4 | **-93.3%** |
| **Llamadas addRoute()** | ~50 | 4 | **-92%** |
| **Tests pasando** | 20/20 | 32/32 | **+60% cobertura** |
| **Rutas registradas** | 37 | 37 | ✅ Paridad |
| **Breaking changes** | - | 0 | ✅ Zero |

#### Ventajas de la Arquitectura Modular

- **Mantenibilidad**: Agregar/modificar rutas = 1 archivo (antes: buscar en 193 líneas)
- **Escalabilidad**: Fácil agregar nuevos módulos (admin.routes.ts, webhooks.routes.ts)
- **Type-safe**: Errores en tiempo de compilación con TypeScript
- **Testabilidad**: Tests aislados por módulo (32 tests, 100% pass)
- **Developer Experience**: Autocompletado y documentación inline

#### Documentación Completa

Ver [`phase09-router-modular-refactor.md`](./phase09-router-modular-refactor.md) para:
- Decisiones técnicas detalladas
- Estrategia de testing (unit + integration)
- Lecciones aprendidas
- Rollback plan (<5 minutos)

---

### Integración Frontend ↔ Backend

Usamos **EJS templates** con **HTMX** para comunicación tipo form-based:

```ejs
<!-- views/links/create.ejs -->
<form hx-post="/api/links" hx-swap="outerHTML">
  <input name="url" placeholder="https://..." />
  <button type="submit">Guardar</button>
</form>
```

```typescript
// backend/routes/links.route.ts
export async function createLink(req: Request) {
  const data = await req.formData();
  await createLinkService(data.get("url"));
  return html`<div class="success">Link guardado!</div>`;
}
```

### Procesamiento en Segundo Plano (Workers)

Las tareas pesadas (Health Check, Reader Mode, Wayback Machine) se ejecutan en **background workers** usando `Bun.Worker` sin bloquear el servidor web ni la UX del usuario.

**Nota:** Actualmente los workers se ejecutan en memoria sin persistencia. Si el servidor se reinicia, los jobs pendientes se pierden. La durabilidad está planificada para futuras versiones.

---

## Decisiones Técnicas

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
| `GET` | `/api/s/:code` | Redirección al link original (incrementa `links.views` y registra visita en `link_views`) |

Nota de privacidad: la telemetría de visitas usa las reglas de `TRUST_PROXY`; cuando no hay proxy confiable o no existe header válido, `ip_address` se guarda como `"unknown"`.

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

-- Vistas por visita (telemetría de short links)
CREATE TABLE link_views (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  link_id INTEGER NOT NULL,
  user_id INTEGER,
  ip_address TEXT NOT NULL,
  user_agent TEXT NOT NULL,
  visited_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (link_id) REFERENCES links(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
);

CREATE INDEX idx_link_views_link_id_visited_at ON link_views(link_id, visited_at DESC);
CREATE INDEX idx_link_views_visited_at ON link_views(visited_at DESC);
CREATE INDEX idx_link_views_user_id_visited_at ON link_views(user_id, visited_at DESC);

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

## Features Implementados

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
Para componentes de UI Alpine.js, usamos Vitest con `@testing-library/dom` para pruebas centradas en el comportamiento del usuario.
- **Vitest:** Integrado con Vite, UI moderna y ejecución ultrarrápida.
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
- **Utility-first** — estilos directamente en el HTML/EJS, sin archivos CSS enormes
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
/* frontend/public/app.css (o punto de entrada CSS) */
@import "tailwindcss";

/* Opcional: customizaciones de tema */
@theme {
  --color-primary: #6366f1;
  --font-sans: "Inter", sans-serif;
}
```

### Uso en Componentes EJS

```ejs
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

## Guías de Desarrollo

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

# Workers Background Jobs
WORKER_SWEEP_ENABLED=false         # Habilitar verificación periódica de links
WORKER_SWEEP_INTERVAL_MS=300000    # Intervalo entre verificaciones (5 min)
HEALTH_CHECK_BATCH_SIZE=50         # Links a procesar por lote

# Worker Timeouts
HEALTH_CHECK_TIMEOUT_MS=10000      # Timeout para health check (10s)
READER_MODE_TIMEOUT_MS=15000       # Timeout para reader mode (15s)
WAYBACK_TIMEOUT_MS=30000           # Timeout para wayback machine (30s)

# Worker Retries
WORKER_MAX_ATTEMPTS=3              # Máximo de intentos para retry
WORKER_RETRY_BASE_DELAY_MS=1000    # Delay base para retry exponencial (1s)
```

#### Configuración de TRUST_PROXY

La aplicación extrae direcciones IP de clientes para logs de auditoría y seguridad de sesiones. Por defecto, retorna `"unknown"` por privacidad.

**¿Cuándo habilitar TRUST_PROXY?**

Solo debes establecer `TRUST_PROXY=true` cuando tu aplicación está detrás de un **proxy reverso de confianza** que:
- Reemplaza o elimina headers `x-forwarded-for` y `x-real-ip` de requests entrantes
- No permite que clientes envíen estos headers directamente

**Escenarios comunes:**

- ✅ **Cloudflare**: `TRUST_PROXY=true` (Cloudflare sanitiza headers)
- ✅ **Nginx/Apache** como frontend: `TRUST_PROXY=true` (si configurado correctamente)
- ✅ **AWS ALB/GCP LB**: `TRUST_PROXY=true` (load balancers de confianza)
- ❌ **VPS directo sin proxy**: `TRUST_PROXY=false` (¡riesgo de spoofing!)
- ❌ **Desarrollo local**: `TRUST_PROXY=false` (no es necesario)

**⚠️ ADVERTENCIA DE SEGURIDAD:**

NUNCA habilites `TRUST_PROXY=true` si tu aplicación es accesible directamente desde internet sin un proxy de confianza. Los atacantes podrían falsificar headers y suplantár IPs reales.

**Cómo funciona:**

Cuando `TRUST_PROXY=true`, la app extrae IPs en este orden:
1. `x-forwarded-for` (primera IP de la lista separada por comas)
2. `x-real-ip`
3. `"unknown"` (si no hay headers válidos)

**Ejemplos de configuración:**

```env
# Producción con Cloudflare
TRUST_PROXY=true

# Desarrollo local
TRUST_PROXY=false

# VPS directo (sin proxy)
TRUST_PROXY=false
```

---

**Última actualización:** 2026-03-28
