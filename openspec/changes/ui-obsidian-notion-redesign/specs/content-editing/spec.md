## ADDED Requirements

### Requirement: Cabecera de artículo estilo Notion con segmented tabs y pill tags
La vista de artículo DEBE contar con una cabecera limpia con breadcrumbs jerárquicos, segmented control para alternar entre `Lector`, `Editor` e `Importar IA`, etiquetas estilo pastilla (`badge-pill`) con colores distintivos y soporte completo de modo oscuro.

#### Scenario: Edición de etiquetas y cambio de vista
- **WHEN** el usuario añade una etiqueta o cambia entre modo Lector y Editor
- **THEN** la vista actualiza el control segmentado con animación suave y renderiza las etiquetas con alto contraste
