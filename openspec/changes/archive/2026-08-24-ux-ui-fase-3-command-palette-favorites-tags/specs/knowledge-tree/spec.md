# knowledge-tree (Delta Spec: Artículos Favoritos y Anclados)

## MODIFIED REQUIREMENTS

### REQ-KT-005: Artículos Favoritos / Protocolos Anclados
El sistema DEBE permitir marcar artículos como favoritos para acceso rápido en la cabecera del árbol.

#### Scenario: Anclar y desanclar artículo
- **GIVEN** que el usuario visualiza un artículo
- **WHEN** hace click en el botón de estrella ⭐ "Marcar como favorito"
- **THEN** el sistema DEBE agregar el artículo a la lista persistente de favoritos y reflejar el estado activo
- **AND** mostrarlo en la sección "⭐ Favoritos / Protocolos" del panel lateral.
