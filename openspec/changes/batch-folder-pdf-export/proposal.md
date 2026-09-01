## Why

Actualmente, SINDECON permite exportar artículos individuales a PDF en 1 o 2 columnas con maquetación de alta fidelidad clínica. Sin embargo, los médicos y estudiantes a menudo necesitan generar compendios temáticos completos (por ejemplo, un libro o dossier de "Cardiología", "Urgencias" o un conjunto seleccionado de artículos de repaso) en un único PDF consolidado con portada, índice temático (tabla de contenidos) y saltos de página limpios entre artículos.

Poder exportar una carpeta completa (con sus subcarpetas y artículos ordenados) o una selección múltiple de artículos en un solo documento imprimible optimiza el estudio offline, la impresión de cuadernos de especialidad y el intercambio con colegas.

## What Changes

- **Exportación de Carpeta a PDF**: Acción "Exportar carpeta a PDF" en el menú contextual de carpetas del árbol de conocimientos y en la vista de explorador de carpetas (`FolderView`).
- **Modal de Configuración de Exportación por Lote**:
  - Lista de verificación interactiva para incluir/excluir artículos específicos de la carpeta o subcarpetas recursivas.
  - Selección de maquetación (1 columna continua o 2 columnas tipo ficha médica / Word).
  - Opciones adicionales: incluir Portada/Índice de contenidos (TOC), encabezados de ruta y numeración de temas.
- **Documento de Impresión Consolidado**:
  - Portada clínica limpia con el nombre de la carpeta/especialidad, total de artículos y fecha.
  - Tabla de contenidos (Índice temático) con lista de artículos y sus etiquetas.
  - Renderizado secuencial de cada artículo con maquetación Markdown, tablas, callouts, alertas y fórmulas KaTeX.
  - Saltos de página forzados (`break-after: page;` / `page-break-after: always;`) entre artículos para evitar que el contenido de un tema se mezcle con el siguiente.
  - Nombre sugerido automático del archivo PDF: `<Nombre_Carpeta> - Compendio SINDECON.pdf`.

## Capabilities

### Modified Capabilities
- `data-portability`: Se añaden requisitos para la exportación por lote/carpeta de artículos médicos a PDF consolidado con índice, saltos de página y opciones de maquetación.
- `knowledge-tree`: Se añade la acción de exportación a PDF en el menú contextual de carpetas y en la barra de herramientas del explorador de carpetas.

## Impact

- **Componentes Afectados**:
  - `FolderView.tsx`: Botón en la barra de acciones para exportar la carpeta completa a PDF.
  - `TreeView.tsx`: Opción en el menú contextual de carpetas (`ContextMenu`).
  - `ExportPdfModal.tsx` o nuevo `ExportBatchPdfModal.tsx`: Selector de artículos incluidos, vista previa de temas y maquetación.
  - `App.tsx`: Generación del documento DOM consolidado `#print-batch-document` para `window.print()`.
  - `index.css`: Estilos `@media print` para saltos de página entre artículos múltiples, portada e índice temático.
- **Dependencias**: Ninguna nueva librería requerida. Utiliza el motor nativo de impresión y estilos CSS `@media print` de alta fidelidad.
