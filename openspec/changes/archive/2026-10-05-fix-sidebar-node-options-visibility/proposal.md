# Proposal: Visibilidad y Contención de Opciones en el Árbol Lateral (Sidebar)

## Why

En la barra lateral de navegación (`TreeView`), los usuarios necesitan acceder de forma inmediata y confiable a las acciones contextuales de cada elemento (crear hijos, renombrar, mover, eliminar, importar, etc.). Actualmente:
1. El botón de opciones (`btn-tree-row-menu`, `···`) se mantiene oculto por defecto con `opacity: 0` y solo se muestra en `:hover`, impidiendo que los usuarios reconozcan o interactúen con las opciones en entornos táctiles/móviles o sin pasar el cursor con precisión milimétrica.
2. Un problema de contención de layout en el contenedor animado de hijos (`.tree-children-inner` / `.tree-children-accordion`) causa que nodos con títulos extensos expandan el contenedor más allá del ancho fijo de la barra lateral (320px). Debido a `overflow-x: hidden`, el botón de opciones `···` (posicionado con `margin-left: auto`) queda desplazado fuera de la pantalla (hasta >365px) y es recortado completamente, volviéndolo inaccesible.

Esta propuesta resuelve ambas problemáticas garantizando que el botón de opciones esté siempre visible, contrastado y contenido dentro del viewport de la barra lateral para cualquier carpeta y artículo.

## What Changes

- **Garantizar visibilidad persistente de opciones (`···`)**: El botón `btn-tree-row-menu` en cada fila de carpeta o artículo ahora es visible de forma predeterminada (con opacidad clara y accesible) e intensifica su realce y contraste al posar el cursor (`:hover`), al enfocarse (`:focus-visible`) o cuando el menú está abierto (`.active`).
- **Contención estricta de ancho en el árbol**: Se asegura que `.tree-children-accordion`, `.tree-children-inner`, `.tree-node-wrapper` y `.tree-row` respeten un ancho máximo del 100% y `min-width: 0`, permitiendo que títulos extensos se trunquen con elipsis (`text-overflow: ellipsis`) sin desbordar el contenedor ni desplazar los botones de acción fuera de la barra lateral.
- **Alineación y accesibilidad de filas**: Se preserva el padding jerárquico según profundidad sin empujar los botones contextuales fuera de la vista en niveles profundos.
- **Soporte táctil y desktop consistente**: Permite activar las opciones tanto en dispositivos de escritorio como en interfaces táctiles sin depender exclusivamente de eventos de hover.

## Capabilities

### New Capabilities

*(Ninguna nueva capacidad requerida)*

### Modified Capabilities

- `knowledge-tree`: Modifica el requerimiento del árbol de navegación estilo Obsidian Vault y operaciones sobre nodos para exigir visibilidad persistente, contención de layout y accesibilidad constante del botón de opciones (`···`) en cada carpeta y artículo.

## Impact

- **Código afectado**:
  - `app/src/index.css`: Reglas de layout para `.tree-children-accordion`, `.tree-children-inner`, `.tree-node-wrapper`, `.tree-row`, `.tree-title`, `.tree-row-actions` y `.btn-tree-row-menu`.
  - `app/src/components/tree/TreeView.tsx`: Atributos de accesibilidad, manejo de focus y consistencia en el renderizado de acciones por fila.
- **APIs y Base de Datos**: Sin cambios en el esquema ni en las APIs de base de datos Dexie/IndexedDB.
- **Riesgo**: Bajo; mejora directa de usabilidad e interactividad en la barra lateral sin efectos secundarios sobre el almacenamiento de datos.
