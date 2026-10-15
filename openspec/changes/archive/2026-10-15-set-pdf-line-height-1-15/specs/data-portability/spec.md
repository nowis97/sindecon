# Spec Delta

## MODIFIED Requirements

### Requirement: Exportación de artículos individuales a PDF con selección de maquetación

El sistema SHALL permitir exportar o imprimir cualquier artículo clínico a formato PDF mediante un modal interactivo donde el usuario SHALL poder elegir entre dos modos de maquetación: **1 Columna (Lectura continua)** y **2 Columnas (Ficha médica / Resumen compacto)**. El documento generado SHALL incluir opciones para mostrar u ocultar la cabecera médica (título, fecha de modificación y ruta de carpetas) y las etiquetas (tags), aplicando reglas CSS optimizadas para impresión en papel (`@media print`) que eviten cortes accidentales en tablas, imágenes, diagramas y callouts.

Tanto en la modalidad de 1 columna como en la de 2 columnas, el texto base de los párrafos SHALL renderizarse a **`9pt`** con un interlineado equilibrado **`line-height: 1.15`**, y el espaciado vertical posterior al título del artículo y la cabecera médica SHALL reducirse sustancialmente para maximizar la densidad de información clínica y aprovechar el espacio inicial en papel. Asimismo, el sistema SHALL renderizar los párrafos y bloques de texto clínicos con alineación **justificada** (`text-align: justify`), con distribución uniforme entre palabras (`text-justify: inter-word`) y división de palabras automática (`hyphens: auto`) para asegurar márgenes laterales limpios y simétricos sin ríos blancos.

En la exportación a 2 columnas, el sistema MUST ocultar completamente controles interactivos de diagramas (botones de zoom, reset y pantalla completa), MUST permitir que diagramas complejos o anchos se expandan ocupando el ancho completo (`column-span: all`) o se contengan adecuadamente sin volverse ilegibles, MUST prevenir cortes huérfanos que dejen columnas vacías con cabeceras descolgadas, MUST evitar el solapamiento tipográfico en cabeceras de columna, y MUST deserializar y estilizar fielmente los bloques de aviso clínico (callouts como `[!DOSIS]`, `[!WARNING]`, `[!TIP]`) incluso si sus corchetes se encuentran escapados en el Markdown (`\[!TIPO]`).

#### Scenario: Selección de maquetación en 2 columnas para ficha médica
- **WHEN** el usuario pulsa "Exportar PDF", selecciona la opción "2 Columnas (Ficha médica)" y confirma la acción
- **THEN** el sistema prepara el documento con maquetación de dos columnas compactas con texto base de párrafos en `9pt`, interlineado en `1.15` (`line-height: 1.15`), texto justificado y dispara el diálogo de impresión/guardado en PDF del navegador (`window.print()`)

#### Scenario: Selección de maquetación en 1 columna para lectura lineal
- **WHEN** el usuario selecciona "1 Columna (Lectura continua)" en el modal de exportación PDF y confirma la acción
- **THEN** el sistema prepara el documento con diseño de columna completa con texto base de párrafos en `9pt`, interlineado en `1.15` (`line-height: 1.15`), texto justificado antes de invocar la impresión

#### Scenario: Ocultación de elementos no imprimibles de la interfaz
- **WHEN** se dispara la impresión o exportación a PDF
- **THEN** las barras laterales, barras de navegación inferior, botones de edición y los controles interactivos de diagramas Mermaid (`.mermaid-controls`, botones `+`, `-`, reset y `⛶`) quedan estrictamente ocultos en el PDF resultante

#### Scenario: Densidad de lectura e interlineado compacto en elementos clínicos del PDF
- **WHEN** se genera la vista de impresión en cualquier modalidad (1 o 2 columnas)
- **THEN** los párrafos se renderizan a `9pt` con `line-height: 1.15` y alineación justificada (`text-align: justify`), y listas, tablas, citas y bloques de aviso (callouts) mantienen separación vertical compacta evitando saltos de línea innecesariamente amplios en papel

#### Scenario: Diagramas y tablas legibles en maquetación de dos columnas
- **WHEN** un artículo con diagramas de flujo Mermaid o tablas clínicas anchas se imprime o exporta en modo 2 columnas
- **THEN** los diagramas y tablas se visualizan con tipografía nítida y legible, adaptando su disposición o expandiéndose a lo ancho de ambas columnas (`column-span: all`) sin comprimirse en un bloque microscópico ilegible

#### Scenario: Prevención de columnas huérfanas y solapamiento tipográfico
- **WHEN** el contenido fluye a través de múltiples columnas y páginas
- **THEN** las tarjetas de diagramas y bloques estructurados no se dividen separando la cabecera del cuerpo ni generan columnas vacías con cabeceras descolgadas, y el texto en la cima de una columna no colisiona con márgenes o elementos adyacentes

#### Scenario: Renderizado fiel de Callouts clínicos con caracteres escapados
- **WHEN** el Markdown contiene callouts clínicos con corchetes escapados por serializadores (ej. `\[!DOSIS]`) o sin formato de blockquote estándar
- **THEN** el lector y la vista de impresión identifican y procesan el bloque como un callout estilizado con su color, icono y título correspondiente, sin imprimir texto crudo `\[!DOSIS]`

#### Scenario: Espaciado compacto posterior al título en cabecera de impresión
- **WHEN** se genera la vista de impresión con cabecera médica habilitada
- **THEN** el margen inferior del contenedor de cabecera y el espaciado tras el título del artículo se reducen de modo que el cuerpo del texto inicie de forma más inmediata sin espacios blancos excesivos
