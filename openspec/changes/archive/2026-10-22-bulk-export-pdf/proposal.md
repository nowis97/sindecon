# Proposal

## Why

Actualmente, SINDECON solo permite exportar a PDF o imprimir artículos clínicos de manera individual desde la vista del artículo activo (`ExportPdfModal`), o bien realizar un respaldo masivo completo en formato ZIP con Markdown. Los profesionales de la salud requieren generar dossiers, resúmenes temáticos, guías de rotación y fichas de estudio agrupando varios artículos clínicos específicos en un único documento PDF unificado de alta fidelidad, sin tener que imprimir nota por nota de forma manual.

## What Changes

- **Modal interactivo de Exportación Masiva a PDF (`BulkExportPdfModal`)**:
  - Interfaz de selección múltiple con buscador en tiempo real por título y filtrado por carpetas y etiquetas.
  - Opciones de selección rápida: "Seleccionar todos", "Deseleccionar todos" y selección selectiva por carpeta o artículo individual, con contador dinámico de artículos seleccionados.
  - Configuración de maquetación clínica heredada: elección entre **1 Columna (Lectura continua)** y **2 Columnas (Ficha médica / Resumen compacto)**.
  - Opciones del compendio: incluir cabeceras médicas individuales, incluir etiquetas de artículos, salto de página automático entre artículos (`page-break-before: always`), y título personalizado del compendio para el nombre sugerido del PDF al guardar.
- **Contenedor de Impresión Multidocumento (`#print-bulk-document`)**:
  - Renderizado secuencial de todos los artículos seleccionados con sus títulos, metadatos, migas de pan y cuerpo Markdown parseado mediante `ArticleReader`.
  - Aplicación de reglas `@media print` para saltos de página limpios entre artículos y respeto estricto del estilo de 1 o 2 columnas clínicas.
- **Acceso en la interfaz**:
  - Botón "🖨️ Exportar PDF" en la barra de herramientas de portabilidad (`PortabilityBar`) y opción en el menú contextual / encabezado de carpetas para abrir el selector con los artículos de dicha carpeta preseleccionados.

## Capabilities

### New Capabilities

<!-- Ninguna capacidad nueva independiente; se amplía data-portability. -->

### Modified Capabilities

- `data-portability`: Se añade el requisito de exportación masiva de artículos seleccionados a documento PDF combinado con maquetación clínica y salto de página inter-artículo.

## Impact

- **`app/src/components/portability/BulkExportPdfModal.tsx`**: Nuevo componente modal para la selección múltiple de artículos clínicos y configuración de maquetación del compendio PDF.
- **`app/src/components/portability/PortabilityBar.tsx`**: Botón para invocar la exportación masiva a PDF.
- **`app/src/App.tsx`**: Estado reactivo para el modal de exportación masiva, montaje del contenedor secuencial `#print-bulk-document` y disparador `window.print()`.
- **`app/src/index.css`**: Estilos `@media print` para `#print-bulk-document`, separación limpia de páginas y compatibilidad con 1 y 2 columnas.
- **`app/src/components/portability/BulkExportPdfModal.test.ts` / tests de dominio**: Pruebas unitarias para la selección, filtrado y renderizado del lote de artículos para impresión.
