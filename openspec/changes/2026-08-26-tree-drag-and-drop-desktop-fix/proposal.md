# Propuesta: Corrección y Estabilidad de Drag and Drop en Desktop

## Why

En navegadores de escritorio (Desktop), la interacción de arrastrar y soltar (Drag and Drop) para mover carpetas y artículos en el árbol lateral falla debido a la colisión de eventos del puntero en los botones internos de cada fila (carets, acciones, títulos), zonas de impacto restrictivas en carpetas y la interferencia de contenedores anidados en .tree-children-inner. Se requiere corregir estas fallas para que la organización por arrastre sea fluida, precisa y sólida en escritorio.

## What Changes

- **Aislamiento de Puntero durante Arrastre (is-dragging)**: Agregar regla CSS .tree-view.is-dragging .tree-row * { pointer-events: none; } para evitar que los botones o iconos hijos disparen eventos dragleave que cancelan el objetivo en escritorio.
- **Zona de Captura de Carpeta Optimizada**: Tratar por defecto la fila completa de una carpeta como destino de inserción directa (inside), permitiendo soltar artículos o subcarpetas de manera inmediata.
- **Eliminación de Manejadores Redundantes en Hijos**: Retirar los manejadores de arrastre redundantes en .tree-children-inner para que no intercepten ni cancelen los eventos de las filas hijas.
- **Auto-Despliegue Rápido al Sostener el Cursor**: Auto-desplegar carpetas colapsadas tras 350ms de posar un elemento sobre ellas para soltar dentro de sus subcarpetas con facilidad.
- **Feedback Visual y Zonas Raíz**: Asegurar que las zonas superior e inferior de soltado a la raíz se muestren y respondan con claridad.

## Capabilities

### Modified Capabilities
- knowledge-tree: Reforzar la confiabilidad del requerimiento de Drag and Drop en el árbol de conocimiento en plataformas de escritorio.

## Impact

- **Código**: pp/src/components/tree/TreeView.tsx, pp/src/domain/tree.ts e pp/src/index.css.
- **Validación**: Pruebas unitarias en Vitest y verificación interactiva en vivo con Chrome DevTools.
