# Spec Delta

## MODIFIED Requirements

### Requirement: Árbol de navegación estilo Obsidian Vault
El árbol de carpetas y artículos SHALL presentarse con un diseño de alta densidad, chevrons animados para desplegar subcarpetas y botón de opciones contextuales (`···`) visible y accesible de forma persistente en cada elemento (carpetas y artículos), garantizando contención estricta dentro del ancho de la barra lateral sin desbordamientos horizontales independientemente de la longitud de los títulos.

#### Scenario: Interacción fluida con el árbol de carpetas
- **WHEN** el usuario navega o expande carpetas en la barra lateral
- **THEN** el árbol responde con transiciones suaves y permite gestionar artículos directamente desde el menú contextual

#### Scenario: Visibilidad persistente de opciones en carpetas y artículos
- **WHEN** el usuario visualiza el árbol de navegación sin posar el cursor sobre los elementos
- **THEN** cada carpeta y artículo elegible muestra su botón de opciones (`···`) de forma visible y clara sin requerir interacción `:hover` previa

#### Scenario: Contención de botones de acción con títulos largos
- **WHEN** una carpeta o artículo tiene un título extenso que excede el espacio disponible en la barra lateral
- **THEN** el título se trunca visualmente con puntos suspensivos y el botón de opciones (`···`) permanece visible y anclado al extremo derecho dentro del ancho visible de la barra lateral

#### Scenario: Realce e interacción en hover y focus
- **WHEN** el usuario posa el cursor o enfoca el botón de opciones (`···`)
- **THEN** el botón incrementa su contraste y escala sutilmente, y al hacer clic despliega el menú contextual completo sin ser recortado por el scroll del árbol
