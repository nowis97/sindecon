# Propuesta: Mejoras de UI con Animaciones Fluidas y Micro-interacciones UX

## Why

La aplicación SINDECON cuenta con una base sólida de diseño inspirado en Obsidian y Notion (Modo Oscuro/Claro, Command Palette, Smart Import, Dashboard clínico y Quick Capture). Sin embargo, muchas transiciones de estado, aperturas de modales, colapsos del árbol de navegación, cambios de modo lector/editor e interacciones móviles ocurren de forma estática o con saltos abruptos.

Incorporar un sistema cohesivo de animaciones fluidas, micro-interacciones táctiles y transiciones visuales aceleradas por hardware elevará significativamente la experiencia del usuario (especialmente médicos y estudiantes en guardias o planta con dispositivos móviles y escritorio), haciendo que el cuaderno médico se sienta moderno, responsivo y orgánico, sin comprometer el rendimiento ni la accesibilidad.

## What Changes

- **Transiciones del Shell y Navegación Global**:
  - Drawer móvil con desplazamiento elástico (`cubic-bezier(0.16, 1, 0.3, 1)`) y desenfoque progresivo en backdrop.
  - Barra de navegación inferior móvil con micro-escalas táctiles (`active: scale(0.95)`), indicador animado y botón flotante FAB central con efecto de pulso y toque físico.
  - Transición suave de paletas de color en alternancia de tema (Modo Oscuro ↔ Claro) y rotación dinámica del icono ☀️ / 🌙.

- **Dashboard Clínico & Animaciones Escalonadas (Staggered Entry)**:
  - Entrada secuencial animada (`staggered fade-in-up`) para tarjetas de métricas y acciones rápidas al montar el dashboard.
  - Efectos de elevación (`hover: translateY(-3px)`) con sombra difusa y halo de atención palpitante en la tarjeta de Inbox cuando hay capturas pendientes.
  - Chips de etiquetas clínicas con transiciones fluidas de selección y filtrado.

- **Árbol de Conocimiento & Menús Contextuales**:
  - Animación suave de acordeón para expansión y colapso de carpetas mediante CSS grid (`grid-template-rows: 0fr -> 1fr`) y rotación del caret (0° a 90°).
  - Menús contextuales (···) con animación de apertura (`scale(0.95) -> scale(1)` + `opacity: 0 -> 1`) anclados al origen del botón.
  - Micro-animación de destello dorado (*star burst*) al alternar artículos favoritos.

- **Command Palette (Ctrl+K) & Sistema de Diálogos**:
  - Entrada y salida modal fluida con efecto *spring* (`scale(0.96) -> scale(1)` y `translateY(-8px) -> translateY(0)`).
  - Transición suave del indicador de elemento seleccionado al navegar con flechas del teclado en la paleta de comandos.
  - Animaciones unificadas de entrada y salida para todos los diálogos (`PromptDialog`, `ConfirmDialog`, `SmartImportModal`, `GoogleDriveModal`).

- **Experiencia de Lectura & Edición (Notion-Style)**:
  - Selector segmentado animado (*sliding pill*) entre modo Lector y Editor.
  - Desvanecimiento cruzado (*cross-fade*) entre la vista de lectura y el editor ProseMirror.
  - Micro-interacciones en Callouts clínicos (alertas, dosis, perlas) con feedback visual al interactuar.
  - Tarjetas de diagramas Mermaid con transiciones cinéticas suaves de zoom y estados de carga.

- **Accesibilidad & Rendimiento (GPU & Reduced Motion)**:
  - Soporte completo para `@media (prefers-reduced-motion: reduce)` desactivando animaciones para usuarios con sensibilidad de movimiento.
  - Uso estricto de transformaciones aceleradas por GPU (`transform`, `opacity`, `filter`) para garantizar 60/120 FPS sin consumo excesivo de batería.

## Capabilities

### New Capabilities
<!-- Ninguna nueva capacidad de dominio; se enriquecen las capacidades de interfaz existentes -->

### Modified Capabilities
- `offline-shell`: Incorpora transiciones fluidas de navegación (drawer móvil, bottom dock, FAB, alternancia de tema sin parpadeo y soporte prefers-reduced-motion).
- `knowledge-tree`: Incorpora transiciones de acordeón en carpetas del árbol, micro-animaciones en menús contextuales y feedback visual en favoritos.
- `content-editing`: Incorpora selector segmentado fluido Lector/Editor, transiciones en callouts clínicos y feedback interactivo en el asistente de importación.
- `search`: Incorpora animación de entrada de la paleta de comandos (Ctrl+K) y transición suave de navegación de teclado.

## Impact

- **Código Afectado**:
  - `src/index.css`: Definición de nuevas variables de timing, curvas bézier, keyframes y clases de animación.
  - `src/components/tree/TreeView.tsx`: Estructura CSS para expansión fluida de carpetas y menús.
  - `src/components/dashboard/Dashboard.tsx`: Clases de animación escalonada y efectos hover.
  - `src/components/search/CommandPalette.tsx`: Transición de apertura y selección de lista.
  - `src/components/common/DialogModal.tsx`: Animaciones uniformes de modales y diálogos.
  - `src/components/navigation/MobileBottomBar.tsx`: Feedback táctil y micro-escalas.
  - `src/App.tsx`: Toggle animado de Lector/Editor y coordinación de estados.
- **Dependencias**: Cero dependencias adicionales (se implementa con CSS moderno nativo y React 19 estándar).
- **Pruebas**: Verificación mediante suites de pruebas unitarias (`vitest`) y pruebas funcionales end-to-end (`playwright`).
