# Design: Visibilidad y Contención de Opciones en el Árbol Lateral (Sidebar)

## Context

Diagnóstico realizado en tiempo real mediante Chrome DevTools en la aplicación en ejecución:
- En `TreeView.tsx` y `index.css`, cada fila de nodo (`.tree-row`) contiene un botón de opciones (`.btn-tree-row-menu`, `···`) alojado en `.tree-row-actions` con `margin-left: auto`.
- **Causa raíz 1 (Desbordamiento de contenedor Grid)**: La animación de acordeón de subcarpetas (`.tree-children-accordion`) utiliza CSS Grid (`display: grid; grid-template-rows: 1fr`). Por especificación CSS Grid, un hijo directo (`.tree-children-inner`) tiene por defecto `min-width: auto`. En consecuencia, se expande al tamaño intrínseco de su elemento hijo más largo (en este caso, títulos médicos de plantillas como *"Concepto / Anatomía / Fisiología / Fisiopatología"* que alcanzan 384px+ de ancho). Como la barra lateral (`.sidebar`) tiene ancho fijo de 320px y `.tree-view` tiene `overflow-x: hidden`, las filas se expanden a 384px y `.tree-row-actions` se desplaza hasta `left: ~365px`, quedando completamente recortado y fuera de la pantalla.
- **Causa raíz 2 (Ocultamiento predeterminado por opacidad)**: En `index.css`, `.btn-tree-row-menu` tiene `opacity: 0` y solo adquiere `opacity: 1` en `.tree-row:hover` o `.btn-tree-row-menu.active`. En dispositivos táctiles, pantallas móviles o sin cursor posicionado exactamente sobre la fila, el botón resulta 100% invisible.

## Goals / Non-Goals

**Goals:**
- Garantizar que el botón de opciones (`···`) sea permanentemente visible, reconocible y accionable para cualquier carpeta y artículo del árbol.
- Establecer contención estricta de ancho (`min-width: 0`, `width: 100%`) en todos los niveles del árbol para que los títulos extensos se trunquen con elipsis (`text-overflow: ellipsis`) sin forzar scroll horizontal ni empujar las acciones fuera del viewport de 320px.
- Mantener la accesibilidad por teclado (`:focus-visible`), soporte táctil móvil y desktop sin regresiones en las funcionalidades existentes de arrastrar y soltar (drag & drop) o acordeones animados.

**Non-Goals:**
- Modificar el ancho base del sidebar (se mantiene en 320px).
- Alterar la lógica interna de los diálogos modales o el almacenamiento de nodos en Dexie/IndexedDB.
- Habilitar menú de opciones destructivas sobre la carpeta del sistema `Plantillas` (las plantillas conservan su condición de carpetas protegidas del sistema, mientras que sus artículos hijos sí disponen de opciones completas).

## Decisions

### Decisión 1: Contención estricta de CSS Grid y Flexbox en el árbol
- **Elección**: Aplicar `min-width: 0; width: 100%;` a `.tree-children-accordion`, `.tree-children-inner`, `.tree-node-wrapper` y asegurar `width: 100%; box-sizing: border-box;` en `.tree-row`.
- **Razón**: Permite que el cálculo de `flex: 1; min-width: 0;` en `.tree-title` se respete fielmente contra el ancho disponible del contenedor padre (320px menos padding), truncando el texto con elipsis antes de empujar `.tree-row-actions`.
- **Alternativas consideradas**:
  - *Usar `overflow-x: auto` en la barra lateral*: Descartado porque introduce barras de desplazamiento horizontales antiestéticas que arruinan la experiencia Obsidian-like.
  - *Fijar un `max-width` en píxeles a `.tree-title`*: Descartado porque no se adapta a los diferentes niveles de indentación (`paddingLeft: 8 + depth * 16`).

### Decisión 2: Visibilidad persistente y estados de contraste para `.btn-tree-row-menu`
- **Elección**: Definir una opacidad base visible en reposo (`opacity: 0.65` o similar) con color legible `var(--text-muted)` y transición suave hacia `opacity: 1` con fondo sutil en `:hover`, `:focus-visible` y cuando el menú esté activo (`.active`).
- **Razón**: Satisface el requerimiento estricto del usuario ("si o si se debe ver las opciones de cada carpeta o articulo") sin sobrecargar visualmente la lista cuando hay muchos elementos, garantizando usabilidad inmediata en dispositivos táctiles.
- **Alternativas consideradas**:
  - *Mantener `opacity: 0` pero mostrarlo solo en touch con media query `@media (hover: none)`*: Descartado porque el usuario solicitó expresamente que sea visible siempre en el sidebar.

### Decisión 3: Estabilidad del menú contextual flotante
- **Elección**: Mantener el anclaje del menú contextual (`.tree-context-menu`) anclado a la posición del botón con `z-index: 99999` y la lógica de detección vertical (`setMenuPlacement('up' | 'down')`) para evitar que se desborde fuera de la ventana.

## Risks / Trade-offs

- **[Riesgo] Títulos profundos tienen menor ancho visual**: Con niveles altos de anidación (`depth >= 3`), el padding acumulado reduce el espacio disponible para el texto.
  - *Mitigación*: `.tree-title` mantiene `title={node.title}` para ver el nombre completo en tooltip nativo, y `.tree-row-actions` tiene `flex-shrink: 0` para no comprimirse jamás.
- **[Riesgo] Sobrecarga visual si el botón es demasiado llamativo**:
  - *Mitigación*: Usar opacidad balanceada (`0.65`) y fondo transparente en reposo, reservando el fondo destacado para el hover o focus.
