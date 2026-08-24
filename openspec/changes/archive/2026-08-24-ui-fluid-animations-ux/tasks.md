## 1. Design Tokens & Fundamentos CSS de Movimiento

- [x] 1.1 Definir tokens de animación (`--ease-spring`, `--ease-smooth`, `--dur-fast`, `--dur-normal`), keyframes globales (`modal-spring-in`, `fade-in-up`, `pulse-glow`, `star-pop`) y regla `@media (prefers-reduced-motion: reduce)` en `src/index.css`.
- [x] 1.2 Implementar suavizado de transición de tema (Modo Claro / Oscuro) con rotación dinámica del icono ☀️/🌙 en `src/index.css`.

## 2. Shell de Navegación & Ergonomía Móvil

- [x] 2.1 Actualizar transiciones del Drawer lateral móvil con curva elástica y desenfoque dinámico en `src/index.css` y `src/App.tsx`.
- [x] 2.2 Implementar micro-escalas táctiles (`active: scale(0.95)`), halo de atención pulsante en Inbox y animación de pulsación en el FAB central ⚡ en `src/components/navigation/MobileBottomBar.tsx` y `src/index.css`.

## 3. Árbol de Conocimientos & Favoritos Clínicos

- [x] 3.1 Implementar animación de acordeón fluida basada en CSS Grid (`grid-template-rows: 0fr -> 1fr`) y rotación del caret en `src/components/tree/TreeView.tsx` y `src/index.css`.
- [x] 3.2 Añadir animación pop-in en menús contextuales de fila (···) y animación de destello (*star burst*) en artículos favoritos en `src/components/tree/TreeView.tsx` y `src/index.css`.

## 4. Dashboard Clínico & Experiencia Lector/Editor

- [x] 4.1 Implementar animación de entrada escalonada (*staggered fade-in-up*) y elevación interactiva (*hover lift*) en tarjetas de métricas y acciones rápidas en `src/components/dashboard/Dashboard.tsx` y `src/index.css`.
- [x] 4.2 Añadir control segmentado deslizante (*sliding pill*) y desvanecimiento cruzado (*cross-fade*) en el toggle de Modo Lector / Editor en `src/App.tsx` y `src/index.css`.
- [x] 4.3 Añadir micro-interacciones táctiles y realce visual en Callouts médicos (alertas, dosis, perlas) y visor Mermaid en `src/components/reader/ArticleReader.tsx` y `src/index.css`.

## 5. Command Palette (Ctrl+K) & Diálogos Modales

- [x] 5.1 Aplicar animación de entrada unificada tipo *spring* y cierre fluido en `BaseModal`, `CommandPalette`, `SmartImportModal`, `QuickCapture` y `GoogleDriveModal` en `src/index.css`.
- [x] 5.2 Implementar transición suave de elemento seleccionado al navegar con flechas del teclado en `src/components/search/CommandPalette.tsx` y `src/index.css`.

## 6. Verificación y Regresión

- [x] 6.1 Ejecutar suite de pruebas unitarias (`npm test`) y verificar que todos los tests pasen satisfactoriamente.
- [x] 6.2 Ejecutar suite completa de pruebas E2E con Playwright (`npm run test:e2e`) y verificar que la experiencia interactiva mantenga el 100% de compatibilidad.
