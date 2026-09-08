## MODIFIED Requirements

### Requirement: Vista lector

El sistema SHALL ofrecer una vista de lectura de cada artículo que renderice el Markdown completo (formato, tablas, listas, imágenes y esquemas mermaid) con tipografía optimizada para lectura médica y soporte de alineación justificada del texto (`text-align: justify`). Las imágenes médicas SHALL mostrarse centradas horizontalmente, adaptándose fluidamente al ancho de su columna tanto en vista de 1 como de 2 columnas o dentro de bloques multicolumna, sin desbordar los límites del contenedor y con protección contra cortes verticales entre columnas (`break-inside: avoid`). Las imágenes en modo lector SHALL ser estáticas y libres de pistas interactivas o modales de ampliación (zoom). Asimismo, el sistema SHALL proveer un control en la barra de herramientas del lector para alternar opcionalmente entre alineación justificada e izquierda, persistiendo dicha preferencia en el almacenamiento local. En pantallas estrechas, los esquemas mermaid anchos SHALL permitir zoom y desplazamiento.

#### Scenario: Consulta en el hospital desde el móvil

- **WHEN** el usuario abre un artículo con un algoritmo mermaid ancho en el móvil
- **THEN** puede leer el artículo y hacer zoom/pan sobre el diagrama sin perder legibilidad

#### Scenario: Lectura con texto justificado por defecto

- **WHEN** el usuario visualiza un artículo en modo Lector
- **THEN** los párrafos, listas, citas médicas y callouts se presentan con alineación justificada uniforme y guionado silábico suave para una óptima lectura clínica.

#### Scenario: Alternar alineación de texto a la izquierda

- **WHEN** el usuario hace clic en el botón de alternancia de alineación en la barra de herramientas del lector
- **THEN** el lector cambia la presentación del texto a alineación a la izquierda y guarda la preferencia en `localStorage`.

#### Scenario: Centrado y ajuste de imágenes en maquetación de 2 columnas

- **WHEN** el usuario visualiza un artículo con imágenes en modo de 2 columnas o en bloques de columnas paralelas
- **THEN** la imagen se renderiza centrada en la columna, escalada proporcionalmente al 100% del ancho de la columna sin generar desbordamiento ni saltos cortados.

#### Scenario: Imagen limpia sin opción de zoom

- **WHEN** el usuario visualiza una imagen médica en el modo lector
- **THEN** la imagen no presenta mensajes de ampliación ("🔍 Toca para ampliar"), no responde con aperturas de modal al hacer clic y mantiene el cursor estándar de lectura.
