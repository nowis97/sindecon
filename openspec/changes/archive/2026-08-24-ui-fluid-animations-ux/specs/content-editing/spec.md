## ADDED Requirements

### Requirement: Micro-interacciones en lectura, edición e importación
El sistema SHALL proveer retroalimentación visual fluida al alternar modos de visualización, interactuar con elementos médicos enriquecidos y procesar contenidos importados.

#### Scenario: Alternancia animada entre modo Lector y Editor
- **WHEN** el usuario hace clic en los botones del control segmentado (Lector / Editor)
- **THEN** el indicador de selección se desplaza hacia el modo elegido y el contenido realiza un desvanecimiento cruzado suave sin alterar la posición de scroll

#### Scenario: Interacción táctil en Callouts clínicos y tablas
- **WHEN** el usuario visualiza o interactúa con callouts de alerta, dosis de fármacos o perlas clínicas en modo lector
- **THEN** los elementos proporcionan una respuesta visual de realce con micro-sombras y bordes con brillo clínico

#### Scenario: Retroalimentación en el asistente de importación inteligente
- **WHEN** el usuario arrastra un archivo Word (.docx) o pega texto en el modal de importación
- **THEN** la zona de suelta reacciona visualmente y la vista previa de conversión se actualiza con transiciones suaves
