# Tasks

## 1. Componente Modal de Selección y Configuración (`BulkExportPdfModal.tsx`)

- [x] 1.1 Crear el componente `BulkExportPdfModal` con buscador en tiempo real, filtrado por carpetas y etiquetas, selector de maquetación (1 vs 2 columnas), opciones (cabecera, etiquetas, salto de página entre notas, título del compendio), botones de selección masiva y contador dinámico, verificando compilación con `cd app; npx tsc -b`.
- [x] 1.2 Añadir pruebas unitarias para `BulkExportPdfModal` verificando el filtrado por búsqueda, selección individual y múltiple, conteo reactivo y emisión de opciones de exportación al confirmar, ejecutando `npm --prefix app test`.

## 2. Motor de Impresión Multidocumento y Puntos de Entrada UI (`App.tsx`, `PortabilityBar.tsx`, `index.css`)

- [x] 2.1 Añadir estilos `@media print` para el contenedor multidocumento `#print-bulk-document`, clases de salto de página (`.print-bulk-article-item` con `break-before: page`), maquetación de 1 y 2 columnas y ocultamiento en pantalla en `app/src/index.css`, verificando con `npm --prefix app run build`.
- [x] 2.2 Integrar `BulkExportPdfModal` y el renderizado secuencial `#print-bulk-document` en `app/src/App.tsx` junto con la carga de artículos desde IndexedDB, asignación de `document.title`, activación de clases en `document.body` y disparo de `window.print()`, verificando con `cd app; npx tsc -b`.
- [x] 2.3 Añadir el botón disparador "🖨️ Exportar PDF" en `app/src/components/portability/PortabilityBar.tsx` y en el menú de carpetas de la barra lateral para abrir el modal (con preselección automática si se invoca desde una carpeta), verificando con `npm --prefix app test` y `npm --prefix app run build`.
