## MODIFIED Requirements

### Requirement: Vista lector

El sistema SHALL ofrecer una vista de lectura de cada artículo que renderice el Markdown completo: formato, tablas, listas, imágenes y esquemas mermaid. En pantallas estrechas, los esquemas e imágenes anchas SHALL permitir zoom y desplazamiento. La presentación tipográfica SHALL aplicar un interlineado compacto de alta densidad informativa, y los encabezados de nivel 1 (h1) SHALL presentar el mismo estilo visual distintivo de los encabezados de nivel 2 (h2) (color de acento y subrayado temático), diferenciándose por una escala de tamaño superior.

#### Scenario: Consulta en el hospital desde el móvil
- **WHEN** el usuario abre un artículo con un algoritmo mermaid ancho en el móvil
- **THEN** puede leer el artículo y hacer zoom/pan sobre el diagrama sin perder legibilidad

#### Scenario: Interlineado compacto en lectura de notas clínicas
- **WHEN** el usuario visualiza artículos médicos en modo lector o editor
- **THEN** el texto, párrafos y listas se renderizan con un interlineado denso y cómodo (~1.48) que maximiza el contenido visible por pantalla

#### Scenario: Estilo unificado de Heading 1 respecto a Heading 2
- **WHEN** el artículo contiene encabezados de nivel 1 (# Título) y nivel 2 (## Sección)
- **THEN** h1 se renderiza con el mismo tratamiento estético que h2 (color de acento temático y borde inferior subrayado), manteniendo un tamaño de fuente mayor para preservar la jerarquía
