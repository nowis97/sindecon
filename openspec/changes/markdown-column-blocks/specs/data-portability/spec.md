## ADDED Requirements

### Requirement: Renderizado fiel de bloques de columnas en exportación a PDF e impresión
El sistema SHALL renderizar los bloques `:::columns` como columnas visuales paralelas alineadas durante la generación de PDF y vista de impresión de artículos individuales y por lotes. Si la exportación está configurada en 1 columna de página, el bloque interno `:::columns` SHALL mantener sus sub-columnas en paralelo dentro del ancho de la página.

#### Scenario: Exportar a PDF artículo con bloque de dos columnas
- **WHEN** el usuario genera el PDF de un artículo que contiene un bloque `:::columns`
- **THEN** el documento PDF resultante muestra las secciones del bloque en columnas paralelas sin cortes anómalos
