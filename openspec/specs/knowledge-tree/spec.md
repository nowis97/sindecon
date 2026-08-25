## Purpose

Organizar el conocimiento médico en un árbol navegable de carpetas y artículos de profundidad arbitraria, con una bandeja Inbox para capturas rápidas sin clasificar.

## Requirements

### Requirement: Árbol recursivo de nodos

El sistema SHALL modelar el conocimiento como un árbol de nodos con un solo tipo recursivo: cada nodo es carpeta o artículo y puede tener un padre (salvo las raíces). Un "Tema" ES una carpeta raíz, sin tipo especial. Las carpetas SHALL admitir anidación de profundidad arbitraria y los artículos SHALL poder existir en cualquier nivel del árbol (junto a carpetas, no solo en hojas).

#### Scenario: Crear tema raíz

- **WHEN** el usuario crea una carpeta sin asignar padre
- **THEN** la carpeta aparece como Tema en el nivel superior de la navegación

#### Scenario: Anidar categorías sin límite práctico

- **WHEN** el usuario crea una carpeta dentro de otra carpeta que ya está anidada
- **THEN** la nueva carpeta se crea como hija y es navegable con breadcrumbs completos

#### Scenario: Artículo junto a subcarpetas

- **WHEN** el usuario crea un artículo dentro de una carpeta que ya contiene subcarpetas
- **THEN** el artículo y las subcarpetas coexisten como hijos de la misma carpeta

### Requirement: Operaciones sobre nodos

El sistema SHALL permitir crear, renombrar, mover y eliminar nodos. Al eliminar una carpeta, su descendencia completa SHALL eliminarse en cascada (con confirmación previa). Al mover un nodo, toda su descendencia SHALL acompañarlo conservando la estructura.

#### Scenario: Mover artículo a otra categoría

- **WHEN** el usuario mueve un artículo de "Cardiología" a "Neumología"
- **THEN** el artículo aparece bajo "Neumología" conservando su contenido intacto

#### Scenario: Eliminar carpeta con contenido

- **WHEN** el usuario elimina una carpeta que contiene artículos y subcarpetas, y confirma
- **THEN** toda la descendencia queda eliminada (marcada como tombstone para la fusión)

### Requirement: Navegación con breadcrumbs

El sistema SHALL mostrar la ruta completa desde la raíz hasta el nodo actual, y cada segmento SHALL ser clicable para navegar hacia arriba.

#### Scenario: Navegar hacia arriba desde un artículo profundo

- **WHEN** el usuario lee "Tema ▸ Cardiología ▸ Arritmias ▸ Fibrilación Auricular" y toca "Cardiología"
- **THEN** la vista muestra el contenido de la carpeta Cardiología

### Requirement: Inbox de capturas

El sistema SHALL proveer una carpeta de sistema "Inbox" creada automáticamente. Toda captura rápida (foto + nota) SHALL crearse como artículo dentro del Inbox sin exigir clasificación. El usuario puede archivar (mover) las capturas del Inbox a su ubicación definitiva del árbol.

#### Scenario: Captura rápida sin clasificar

- **WHEN** el usuario realiza una captura rápida desde el móvil (foto y nota)
- **THEN** se crea un artículo en el Inbox con la imagen adjunta y el texto de la nota, sin pedir ubicación

#### Scenario: Vaciar el inbox elaborando en PC

- **WHEN** el usuario mueve una captura del Inbox a "Cardiología ▸ Arritmias"
- **THEN** la captura deja de aparecer en el Inbox y pasa a formar parte del árbol

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

### Requirement: Árbol de navegación estilo Obsidian Vault
El árbol de carpetas y artículos DEBE presentarse con un diseño minimalista de alta densidad, chevrons animados para desplegar subcarpetas, resaltado suave al posar el cursor y menú de acciones contextuales `...` integrado en cada elemento, prescindiendo de botones redundantes en la cabecera.

#### Scenario: Interacción fluida con el árbol de carpetas
- **WHEN** el usuario navega o expande carpetas en la barra lateral
- **THEN** el árbol responde con transiciones suaves y permite gestionar artículos directamente desde el menú contextual

### Requirement: Drag and Drop de Artículos y Carpetas en el Árbol
El sistema SHALL permitir organizar el árbol de conocimiento arrastrando y soltando artículos y subcarpetas directamente sobre carpetas de destino o hacia la raíz.

#### Scenario: Arrastrar artículo a una carpeta
- **GIVEN** el usuario tiene un artículo en la raíz o en una carpeta
- **WHEN** arrastra el artículo sobre una carpeta de destino y lo suelta
- **THEN** el artículo se mueve a la carpeta de destino y el árbol se actualiza inmediatamente

#### Scenario: Auto-despliegue de carpeta al arrastrar
- **GIVEN** una carpeta con subcarpetas está colapsada
- **WHEN** el usuario arrastra un artículo y mantiene el cursor sobre la carpeta por más de 600ms
- **THEN** la carpeta se despliega automáticamente mostrando sus subcarpetas para permitir soltar dentro de ellas

#### Scenario: Validación anti-ciclos al arrastrar carpetas
- **GIVEN** una carpeta que contiene subcarpetas
- **WHEN** el usuario intenta arrastrar la carpeta padre dentro de una de sus subcarpetas o dentro de sí misma
- **THEN** la acción no se permite y la carpeta destino no se resalta como válida
