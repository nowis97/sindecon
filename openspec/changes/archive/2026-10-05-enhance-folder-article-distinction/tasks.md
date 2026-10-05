## 1. Componente FolderExplorerView

- [x] 1.1 Crear `app/src/components/tree/FolderExplorerView.tsx` con soporte para listado de subcarpetas con contador, listado de artículos con etiquetas, acciones rápidas y estado vacío ilustrado.
- [x] 1.2 Integrar `FolderExplorerView` en `app/src/App.tsx` en reemplazo del bloque simple `folder-view-card` cuando `selected.kind === 'folder'`.

## 2. Diferenciación Visual en TreeView y Breadcrumbs

- [x] 2.1 Actualizar `app/src/components/tree/TreeView.tsx` agregando clases distintivas `.tree-folder-row` y `.tree-article-row`, chips contadores para carpetas y refinamiento de iconos.
- [x] 2.2 Actualizar `app/src/components/tree/Breadcrumbs.tsx` para distinguir visualmente segmentos de carpetas y el nodo terminal de artículo.

## 3. Estilos CSS y Responsividad

- [x] 3.1 Añadir estilos para `FolderExplorerView` (tarjetas de subcarpetas con estética de pestaña de carpeta, tarjetas de artículos médicos con tags, cabecera de estadísticas y barra de acciones) en `app/src/index.css`.
- [x] 3.2 Añadir estilos y animaciones refinadas para `.tree-folder-row`, `.tree-folder-count-badge`, `.tree-article-row` y líneas de conexión jerárquicas en `app/src/index.css`.
- [x] 3.3 Garantizar adaptabilidad móvil (`< 640px`) para el explorador de carpetas y el árbol lateral.

## 4. Verificación y Pruebas E2E

- [x] 4.1 Ejecutar suite de pruebas unitarias (`npm test`) y verificar que todos los tests pasen.
- [x] 4.2 Ejecutar suite E2E de Playwright (`npx playwright test`) y verificar que los flujos de creación, navegación y movimiento de carpetas y artículos se mantengan 100% funcionales.
- [x] 4.3 Auditar visualmente con Chrome DevTools en escritorio (`1200x800`) y móvil (`390x844`).
