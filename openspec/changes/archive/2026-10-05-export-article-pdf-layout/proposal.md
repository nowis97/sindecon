## Why

Los profesionales de la salud y estudiantes que utilizan SINDECON necesitan compartir e imprimir artículos clínicos, resúmenes de guardia y algoritmos diagnósticos en formato PDF de alta fidelidad, adaptados para lectura continua (1 columna) o como fichas clínicas de bolsillo / resúmenes médicos compactos (2 columnas).

Actualmente no existe una opción dedicada para exportar artículos individuales a PDF con control de maquetación, lo que dificulta la impresión limpia y la generación de documentos portables para guardias o sesiones clínicas.

## What Changes

- **Exportación de artículos a PDF con selector de maquetación**:
  - Modal o menú de exportación a PDF accesible desde la barra del artículo y el modo lector.
  - Selección interactiva entre dos estilos de diseño:
    - **1 Columna (Lectura continua / Formato estándar)**: Diseño lineal con espaciado óptimo para lectura secuencial y artículos extensos.
    - **2 Columnas (Ficha médica / Resumen compacto)**: Diseño condensado estilo Word/UptoDate para optimizar el espacio en papel y consultas rápidas en guardia.
  - Opciones de exportación configurables:
    - Incluir o excluir encabezado clínico con fecha y ruta de carpetas (breadcrumbs).
    - Incluir o excluir etiquetas (tags) del artículo.
- **Optimización de estilos de impresión (`@media print`)**:
  - Reglas CSS de maquetación de impresión sin cortes bruscos en tablas, diagramas Mermaid, callouts y cuadros de dosis (`break-inside: avoid`).
  - Encabezado y pie de página limpios y nítidos con tipografía médica de alta legibilidad.
  - Ocultación automática de elementos de interfaz (barras laterales, botones, toggles de edición).
- **Ejecución y compatibilidad Offline**:
  - Disparo nativo de impresión / Guardar como PDF del navegador (`window.print()`), compatible en desktop y dispositivos móviles (iOS / Android / PWA).

## Capabilities

### Modified Capabilities
- `data-portability`: Se añade el requisito de exportación de artículos individuales a PDF con selección de maquetación en 1 o 2 columnas.

## Impact

- **Código afectado**:
  - `app/src/components/portability/ExportPdfModal.tsx` (Nuevo): Modal interactivo con vista previa y selección de columnas/opciones.
  - `app/src/components/reader/ArticleReader.tsx`: Integración del botón de exportación PDF en la barra de herramientas del lector.
  - `app/src/App.tsx`: Botón de acción rápida "🖨️ PDF" en la cabecera del artículo.
  - `app/src/index.css`: Reglas `@media print` optimizadas para 1 columna y 2 columnas (`.print-layout-single`, `.print-layout-two-columns`).
  - `app/e2e/vital.spec.ts`: Test E2E para el modal y flujo de exportación PDF.
- **Dependencias**: Ninguna dependencia pesada externa (se aprovecha el motor de impresión nativo del navegador con CSS print layout de alta fidelidad).
