# Proposal: Renderizado de Hojas Tamaño A4 en Modo Vista

## Why

Actualmente, el modo de lectura (modo vista) presenta el contenido médico en un único bloque continuo y fluido que se expande horizontalmente hasta 900px, sin reflejar la anatomía de un documento formal ni la proporción de una página física. 

Para los profesionales y estudiantes médicos que redactan apuntes, protocolos clínicos y fichas de estudio para imprimir o consultar en rondas hospitalarias, resulta fundamental contar con una visualización que simule hojas reales en formato A4 (210mm de ancho relativo, márgenes físicos tipográficos, elevación con sombra y separación clara entre páginas). Esto proporciona una experiencia de lectura estructurada, familiar y consistente con la exportación a PDF.

## What Changes

- **Contenedor con proporción y formato A4**: El visor de lectura (`ArticleReader`) ahora renderiza el artículo dentro de una o más hojas estilizadas con las dimensiones proporcionales estándar A4 (ancho base de 210mm / 794px a 96 DPI, altura proporcional de 297mm o dinámica según contenido, márgenes internos uniformes de 20-25mm y elevación visual con sombras suaves sobre el fondo del lienzo).
- **Separación visual entre hojas de lectura**: Se implementa una división visual limpia entre páginas/secciones del documento en el visor, simulando una pila o secuencia de hojas A4 sobre el escritorio.
- **Modos de visualización integrados**: La presentación en hoja A4 es totalmente compatible con la vista a 2 columnas (estilo ficha médica/Word) y el texto justificado existente en la barra de herramientas del lector.
- **Diseño responsivo móvil**: En dispositivos de escritorio y pantallas anchas se respeta la proporción A4 centrada; en teléfonos móviles o pantallas estrechas las hojas se adaptan automáticamente al ancho del viewport preservando la estética de página sin provocar scroll horizontal forzado.

## Capabilities

### Modified Capabilities
- `content-editing`: Se actualiza el requerimiento `Vista lector` para exigir que la renderización visual en modo lectura adopte el formato, proporción y separación de hojas tamaño A4 con comportamiento responsivo.

## Impact

- **Frontend / Componentes**: Modificaciones en `app/src/components/reader/ArticleReader.tsx` para estructurar el renderizado en hojas A4 (`a4-sheet` / `a4-page`).
- **Estilos / CSS**: Actualizaciones en `app/src/index.css` para definir el diseño de página A4 (`.a4-sheet`, sombras de papel, paddings de margen físico, márgenes de separación inter-hoja, consultas `@media` para dispositivos móviles).
- **Compatibilidad**: No altera el almacenamiento en IndexedDB, la exportación a Markdown ni la sincronización con Google Drive.
