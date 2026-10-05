## MODIFIED Requirements

### Requirement: Vista lector

El sistema SHALL ofrecer una vista de lectura de cada artículo que renderice el Markdown completo (formato, tablas, listas, imágenes y esquemas mermaid) con tipografía optimizada para lectura médica y soporte de alineación justificada del texto (`text-align: justify`). Asimismo, SHALL proveer un control en la barra de herramientas del lector para alternar opcionalmente entre alineación justificada e izquierda, persistiendo dicha preferencia en el almacenamiento local. En pantallas estrechas, los esquemas e imágenes anchas SHALL permitir zoom y desplazamiento.

#### Scenario: Consulta en el hospital desde el móvil

- **WHEN** el usuario abre un artículo con un algoritmo mermaid ancho en el móvil
- **THEN** puede leer el artículo y hacer zoom/pan sobre el diagrama sin perder legibilidad

#### Scenario: Lectura con texto justificado por defecto

- **WHEN** el usuario visualiza un artículo en modo Lector
- **THEN** los párrafos, listas, citas médicas y callouts se presentan con alineación justificada uniforme y guionado silábico suave para una óptima lectura clínica.

#### Scenario: Alternar alineación de texto a la izquierda

- **WHEN** el usuario hace clic en el botón de alternancia de alineación en la barra de herramientas del lector
- **THEN** el lector cambia la presentación del texto a alineación a la izquierda y guarda la preferencia en `localStorage`.
