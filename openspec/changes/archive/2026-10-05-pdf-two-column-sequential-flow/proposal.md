# Proposal

## Why

Al exportar un artículo a PDF en 2 columnas, el orden de lectura no coincide con la "Vista 2 Columnas (Word)" del lector. En pantalla el contenido fluye de forma continua (columna izquierda de arriba hacia abajo y luego la derecha, con los títulos de sección dentro de la columna). En el PDF, cada título de sección (`h1`) ocupa todo el ancho y corta el flujo: queda "título + dos columnas balanceadas" por cada sección, así que el contenido de una misma sección salta de columna sin seguir una secuencia natural hacia abajo y el resultado no se parece a lo que el usuario ve.

## What Changes

- El PDF/impresión en modo 2 columnas SHALL usar el mismo flujo continuo que la vista de 2 columnas en pantalla: los títulos de sección (`h1`) quedan dentro de la columna, no abarcando ambas.
- El encabezado del documento impreso (marca, fecha, título del artículo, ruta) sigue a ancho completo arriba de la primera página; solo cambia el cuerpo.
- Se elimina la regla de impresión `column-span: all` sobre `.reader-heading.h1`. Sin código nuevo.
- El modo 1 columna no cambia.

## Capabilities

### New Capabilities

_(ninguna)_

### Modified Capabilities

- `templates`: el requisito "Maquetación editorial a 2 columnas y estilo clínico" pasa a exigir que la exportación a PDF en 2 columnas mantenga el mismo orden de lectura continuo que el lector en pantalla.

## Impact

- `app/src/index.css` (bloque `@media print`, regla `.reader-heading.h1`).
- `app/e2e/vital.spec.ts`: se puede agregar una aserción para que el `h1` impreso no tenga `column-span: all`.
- Sin cambios de API, datos ni dependencias.
