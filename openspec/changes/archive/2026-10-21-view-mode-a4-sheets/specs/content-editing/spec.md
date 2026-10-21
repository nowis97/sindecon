# Spec Delta

## MODIFIED Requirements

### Requirement: Vista lector

El sistema SHALL ofrecer una vista de lectura de cada artículo que renderice el Markdown completo (formato, tablas, listas, imágenes y esquemas mermaid) con tipografía optimizada para lectura médica y soporte de alineación justificada del texto (`text-align: justify`). Las imágenes médicas SHALL mostrarse centradas horizontalmente, adaptándose fluidamente al ancho de su columna tanto en vista de 1 como de 2 columnas o dentro de bloques multicolumna, sin desbordar los límites del contenedor y con protección contra cortes verticales entre columnas (`break-inside: avoid`). Las imágenes en modo lector SHALL ser estáticas y libres de pistas interactivas o modales de ampliación (zoom). Asimismo, el sistema SHALL proveer un control en la barra de herramientas del lector para alternar opcionalmente entre alineación justificada e izquierda, persistiendo dicha preferencia en el almacenamiento local. En pantallas estrechas, los esquemas mermaid anchos SHALL permitir zoom y desplazamiento. La presentación tipográfica SHALL aplicar un interlineado compacto de alta densidad informativa, y los encabezados de nivel 1 (h1) SHALL presentar el mismo estilo visual distintivo de los encabezados de nivel 2 (h2) (color de acento y subrayado temático), diferenciándose por una escala de tamaño superior.

Asimismo, el sistema SHALL estructurar y renderizar el contenido en el modo vista dentro de hojas con formato y proporción estándar tamaño A4 (ancho nominal base de 210mm / ~794px a 96 DPI, márgenes de página físicos de 20-25mm, sombras perimetrales suaves simulando papel elevado y separación visual clara entre páginas consecutivas). En dispositivos de escritorio y tablets, las hojas A4 SHALL presentarse centradas en el lienzo de lectura; en pantallas móviles o ventanas estrechas, las hojas SHALL adaptarse elásticamente al 100% del ancho del viewport sin provocar scroll horizontal forzado. El diseño en hoja A4 SHALL mantener compatibilidad total con la maquetación a 2 columnas y con la alineación justificada.

#### Scenario: Consulta en el hospital desde el móvil

- **WHEN** el usuario abre un artículo con un algoritmo mermaid ancho en el móvil
- **THEN** puede leer el artículo y hacer zoom/pan sobre el diagrama sin perder legibilidad

#### Scenario: Interlineado compacto en lectura de notas clínicas

- **WHEN** el usuario visualiza artículos médicos en modo lector o editor
- **THEN** el texto, párrafos y listas se renderizan con un interlineado denso y cómodo (~1.48) que maximiza el contenido visible por pantalla

#### Scenario: Estilo unificado de Heading 1 respecto a Heading 2

- **WHEN** el artículo contiene encabezados de nivel 1 (# Título) y nivel 2 (## Sección)
- **THEN** h1 se renderiza con el mismo tratamiento estético que h2 (color de acento temático y borde inferior subrayado), manteniendo un tamaño de fuente mayor para preservar la jerarquía

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

#### Scenario: Renderizado del artículo en hoja tamaño A4 en pantalla de escritorio

- **WHEN** el usuario accede al modo Vista (Lector) en un artículo médico desde una pantalla de escritorio
- **THEN** el contenido se renderiza dentro de una hoja centrada de ancho A4 (~210mm / 794px), con márgenes tipográficos de 20-25mm, fondo blanco/card y sombra perimetral de papel sobre el fondo del lienzo.

#### Scenario: Separación visual entre páginas u hojas de lectura

- **WHEN** el artículo cuenta con múltiples divisiones de página o un volumen extenso de notas
- **THEN** el lector presenta una separación visual nítida (brecha y delimitación de bordes/sombras) entre las hojas A4 consecutivas.

#### Scenario: Adaptación responsiva de hoja A4 en pantallas móviles

- **WHEN** el usuario abre el modo Vista en un teléfono inteligente o pantalla con ancho menor a 794px
- **THEN** la hoja A4 se expande fluidamente ocupando el ancho del dispositivo con márgenes móviles adaptados (12-16px) sin desbordamiento horizontal.
