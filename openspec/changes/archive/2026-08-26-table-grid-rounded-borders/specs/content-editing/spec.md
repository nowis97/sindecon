## MODIFIED Requirements

### Requirement: Tablas editables visualmente

El sistema SHALL permitir crear, editar y visualizar tablas médicas de forma clara (añadir/eliminar filas y columnas, editar celdas), persistiendo como tablas Markdown GFM. Las tablas SHALL renderizarse con una cuadrícula estructurada de bordes grises entre todas las celdas (tanto filas como columnas) y un contenedor envolvente con bordes exteriores redondeados y recorte de desbordamiento.

#### Scenario: Editar tabla de fármacos

- **WHEN** el usuario añade una fila a la tabla de dosificación y escribe en sus celdas
- **THEN** la tabla se actualiza visualmente y el Markdown guardado contiene la fila nueva en sintaxis GFM

#### Scenario: Visualización de cuadrícula y bordes redondeados

- **WHEN** el usuario visualiza una tabla médica en modo lector o editor
- **THEN** las celdas muestran líneas divisorias grises internas (filas y columnas)
- **AND** el contorno exterior de la tabla presenta esquinas redondeadas con recorte de desbordamiento sin sangrado de fondos

### Requirement: Vista lector

El sistema SHALL ofrecer una vista de lectura de cada artículo que renderice el Markdown completo: formato, tablas con cuadrícula y esquinas redondeadas, listas, imágenes y esquemas mermaid. En pantallas estrechas, los esquemas, tablas e imágenes anchas SHALL permitir desplazamiento horizontal suave.

#### Scenario: Consulta en el hospital desde el móvil

- **WHEN** el usuario abre un artículo con un algoritmo mermaid o tabla ancha en el móvil
- **THEN** puede leer el artículo y hacer scroll/zoom sobre el elemento sin romper el layout del documento
