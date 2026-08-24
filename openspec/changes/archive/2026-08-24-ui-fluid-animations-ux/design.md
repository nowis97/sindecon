# Diseño Técnico: Sistema de Animaciones Fluidas y Micro-interacciones UI/UX

## Context

La aplicación utiliza React 19 con un sistema de diseño propio basado en variables CSS (paletas Light/Dark inspiradas en Notion y Obsidian). Aunque el layout y los componentes están bien estructurados, carecen de curvas de transición naturales y micro-interacciones hápticas/visuales, resultando en cambios de vista abruptos.

Véase `proposal.md` y las especificaciones delta en `specs/` para el alcance funcional y los escenarios requeridos.

## Goals / Non-Goals

**Goals:**
- Proporcionar transiciones de interfaz suaves y orgánicas a 60/120 FPS sin caídas de cuadros.
- Implementar animaciones basadas 100% en CSS moderno nativo y aceleración por GPU (`transform`, `opacity`, `filter`), sin añadir dependencias pesadas de JavaScript.
- Garantizar accesibilidad total respetando `@media (prefers-reduced-motion: reduce)`.
- Mejorar la ergonomía táctil en dispositivos móviles (zona del pulgar, feedback de presión).

**Non-Goals:**
- No introducir librerías externas de animación (como Framer Motion o GSAP) para mantener el bundle ultraligero y el arranque instantáneo en PWA.
- No reestructurar el modelo de datos de IndexedDB/Dexie ni alterar la lógica de negocio de los componentes.

## Decisions

### 1. Sistema Unificado de Curvas de Tiempo (Motion Tokens)
Se introducen tokens globales de animación en `:root`:
```css
--ease-spring: cubic-bezier(0.16, 1, 0.3, 1);     /* Para modales, drawers y elementos emergentes */
--ease-smooth: cubic-bezier(0.4, 0, 0.2, 1);     /* Para hovers, cambios de color y micro-escalas */
--ease-in-out: cubic-bezier(0.65, 0, 0.35, 1);   /* Para rotaciones de iconos y expansiones */
--dur-fast: 120ms;
--dur-normal: 200ms;
--dur-sheet: 280ms;
```
*Alternativas descartadas*: `linear` o `ease` genéricos, por sentirse mecánicos y sin dinamismo físico.

### 2. Animación de Acordeón en Árbol de Carpetas con CSS Grid
Para evitar calcular `scrollHeight` con JavaScript (que fuerza *reflows* sincrónicos), se implementa la técnica moderna de CSS Grid:
```css
.tree-node-children {
  display: grid;
  grid-template-rows: 0fr;
  transition: grid-template-rows var(--dur-normal) var(--ease-spring);
}
.tree-node-children.expanded {
  grid-template-rows: 1fr;
}
.tree-node-children-inner {
  overflow: hidden;
}
```

### 3. Animación de Entrada Escalonada (Staggered Entry) en Dashboard
Las tarjetas de estadísticas y acciones rápidas recibirán una variable CSS `--stagger-index` para aplicar un retardo secuencial (`animation-delay: calc(var(--stagger-index) * 45ms)`), creando una presentación orgánica y profesional.

### 4. Diálogos y Modales con Entrada Spring Cinética
Todos los modales (`BaseModal`, `CommandPalette`, `SmartImportModal`, `GoogleDriveModal`, `QuickCapture`) comparten la animación:
```css
@keyframes modal-spring-in {
  from {
    opacity: 0;
    transform: scale(0.94) translateY(-10px);
  }
  to {
    opacity: 1;
    transform: scale(1) translateY(0);
  }
}
```

### 5. Micro-interacciones Táctiles en Móvil
- **FAB Central ⚡**: Efecto de pulso con onda expansiva (`box-shadow pulse`) y `active: scale(0.92)`.
- **Botones y Chips**: Respuesta física táctil inmediata en `:active` (`scale(0.97)`).
- **Destello de Favoritos ⭐**: Efecto *pop-scale* (0.8 -> 1.25 -> 1.0) al anclar a protocolos clave.

### 6. Soporte de Accesibilidad Universal
```css
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
    scroll-behavior: auto !important;
  }
}
```

## Risks / Trade-offs

- **[Riesgo] Jank o parpadeo en dispositivos móviles de gama baja** → *Mitigación*: Únicamente animar propiedades de composición aceleradas por hardware (`transform`, `opacity`), evitando animar `height`, `width`, `margin` o `top`.
- **[Riesgo] Desalineación durante transiciones de cambio de modo Lector/Editor** → *Mitigación*: Utilizar contenedor con `min-height` relativo y desvanecimiento cruzado (*cross-fade*) de 150ms.
