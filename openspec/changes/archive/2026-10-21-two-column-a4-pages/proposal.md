# Proposal: Paginación en Hojas A4 para Modo Vista a Dos Columnas

## Why

En la actualidad, al activar el modo de dos columnas en el visor de lectura (`ArticleReader`), todo el documento se vuelca en una única caja infinita que se extiende verticalmente hacia abajo. Esto diluye la sensación de hoja de papel y no coincide con la experiencia ni con los márgenes compactos de la exportación a PDF.

El usuario necesita que el modo vista a 2 columnas se renderice estructurado en **hojas A4 discretas** (Página 1, Página 2, etc.), con una **separación física visible** entre cada página y con los **mismos márgenes acotados de la exportación a PDF** (`7mm` vertical y `10.5mm` lateral).

## What Changes

- **Paginación en hojas discretas en modo 2 columnas**: El contenido del artículo en vista de 2 columnas se distribuye secuencialmente en hojas A4 independientes (210mm × 297mm). El texto fluye llenando la columna izquierda y luego la derecha de la hoja actual, pasando a una nueva hoja física cuando se alcanza la capacidad de la página.
- **Separación física real entre hojas**: Las hojas A4 sucesivas se representan como piezas de papel separadas con un espacio físico visual sobre el fondo del lienzo, elevación perimetral con sombras suaves, bordes definidos y separadores/etiquetas de página.
- **Márgenes acotados idénticos a la exportación**: Se ajusta el espaciado interno de las hojas del modo a dos columnas a `padding: 7mm 10.5mm` (exactamente la misma configuración de `@page { margin: 7mm 10.5mm; }` utilizada en la exportación e impresión PDF).
- **Tipografía e interlineado optimizados para ficha médica**: En el modo de 2 columnas, los textos y párrafos adoptan la densidad tipográfica compacta de la exportación (interlineado ~1.15 y espaciado proporcional entre bloques clínicos).
- **Adaptación responsiva móvil**: En pantallas angostas (móviles < 820px), la visualización colapsa fluidamente a 1 columna ocupando el ancho del dispositivo sin generar scroll horizontal.

## Capabilities

### Modified Capabilities
- `content-editing`: Se actualiza el requerimiento `Vista lector` para exigir que el modo a dos columnas renderice hojas A4 discretas con separación física entre sí y márgenes acotados idénticos a los de la exportación (`7mm 10.5mm`).

## Impact

- **Componentes**: `app/src/components/reader/ArticleReader.tsx` para soportar la segmentación/paginación secuencial en hojas A4.
- **Estilos**: `app/src/index.css` para aplicar márgenes acotados (`7mm 10.5mm`), altura de hoja A4 (`297mm`), `column-gap: 1.5rem`, `column-rule` y separadores físicos.
- **Tests**: Nuevas pruebas unitarias en `ArticleReader.test.ts`.
