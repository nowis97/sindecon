# Proposal: Ajustar tipografía e interlineado en exportación a PDF

## Why

Al exportar o imprimir artículos médicos a PDF, los usuarios necesitan una densidad tipográfica aún más compacta para aprovechar al máximo el espacio en papel, reducir el número total de hojas impresas y evitar cortes innecesarios. Actualmente, los textos base varían entre 10pt (1 columna) y 9.5pt (2 columnas) con interlineados de 1.30 a 1.35, y un espaciado amplio tras el título principal, lo que consume espacio vertical valioso en consultas y fichas clínicas de bolsillo.

## What Changes

- Unificar el tamaño de fuente base de los párrafos en `9pt` tanto para maquetación en 1 columna como en 2 columnas en `@media print`.
- Establecer el interlineado (`line-height`) de los párrafos en `1` (o equivalente unitless `1` / `100%`) para máxima compacidad en impresión.
- Disminuir el espaciado vertical / margen inferior después del título del artículo y la cabecera médica impresa (`.print-article-header` y `.print-article-title`) para que el contenido clínico comience inmediatamente más arriba.

## Capabilities

### New Capabilities
<!-- Ninguna nueva capacidad -->

### Modified Capabilities
- `data-portability`: Se modifica el requisito de *Exportación de artículos individuales a PDF con selección de maquetación* para estipular texto base de párrafos en `9pt`, interlineado de párrafos en `1`, y espaciado compacto tras el título del artículo.

## Impact

- `app/src/index.css`: Reglas `@media print` para `#print-article-document`, `.print-layout-single`, `.print-layout-two-columns`, `.print-article-header`, `.print-article-title` y `.reader-paragraph`.
- No requiere dependencias nuevas ni cambios en base de datos.
