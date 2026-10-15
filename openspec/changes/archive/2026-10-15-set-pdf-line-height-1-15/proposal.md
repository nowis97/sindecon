# Proposal: Ajustar interlineado de párrafos a 1.15 en exportación a PDF

## Why

Un interlineado unitario estricto (`line-height: 1`) maximiza la compacidad en papel pero puede reducir el confort visual en párrafos extensos, donde los trazos ascendentes y descendentes de las letras se tocan o quedan excesivamente pegados. Configurar el interlineado a `1.15` proporciona un equilibrio perfecto entre alta densidad de contenido y legibilidad médica profesional en documentos impresos.

## What Changes

- Modificar el interlineado (`line-height`) de los párrafos (`.reader-paragraph`) en la vista de impresión (`@media print`) estableciéndolo en `1.15`.
- Actualizar los contenedores de maquetación de 1 y 2 columnas (`.print-layout-single .print-reader-view`, `.print-layout-two-columns .print-reader-view`) a `line-height: 1.15 !important;` para mantener consistencia tipográfica en todo el flujo de texto.

## Capabilities

### New Capabilities
<!-- Ninguna nueva capacidad -->

### Modified Capabilities
- `data-portability`: Se modifica el requisito de *Exportación de artículos individuales a PDF con selección de maquetación* para especificar un interlineado de `1.15` en párrafos y flujo de texto impreso.

## Impact

- `app/src/index.css`: Reglas de impresión en `.reader-paragraph`, `.print-layout-single` y `.print-layout-two-columns`.
