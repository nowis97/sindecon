## 1. Componente y Modal de Exportación PDF

- [x] 1.1 Crear el componente `app/src/components/portability/ExportPdfModal.tsx` con selección de maquetación (1 Columna vs 2 Columnas), opciones de metadatos clínicos y disparador de impresión, y verificar compilación TypeScript.

## 2. Integración en Vistas del Artículo

- [x] 2.1 Añadir el botón "🖨️ PDF" en `app/src/App.tsx` y en `app/src/components/reader/ArticleReader.tsx` para abrir el modal `ExportPdfModal` pasando el nodo activo y su contenido.
- [x] 2.2 Implementar en el flujo de exportación la asignación de clases `.print-layout-single` / `.print-layout-two-columns` en el contenedor del artículo y disparar `window.print()`.

## 3. Estilos CSS de Impresión y Paginación

- [x] 3.1 Añadir reglas `@media print` en `app/src/index.css` para maquetación nítida en 1 y 2 columnas (`column-count: 2`), ocultación de barras de navegación y prevención de saltos de página dentro de tablas y callouts (`break-inside: avoid`).

## 4. Verificación y Pruebas

- [x] 4.1 Añadir test E2E en Playwright en `app/e2e/vital.spec.ts` que valide la apertura del modal `ExportPdfModal`, el cambio entre 1 y 2 columnas y la preparación para impresión.
- [x] 4.2 Ejecutar la suite completa de pruebas (`npm test` y `npx playwright test`) y verificar que todos los tests pasen limpiamente.
