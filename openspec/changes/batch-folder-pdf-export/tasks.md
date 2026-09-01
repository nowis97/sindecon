## 1. Utilidades de Recolección y Carga por Lote

- [ ] 1.1 Implementar función helper recursiva `getFolderDescendantArticles(nodes, folderId)` para recolectar todos los artículos dentro de una carpeta y sus subcarpetas en orden jerárquico.
- [ ] 1.2 Implementar función de carga en lote `getArticlesByIds(ids)` en `db/nodes.ts` para recuperar contenidos de IndexedDB de manera eficiente y verificar con tests unitarios.

## 2. Componente de UI: Modal de Exportación Consolidada de Carpeta

- [ ] 2.1 Crear el componente `ExportFolderPdfModal.tsx` con checklist interactivo de artículos, selección de 1/2 columnas y opciones de portada/índice temático.
- [ ] 2.2 Integrar el botón "🖨️ Exportar Carpeta a PDF" en `FolderView.tsx` y la opción en el menú contextual de carpetas en `TreeView.tsx`.

## 3. Renderizado de Impresión Consolidada y Estilos CSS Paged Media

- [ ] 3.1 Implementar en `App.tsx` la estructura del documento consolidado `#print-batch-document` con portada, índice de contenidos (TOC) y bloques de artículos renderizados con `ArticleReader`.
- [ ] 3.2 Añadir estilos `@media print` en `index.css` con `break-after: page;` entre artículos, numeración de temas y maquetación de 1 y 2 columnas.
- [ ] 3.3 Configurar el nombre sugerido del archivo PDF (`<Nombre_Carpeta> - Compendio SINDECON.pdf`) mediante `document.title` dinámico en `window.print()`.

## 4. Verificación y Pruebas

- [ ] 4.1 Añadir prueba E2E en Playwright para el flujo completo de exportación de carpeta a PDF (apertura de modal, selección de artículos, verificación de maquetación y llamada a `window.print`).
- [ ] 4.2 Ejecutar `npm test`, `npx playwright test` y `npm run build` confirmando 100% de pruebas aprobadas y compilación limpia.
