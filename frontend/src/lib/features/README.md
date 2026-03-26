# Frontend Feature-First Convention

Cada funcionalidad (feature) debe agruparse en su propia carpeta dentro de `src/lib/features/`.

Estructura sugerida:
- `components/`: Componentes de UI exclusivos de la feature.
- `services/`: Llamadas a la API o lógica de negocio (usualmente delegando a `lib/services/http.ts`).
- `state.svelte.ts`: Estado reactivo de la feature usando Svelte 5 runes.
- `types.ts`: Definiciones de TypeScript.
- `index.ts`: Punto de entrada para exportar lo necesario.

Ejemplo: `src/lib/features/links/`
