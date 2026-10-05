# Diseño Técnico: Estabilización de Drag and Drop en Desktop

## Context

En navegadores Desktop, los eventos de HTML5 Drag and Drop sufren de cancelaciones cuando el cursor cruza elementos hijos que tienen eventos de puntero activos o cuando contenedores padres interceptan eventos de arrastre. Ver proposal.md para la motivación.

## Decisions

### 1. Aislamiento CSS con .is-dragging
Cuando el estado draggedId está activo en TreeView.tsx, el contenedor principal .tree-view recibe la clase .is-dragging.
En index.css:
`css
.tree-view.is-dragging .tree-row * {
  pointer-events: none;
}
`
Esto elimina el parpadeo de dragleave y garantiza que la fila .tree-row sea el único EventTarget continuo.

### 2. Detección de Destinos en Carpetas
- Cuando el cursor está sobre una carpeta (isFolder), el 100% de la fila se procesa como inside (mover dentro de la carpeta), excepto si se detecta un borde extremo explícito con padre válido.
- Se mantiene un timer de 350ms que expande automáticamente la carpeta colapsada si el usuario sostiene el cursor sobre ella.

### 3. Simplificación de onDrop y onDragOver
- Eliminar los manejadores en .tree-children-inner para que el flujo de eventos fluya naturalmente entre las filas.
- Asegurar que globalDraggingId y e.dataTransfer sincronicen el sourceId de forma determinista y ejecuten onMoveNodeDirect.

## Risks / Trade-offs

- **[Riesgo]** Si un usuario intenta hacer clic en un botón mientras arrastra, no responderá.
  → *Mitigación:* Comportamiento estándar esperado: durante un drag no se deben interactuar con botones internos.
