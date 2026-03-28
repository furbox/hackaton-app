# Design: Behind the Scenes Page

## Technical Approach

Create a public route `/como-lo-hice` that serves a static EJS template with Alpine.js for client-side data fetching. The page will load video metadata from `public/videos.json` via `fetch()` and render YouTube embeds with a responsive grid layout. This follows the project's existing pattern of server-side rendering with EJS and client-side interactivity with Alpine.js.

**Rationale**: JSON-based static content allows instant updates without server restart, aligns with the project's file-based architecture, and separates data from presentation. Alpine.js provides reactive state management without additional dependencies.

## Architecture Decisions

### Decision: Client-side JSON Fetch vs Server-side Include

| Aspect | Client-side Fetch (Chosen) | Server-side Include |
|--------|---------------------------|---------------------|
| **Complexity** | Low - standard fetch API | Medium - requires fs reads |
| **Update speed** | Instant - no restart needed | Requires server restart |
| **Error handling** | Rich - loading/error states in UI | Limited - server error pages |
| **Performance** | One extra HTTP request | Zero extra requests |
| **Maintainability** | High - edit JSON in public/ | Medium - requires controller changes |

**Rationale**: The ability to update video content without restarting the server during the hackathon demo is critical. The slight performance penalty of one extra fetch is negligible compared to the developer experience gain.

### Decision: YouTube Embed Format

| Option | Chosen | Trade-off |
|--------|--------|-----------|
| **Standard iframe** | ✅ Yes | Universal compatibility |
| **YouTube Player API** | ❌ No | Adds complexity, unnecessary for simple playback |
| **Privacy-enhanced mode** | ✅ Optional | `youtube-nocookie.com` domain available via config |

**Rationale**: Standard iframes with `youtube.com/embed/{videoId}` provide reliable playback across all devices without additional JavaScript. Privacy-enhanced mode (`youtube-nocookie.com`) can be toggled via a simple flag in the JSON.

### Decision: Responsive Grid Layout

| Breakpoint | Columns | Implementation |
|------------|---------|----------------|
| Mobile (< 640px) | 1 col | `grid-cols-1` |
| Tablet (640-1024px) | 2 cols | `sm:grid-cols-2` |
| Desktop (> 1024px) | 3 cols | `lg:grid-cols-3` |

**Rationale**: Matches the existing pattern used in `home.ejs` for featured links (`grid-cols-1 sm:grid-cols-2 lg:grid-cols-3`), ensuring visual consistency across the application.

## Data Flow

```
User requests /como-lo-hice
         ↓
behind-scenes.controller.ts (server)
         ↓
renderPage("behind-scenes", { user, flash })
         ↓
behind-scenes.ejs (HTML + Alpine.js)
         ↓
Alpine.init() → fetch("/public/videos.json")
         ↓
Alpine reactive state (videos, loading, error, selectedVideo)
         ↓
DOM updates (hero, featured video, grid)
         ↓
User clicks thumbnail → selectedVideo updates → modal/expand
```

## File Changes

| File | Action | Description |
|------|--------|-------------|
| `frontend-bun-ejs/src/controllers/behind-scenes.controller.ts` | Create | Route handler that renders the page with user session and flash messages |
| `frontend-bun-ejs/views/pages/behind-scenes.ejs` | Create | Template with Alpine.js component, hero section, featured video, and grid layout |
| `frontend-bun-ejs/public/videos.json` | Create | Data file with hero, featured (optional), and videos[] array |
| `frontend-bun-ejs/index.ts` | Modify | Add route registration `GET /como-lo-hice` after batch 3 (public pages) |
| `frontend-bun-ejs/views/partials/nav.ejs` | Modify | Add nav link after "Explore" in both desktop and mobile sections |

## Interfaces / Contracts

### TypeScript Interface (for controller validation)

```typescript
interface VideoMetadata {
  id: string;           // YouTube video ID (11 chars)
  title: string;        // Display title
  description: string;  // Short description
  thumbnail?: string;   // Optional custom thumbnail URL
  duration?: string;    // Optional duration display (e.g., "12:34")
  publishedAt?: string; // ISO date string
}

interface VideosData {
  hero: {
    title: string;      // Page title
    description: string;// Subtitle/deck
  };
  featured: VideoMetadata | null; // Optional featured video
  videos: VideoMetadata[];        // List of videos
  config?: {
    privacyEnhanced?: boolean;    // Use youtube-nocookie.com
  };
}
```

