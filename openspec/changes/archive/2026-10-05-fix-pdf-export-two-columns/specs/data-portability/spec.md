# Spec Delta

## MODIFIED Requirements

### Requirement: Exportación de artículos individuales a PDF con selección de maquetación

El sistema SHALL permitir exportar o imprimir cualquier artículo clínico a formato PDF mediante un modal interactivo donde el usuario SHALL poder elegir entre dos modos de maquetación: **1 Columna (Lectura continua)** y **2 Columnas (Ficha médica / Resumen compacto)**. El documento generado SHALL incluir opciones para mostrar u ocultar la cabecera médica (título, fecha de modificación y ruta de carpetas) y las etiquetas (tags), aplicando reglas CSS optimizadas para impresión en papel (`@media print`) que eviten cortes accidentales en tablas, imágenes, diagramas y callouts, y empleando una tipografía con interlineado compacto (`line-height` entre 1.25 y 1.35) y márgenes de párrafo reducidos que maximicen la densidad de información clínica y reduzcan el número total de páginas impresas.

En la exportación a 2 columnas, el sistema MUST ocultar completamente controles interactivos de diagramas (botones de zoom, reset y pantalla completa), MUST permitir que diagramas complejos o anchos se expandan ocupando el ancho completo (`column-span: all`) o se contengan adecuadamente sin volverse ilegibles, MUST prevenir cortes huérfanos que dejen columnas vacías con cabeceras descolgadas, MUST evitar el solapamiento tipográfico en cabeceras de columna, y MUST deserializar y estilizar fielmente los bloques de aviso clínico (callouts como `[!DOSIS]`, `[!WARNING]`, `[!TIP]`) incluso si sus corchetes se encuentran escapados en el Markdown (`\[!TIPO]`).

#### Scenario: Selección de maquetación en 2 columnas para ficha médica

- **WHEN** el usuario pulsa "Exportar PDF", selecciona la opción "2 Columnas (Ficha médica)" y confirma la acción
- **THEN** el sistema prepara el documento con maquetación de dos columnas compactas con interlineado reducido (`line-height: 1.30`) y dispara el diálogo de impresión/guardado en PDF del navegador (`window.print()`)

#### Scenario: Selección de maquetación en 1 columna para lectura lineal

- **WHEN** el usuario selecciona "1 Columna (Lectura continua)" en el modal de exportación PDF y confirma la acción
- **THEN** el sistema prepara el documento con diseño de columna completa y tipografía compacta (`line-height: 1.35`) antes de invocar la impresión

#### Scenario: Ocultación de elementos no imprimibles de la interfaz

- **WHEN** se dispara la impresión o exportación a PDF
- **THEN** las barras laterales, barras de navegación inferior, botones de edición y los controles interactivos de diagramas Mermaid (`.mermaid-controls`, botones `+`, `-`, reset y `⛶`) quedan estrictamente ocultos en el PDF resultante

#### Scenario: Densidad de lectura e interlineado compacto en elementos clínicos del PDF

- **WHEN** se genera la vista de impresión en cualquier modalidad (1 o 2 columnas)
- **THEN** los párrafos, listas, tablas, citas y bloques de aviso (callouts) se renderizan con interlineado compacto (`line-height` ≤ 1.35) y separación vertical moderada, evitando saltos de línea innecesariamente amplios en papel

#### Scenario: Diagramas y tablas legibles en maquetación de dos columnas

- **WHEN** un artículo con diagramas de flujo Mermaid o tablas clínicas anchas se imprime o exporta en modo 2 columnas
- **THEN** los diagramas y tablas se visualizan con tipografía nítida y legible, adaptando su disposición o expandiéndose a lo ancho de ambas columnas (`column-span: all`) sin comprimirse en un bloque microscópico ilegible

#### Scenario: Prevención de columnas huérfanas y solapamiento tipográfico

- **WHEN** el contenido fluye a través de múltiples columnas y páginas
- **THEN** las tarjetas de diagramas y bloques estructurados no se dividen separando la cabecera del cuerpo ni generan columnas vacías con cabeceras descolgadas, y el texto en la cima de una columna no colisiona con márgenes o elementos adyacentes

#### Scenario: Renderizado fiel de Callouts clínicos con caracteres escapados

- **WHEN** el Markdown contiene callouts clínicos con corchetes escapados por serializadores (ej. `\[!DOSIS]`) o sin formato de blockquote estándar
- **THEN** el lector y la vista de impresión identifican y procesan el bloque como un callout estilizado con su color, icono y título correspondiente, sin imprimir texto crudo `\[!DOSIS]`
