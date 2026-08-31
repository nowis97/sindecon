## Context

Ver `proposal.md` para la motivación. Actualmente los artículos de SINDECON se leen en `ArticleReader.tsx`, que soporta vista de 1 o 2 columnas en pantalla. Para exportar a PDF, los usuarios requieren un mecanismo accesible tanto desde la barra superior del artículo como desde la vista de lectura, permitiendo imprimir o guardar como PDF en alta fidelidad y con control de maquetación en papel.

## Goals / Non-Goals

**Goals:**
- Proporcionar un modal interactivo `ExportPdfModal.tsx` con selección de maquetación (1 Columna vs 2 Columnas).
- Permitir personalizar opciones como inclusión de cabecera médica (título, fecha, ruta breadcrumbs) y etiquetas del artículo.
- Aplicar estilos `@media print` de alta calidad que eviten cortes accidentales en tablas, esquemas Mermaid y llamadas de atención (`break-inside: avoid;`).
- Disparar la exportación/impresión nativa del navegador mediante `window.print()` con clases dinámicas en el contenedor de impresión.

**Non-Goals:**
- No añadir librerías pesadas en el bundle del cliente (como `jsPDF` o `html2canvas` de 2MB+), manteniendo la aplicación ultraligera y garantizando fidelidad nativa de fuentes vectoriales y diagramas.
- No procesar PDFs en servidores externos (arquitectura 100% offline-first y privada en el navegador).

## Decisions

### 1. Modal interactivo `ExportPdfModal.tsx`
- **Decisión**: Crear un modal accesible desde el botón "🖨️ PDF" en la cabecera del artículo y en la barra del lector.
- **Razón**: Permite al usuario previsualizar las opciones (1 o 2 columnas, incluir metadatos clínicos) antes de disparar la ventana de impresión del sistema operativo.
- **Alternativa descartada**: Disparar `window.print()` inmediatamente sin preguntar columnas. Descartada porque los médicos frecuentemente necesitan alternar entre ficha de resumen (2 col) y documento formal extenso (1 col).

### 2. Maquetación CSS de impresión con clases dinámicas
- **Decisión**: Inyectar temporalmente en el contenedor de impresión las clases `.print-columns-1` o `.print-columns-2` según la elección del usuario y disparar `window.print()`.
- **Razón**: Los navegadores modernos renderizan `@media print` con CSS multicolumn (`column-count: 2`, `column-gap: 20px`) o flex/grid con máxima nitidez tipográfica y soporte nativo para guardar como PDF en cualquier resolución.

### 3. Persistencia de preferencia de exportación
- **Decisión**: Guardar la última opción de columna seleccionada en `localStorage` (`sindecon_pdf_layout_columns: '1' | '2'`).
- **Razón**: Ahorra clics al usuario en exportaciones consecutivas.

## Risks / Trade-offs

- **[Riesgo] Variaciones entre motores de impresión de navegadores (Chromium vs WebKit)**:
  - *Mitigación*: Utilizar reglas estándar CSS Paged Media (`@page { margin: 12mm 15mm; size: auto; }`, `break-inside: avoid-page;`) probadas en Chrome, Edge, Firefox y Safari.