### JSON Schema (videos.json)

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "required": ["hero", "videos"],
  "properties": {
    "hero": {
      "type": "object",
      "required": ["title", "description"],
      "properties": {
        "title": { "type": "string", "example": "Cómo lo hice" },
        "description": { "type": "string", "example": "El detrás de cámaras de URLoft" }
      }
    },
    "featured": {
      "oneOf": [
        { "$ref": "#/definitions/video" },
        { "type": "null" }
      ]
    },
    "videos": {
      "type": "array",
      "items": { "$ref": "#/definitions/video" }
    },
    "config": {
      "type": "object",
      "properties": {
        "privacyEnhanced": { "type": "boolean" }
      }
    }
  },
  "definitions": {
    "video": {
      "type": "object",
      "required": ["id", "title", "description"],
      "properties": {
        "id": { "type": "string", "pattern": "^[a-zA-Z0-9_-]{11}$" },
        "title": { "type": "string" },
        "description": { "type": "string" },
        "thumbnail": { "type": "string", "format": "uri" },
        "duration": { "type": "string" },
        "publishedAt": { "type": "string", "format": "date-time" }
      }
    }
  }
}
```

### Example Data (videos.json)

```json
{
  "hero": {
    "title": "Cómo lo hice",
    "description": "Descubre el detrás de cámaras de URLoft en el Hackathon 2026 midudev. Aprende cómo construimos cada feature."
  },
  "featured": null,
  "videos": [
    {
      "id": "dQw4w9WgXcQ",
      "title": "Episodio 1: Stack Selection & Architecture",
      "description": "Por qué elegimos Bun, Svelte y SQLite. Decisiones de arquitectura para el hackathon.",
      "duration": "15:24"
    },
    {
      "id": "LXb3EKWsInQ",
      "title": "Episodio 2: Better Auth Integration",
      "description": "Implementando autenticación con sesiones stateful y fingerprint de seguridad.",
      "duration": "18:45"
    }
  ]
}
```

### YouTube URL Formats

| Use Case | Format |
|----------|--------|
| Embed iframe | `https://www.youtube.com/embed/{videoId}` |
| Privacy-enhanced | `https://www.youtube-nocookie.com/embed/{videoId}` |
| Thumbnail (default) | `https://img.youtube.com/vi/{videoId}/hqdefault.jpg` |
| Thumbnail (maxres) | `https://img.youtube.com/vi/{videoId}/maxresdefault.jpg` |
| Watch page | `https://www.youtube.com/watch?v={videoId}` |

## Component Design: Alpine.js

### Reactive State Structure

```javascript
{
  // Raw data from JSON
  hero: { title: string, description: string },
  featured: Video | null,
  videos: Video[],

  // UI state
  loading: boolean,
  error: string | null,
  selectedVideo: Video | null,  // For modal/expand

  // Computed properties
  hasFeatured: boolean,
  sortedVideos: Video[],  // By publishedAt if available
}
```

### Initialization Flow

```javascript
async init() {
  this.loading = true;
  this.error = null;

  try {
    const response = await fetch("/public/videos.json");
    if (!response.ok) throw new Error(`HTTP ${response.status}`);

    const data = await response.json();

    // Validate structure (basic)
    if (!data.hero || !data.videos) {
      throw new Error("Invalid JSON structure");
    }

    this.hero = data.hero;
    this.featured = data.featured;
    this.videos = data.videos;
    this.config = data.config || {};
  } catch (err) {
    console.error("Failed to load videos:", err);
    this.error = err.message;
  } finally {
    this.loading = false;
  }
}
```

### Loading State UI

```html
<div x-show="loading" class="flex items-center justify-center py-20">
  <div class="animate-spin rounded-full h-12 w-12 border-b-2 border-accent-primary"></div>
  <span class="ml-4 text-text-secondary">Cargando videos...</span>
</div>
```

### Error State UI

```html
<div x-show="error" class="ui-card p-8 text-center">
  <div class="text-red-500 text-4xl mb-4">⚠️</div>
  <h3 class="text-lg font-bold text-text-primary mb-2">Error al cargar videos</h3>
  <p class="text-text-secondary mb-4" x-text="error"></p>
  <button @click="init()" class="ui-btn-primary">Reintentar</button>
</div>
```

### Video Card Component

