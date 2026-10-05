## ADDED Requirements

### Requirement: Exportación de artículos individuales a PDF con selección de maquetación

El sistema SHALL permitir exportar o imprimir cualquier artículo clínico a formato PDF mediante un modal interactivo donde el usuario SHALL poder elegir entre dos modos de maquetación: **1 Columna (Lectura continua)** y **2 Columnas (Ficha médica / Resumen compacto)**. El documento generado SHALL incluir opciones para mostrar u ocultar la cabecera médica (título, fecha de modificación y ruta de carpetas) y las etiquetas (tags), aplicando reglas CSS optimizadas para impresión en papel (`@media print`) que eviten cortes accidentales en tablas, imágenes, diagramas y callouts.

#### Scenario: Selección de maquetación en 2 columnas para ficha médica

- **WHEN** el usuario pulsa "Exportar PDF", selecciona la opción "2 Columnas (Ficha médica)" y confirma la acción
- **THEN** el sistema prepara el documento con maquetación de dos columnas compactas y dispara el diálogo de impresión/guardado en PDF del navegador (`window.print()`)

#### Scenario: Selección de maquetación en 1 columna para lectura lineal

- **WHEN** el usuario selecciona "1 Columna (Lectura continua)" en el modal de exportación PDF y confirma la acción
- **THEN** el sistema prepara el documento con diseño de columna completa y espaciado de lectura estándar antes de invocar la impresión

#### Scenario: Ocultación de elementos no imprimibles de la interfaz

- **WHEN** se dispara la impresión o exportación a PDF
- **THEN** las barras laterales, barras de navegación inferior, botones de edición y elementos de control de la app quedan estrictamente ocultos en el PDF resultante
