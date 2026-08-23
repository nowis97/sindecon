# Propuesta: UX/UI Fase 3 - Command Palette (Ctrl+K), Artículos Favoritos/Anclados y Filtro de Etiquetas

## Why

A medida que el Cuaderno Médico crece en cantidad de artículos, guías y protocolos, surgen tres necesidades de productividad esenciales para el personal de salud y estudiantes:

1. **Búsqueda instantánea y ejecución de comandos sin levantar las manos del teclado (`Ctrl+K` / `Cmd+K`):** Permitir saltar a cualquier tema o ejecutar acciones rápidas (crear nota, alternar modo, abrir capturas) en milisegundos.
2. **Acceso a 1 toque para protocolos críticos / de guardia (⭐ Favoritos / Pinned Notes):** En situaciones de urgencia (ej. protocolo de RCP, dosis de intubación en secuencia rápida, criterios de sepsis), el médico no puede perder tiempo navegando por el árbol jerárquico. Debe existir una sección de favoritos anclados permanente.
3. **Exploración clínica por Etiquetas / Síntomas (`#sintomas`, `#farmacos`, `#urgencias`):** Permitir filtrar artículos haciendo click en cualquier etiqueta o explorando la nube de tags clínicos.

## What Changes

- **Command Palette / Quick Switcher (`CommandPalette.tsx`):**
  - Atajo global `Ctrl+K` / `Cmd+K` (y botón de lupa en la interfaz móvil/desktop).
  - Búsqueda en vivo de artículos con resaltado de coincidencias y categorización (Artículos, Acciones Rápidas, Favoritos).
  - Navegación completa por teclado (`Flecha Arriba`, `Flecha Abajo`, `Enter`, `Escape`).
  - Ejecución de comandos del sistema: Nuevo artículo, Nueva carpeta, Captura rápida, Alternar Modo Oscuro/Claro, Ir al Dashboard, Ir al Inbox.
- **Sistema de Artículos Favoritos / Anclados (`useFavorites.ts` / `db/favorites.ts` o `db/meta.ts`):**
  - Botón de estrella ⭐ en la cabecera de cada artículo para marcar/desmarcar como favorito.
  - Sección permanente "⭐ Favoritos / Protocolos Clave" en la parte superior del árbol (`TreeView.tsx` / Sidebar) con acceso inmediato.
  - Persistencia local del listado de favoritos en `IndexedDB` / `localStorage`.
- **Filtro Interactivo por Etiquetas (`TagFilterBar.tsx` / `Dashboard.tsx`):**
  - Panel interactivo de etiquetas en el Dashboard y en la barra de búsqueda para filtrar la lista de artículos por síntoma o categoría clínica en 1 click.
  - Al pulsar una etiqueta en los metadatos de un artículo, filtrar automáticamente o buscar artículos con dicho tag.

## Capabilities

### New Capabilities
- `command-palette`: Modal de búsqueda rápida y ejecutor de acciones por teclado (`Ctrl+K`).
- `pinned-notes`: Gestión y acceso inmediato a artículos favoritos y protocolos anclados.

### Modified Capabilities
- `search`: Soporte para filtrado contextual por etiquetas e integración con el Quick Switcher.
- `knowledge-tree`: Visualización de sección de accesos directos favoritos en la raíz del árbol.

## Impact
- **Código nuevo:** `src/components/search/CommandPalette.tsx`, `src/hooks/useFavorites.ts`, `src/components/search/TagFilterBar.tsx`.
- **Código modificado:** `src/components/tree/TreeView.tsx`, `src/components/dashboard/Dashboard.tsx`, `src/App.tsx`, `src/index.css`.
- **Pruebas:** Cobertura de tests E2E para el Command Palette (`Ctrl+K`), favoritos y filtrado por tags.
