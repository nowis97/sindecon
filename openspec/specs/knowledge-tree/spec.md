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
