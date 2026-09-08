## Context

En SINDECON, la mutación de títulos de nodos está implementada de manera robusta y atómica a través de `renameNode(id, title)` en `app/src/db/nodes.ts`. Además, `App.tsx` ya cuenta con el manejador `handleOpenRenamePrompt(nodeId)` y el diálogo modal `InputDialog` con soporte para validación, confirmación y cancelación.

Sin embargo, el disparador para abrir este diálogo solo está conectado al menú contextual (`···`) de cada elemento en `TreeView.tsx`. En la vista principal del artículo (`article-header-row`) y en la vista de carpetas (`FolderExplorerView.tsx`), los usuarios no tienen forma directa de renombrar un artículo. Ver `proposal.md` para la motivación.

## Goals / Non-Goals

**Goals:**
- Proporcionar un botón accesible de renombrado (`btn-article-rename`) junto al título en la cabecera del visor/editor (`.article-title-wrapper`).
- Proporcionar un botón de renombrado (`btn-card-rename`) en las tarjetas de artículo de la vista exploradora de carpetas (`FolderExplorerView`).
- Reutilizar el flujo existente de `handleOpenRenamePrompt` y `InputDialog` para garantizar consistencia visual y de comportamiento.
- Mantener la estética minimalista y de alta densidad estilo Obsidian Vault.

**Non-Goals:**
- Implementar edición inline (tipo `contenteditable` o reemplazo por `<input>`) sobre el encabezado `h1`: esto añadiría complejidad innecesaria de manejo de foco, `blur`, `Escape`/`Enter`, y causaría ediciones accidentales al seleccionar texto o hacer scroll en pantallas táctiles móviles.
- Modificar el esquema de base de datos o almacenamiento en IndexedDB (el método `renameNode` existente ya actualiza `title` y `updated_at`).

## Decisions

### Decisión 1: Botón de acción con diálogo modal frente a edición inline
- **Elección**: Añadir un botón `btn-article-rename` (`✏️`) en `.article-title-wrapper` que invoca `handleOpenRenamePrompt(selected.id)`.
- **Alternativa descartada**: Convertir el título `h1` en un campo editable inline al hacer clic. Se descartó por ser más propenso a errores (edición accidental en móvil, conflictos al seleccionar texto para copiar) y porque `InputDialog` ya ofrece una experiencia validada con soporte para teclado y cancelación limpia (aplicando la regla Ponytail de reutilizar componentes probados).

### Decisión 2: Propagación de `onRenameNode` en `FolderExplorerView`
- **Elección**: Declarar la prop opcional `onRenameNode?: (id: string) => void` en `FolderExplorerViewProps` y pasarle `handleOpenRenamePrompt` desde `App.tsx`.
- **Alternativa descartada**: Añadir un menú contextual flotante completo a cada tarjeta. Se descartó por ser excesivo para el objetivo específico de renombrado rápido; un botón de icono discreto en `.article-card-top-row` junto a favoritos resuelve la necesidad con mínima complejidad.

### Decisión 3: Detener propagación de eventos en las tarjetas de carpeta
- **Elección**: Al hacer clic en `btn-card-rename`, ejecutar `e.stopPropagation()` para evitar que el evento se propague al contenedor de la tarjeta (el cual navega al artículo vía `onSelectNode`).
- **Alternativa descartada**: Separar la tarjeta en dos áreas de clic. Resultaría en un layout menos intuitivo y más rígido.

## Risks / Trade-offs

- **Riesgo:** Conflicto de clic entre la navegación de la tarjeta y el botón de renombrar en `FolderExplorerView`.
  - **Mitigación:** Asegurar `e.stopPropagation()` explícito en el manejador `onClick` del botón de renombrado en la tarjeta.
- **Riesgo:** Desbordamiento visual en títulos extremadamente largos en pantallas móviles estrechas.
  - **Mitigación:** Configurar `.article-title-wrapper` con `flex-wrap: wrap; align-items: center; gap: 8px;` y asegurar que los botones de acción (`btn-article-rename` y `btn-fav-star`) tengan un tamaño táctil adecuado (mínimo 32x32px) sin desalinear el texto.