```html
<div class="ui-card overflow-hidden transition-shadow hover:shadow-xl hover:shadow-black/30">
  <!-- Thumbnail -->
  <div class="relative aspect-video bg-black cursor-pointer"
       @click="selectedVideo = video">
    <img :src="`https://img.youtube.com/vi/${video.id}/hqdefault.jpg`"
         :alt="video.title"
         class="w-full h-full object-cover"
         loading="lazy" />
    <div class="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 hover:opacity-100 transition-opacity">
      <div class="w-16 h-16 rounded-full bg-accent-primary flex items-center justify-center">
        <svg class="w-8 h-8 text-white ml-1" fill="currentColor" viewBox="0 0 24 24">
          <path d="M8 5v14l11-7z"/>
        </svg>
      </div>
    </div>
    <span x-show="video.duration" x-text="video.duration"
          class="absolute bottom-2 right-2 px-2 py-1 bg-black/80 text-white text-xs rounded">
    </span>
  </div>

  <!-- Info -->
  <div class="p-4">
    <h3 class="font-bold text-text-primary mb-2" x-text="video.title"></h3>
    <p class="text-sm text-text-secondary line-clamp-2" x-text="video.description"></p>
  </div>
</div>
```

### Featured Video Section (16:9)

```html
<div x-show="hasFeatured" class="max-w-5xl mx-auto mb-16">
  <div class="ui-card overflow-hidden">
    <div class="relative aspect-video bg-black">
      <iframe
        :src="`https://www.youtube.com/embed/${featured.id}`"
        :title="featured.title"
        class="w-full h-full"
        frameborder="0"
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
        allowfullscreen>
      </iframe>
    </div>
    <div class="p-6">
      <h2 class="text-2xl font-bold text-text-primary mb-2" x-text="featured.title"></h2>
      <p class="text-text-secondary" x-text="featured.description"></p>
    </div>
  </div>
</div>
```

## Testing Strategy

| Layer | What to Test | Approach |
|-------|-------------|----------|
| **Controller** | Route returns 200, includes user/flash | Bun test with mock Request |
| **Template** | EJS renders without errors | Manual smoke test |
| **JSON Fetch** | Valid JSON loads, invalid shows error | Manual browser test + Alpine unit |
| **Responsive** | Grid breaks correctly | DevTools device emulation |
| **YouTube** | Embeds play, thumbnails load | Manual browser test |
| **Accessibility** | Keyboard nav, ARIA labels | Lighthouse audit |

### Controller Test Example

```typescript
import { describe, test, expect } from "bun:test";
import { behindScenesController } from "./behind-scenes.controller.ts";

describe("behind-scenes.controller", () => {
  test("should render page successfully", async () => {
    const request = new Request("http://localhost/como-lo-hice");
    const response = await behindScenesController(request);

    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toContain("text/html");
  });
});
```

## Migration / Rollout

### No Migration Required

This is a greenfield feature with no database changes or migrations. Rollout is instantaneous after file deployment.

### Rollback Plan

If issues arise during the hackathon demo:

1. **Immediate** (< 1 min): Remove route registration from `index.ts` (restart server)
2. **Clean** (< 5 min): Delete 3 created files (controller, view, JSON) + revert nav.ejs
3. **Zero data loss**: No database changes, completely reversible

### Deployment Checklist

- [ ] Add `videos.json` to `frontend-bun-ejs/public/`
- [ ] Create `behind-scenes.controller.ts`
- [ ] Create `behind-scenes.ejs` template
- [ ] Register route in `index.ts`
- [ ] Update nav.ejs (desktop + mobile)
- [ ] Test `/como-lo-hice` returns 200
- [ ] Test JSON fetch in browser console
- [ ] Test YouTube embeds play correctly
- [ ] Test responsive layout (mobile/tablet/desktop)
- [ ] Test loading state (slow network simulation)
- [ ] Test error state (malformed JSON)
- [ ] Lighthouse accessibility audit

## Open Questions

None. All technical decisions are straightforward given the existing codebase patterns and requirements.

### Risk Mitigation Summary

| Risk | Mitigation | Status |
|------|-----------|--------|
| JSON malformation breaks page | Alpine try/catch + error UI | ✅ Handled |
| YouTube ID incorrect | Thumbnail fallback + iframe error handling | ✅ Handled |
| Slow JSON load | Loading spinner with skeleton UI | ✅ Handled |
| Mobile bandwidth | Lazy loading for thumbnails + `loading="lazy"` | ✅ Handled |
