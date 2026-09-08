## 1. Implementación de Interfaz de Usuario y Acciones

- [x] 1.1 Incorporar el botón de renombrado `btn-article-rename` junto al título del artículo en `App.tsx` enlazado a `handleOpenRenamePrompt(selected.id)`.
- [x] 1.2 Extender `FolderExplorerViewProps` con `onRenameNode?: (id: string) => void` y añadir el botón `btn-card-rename` con `e.stopPropagation()` en las tarjetas de artículo en `FolderExplorerView.tsx`.
- [x] 1.3 Conectar la prop `onRenameNode={(id) => handleOpenRenamePrompt(id)}` en la invocación de `FolderExplorerView` dentro de `App.tsx`.
- [x] 1.4 Definir las reglas de estilo CSS para `btn-article-rename` y `btn-card-rename` en `app/src/index.css` asegurando consistencia con la estética Obsidian y soporte táctil móvil.

## 2. Pruebas y Verificación

- [x] 2.1 Añadir o actualizar pruebas para verificar la interacción del botón de renombrado en cabecera y en tarjeta sin propagación de clic no deseada.
- [x] 2.2 Ejecutar la suite de pruebas unitarias (`npm run test:unit`) y el build de TypeScript (`npm run build`) verificando que compilan exitosamente sin advertencias.
