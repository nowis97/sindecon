## ADDED Requirements

### Requirement: Animación fluida del árbol y menús contextuales
El sistema SHALL animar la expansión y colapso de las carpetas en el árbol de navegación, así como la apertura de menús contextuales y la marcación de artículos favoritos.

#### Scenario: Colapso y despliegue de carpeta con animación de acordeón
- **WHEN** el usuario hace clic en el indicador de expansión de una carpeta con subcarpetas o artículos
- **THEN** la lista de hijos se despliega o repliega con una animación fluida de altura y el caret rota suavemente 90 grados

#### Scenario: Feedback visual al anclar a favoritos
- **WHEN** el usuario marca un artículo como favorito mediante la estrella de la cabecera o el menú contextual
- **THEN** el botón de estrella muestra una animación reactiva de destello y el artículo aparece de inmediato en la sección superior de favoritos del árbol

#### Scenario: Despliegue orgánico del menú contextual de fila
- **WHEN** el usuario hace clic en el botón de opciones (···) de un nodo
- **THEN** el menú flotante aparece con una animación de escala y opacidad anclada al botón de origen
