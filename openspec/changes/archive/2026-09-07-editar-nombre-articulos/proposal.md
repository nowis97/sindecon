## Why

Actualmente, para editar o renombrar el título de un artículo, el usuario debe recurrir obligatoriamente al menú contextual (`···`) en la barra lateral del árbol de conocimientos (`TreeView`). Cuando el usuario está leyendo o editando un artículo con la barra lateral colapsada o en dispositivos móviles, o explorando el contenido de una carpeta en `FolderExplorerView`, no existe un acceso directo para cambiar el nombre del artículo abierto sin tener que buscarlo nuevamente en el árbol.

Esta propuesta introduce la capacidad de renombrar artículos directamente desde la cabecera del artículo en el lector/editor y desde las tarjetas de artículos en la vista exploradora de carpetas, reutilizando el diálogo interactivo de renombrado ya existente en la aplicación.

## What Changes

- **Renombrado directo desde la cabecera del artículo (`App.tsx`):**
  - Añadir un botón accesible de renombrado (`btn-article-rename`, icono `✏️`) junto al título del artículo (`.article-title-wrapper`) tanto en modo lectura como en modo edición.
  - Al pulsar el botón, se abre el diálogo modal existente (`InputDialog` con `promptState.type = 'rename-node'`), precargando el título actual para su edición inmediata.
- **Acción de renombrado en tarjetas de artículo de la vista de carpeta (`FolderExplorerView.tsx`):**
  - Añadir un botón de acción rápida para renombrar en la fila superior de cada tarjeta de artículo (`.article-card-top-row`).
  - Pasar la función `onRenameNode` desde `App.tsx` hacia `FolderExplorerView`.
- **Actualización reactiva del título:**
  - Al confirmar el nuevo nombre, se persiste atómicamente vía `renameNode(id, title)` en IndexedDB, reflejándose en tiempo real en la cabecera del visor, en la pestaña/título y en el árbol de navegación.

## Capabilities

### Modified Capabilities
- `knowledge-tree`: Extender el requisito `Operaciones sobre nodos` para incluir escenarios de renombrado de artículos directamente desde la cabecera del visor del artículo y desde la vista exploradora de carpetas.

## Impact

- **Componentes Afectados:**
  - `app/src/App.tsx`: Incorporación del botón de renombrado en `article-title-wrapper` y propagación de `onRenameNode` a `FolderExplorerView`.
  - `app/src/components/tree/FolderExplorerView.tsx`: Soporte de la prop `onRenameNode` y botón de edición en la tarjeta de artículo.
  - `app/src/index.css`: Estilos visuales para `btn-article-rename` y `btn-card-rename` coherentes con el diseño de la aplicación y la densidad Obsidian Vault.
- **Pruebas y Verificación:**
  - Tests en Playwright verificando el flujo de renombrado de artículo desde la cabecera y desde el explorador de carpetas.
