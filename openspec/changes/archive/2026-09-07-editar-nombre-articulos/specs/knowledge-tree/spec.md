## MODIFIED Requirements

### Requirement: Operaciones sobre nodos

El sistema SHALL permitir crear, renombrar, mover y eliminar nodos. El renombrado de artículos SHALL estar disponible directamente desde la cabecera del visor/editor de artículos, desde las tarjetas de artículos en la vista exploradora de carpeta y desde el menú contextual (`···`) de cada elemento del árbol de conocimientos. Al eliminar una carpeta, su descendencia completa SHALL eliminarse en cascada (con confirmación previa). Al mover un nodo, toda su descendencia SHALL acompañarlo conservando la estructura.

#### Scenario: Renombrar artículo desde la cabecera del visor

- **WHEN** el usuario hace clic en el botón de renombrar (`btn-article-rename`) en la cabecera del artículo abierto
- **THEN** el sistema presenta el diálogo interactivo con el título actual prellenado
- **WHEN** el usuario ingresa un nuevo título y confirma
- **THEN** el artículo actualiza su nombre en IndexedDB, reflejándose inmediatamente en la cabecera del visor, en la barra de navegación y en el árbol lateral

#### Scenario: Renombrar artículo desde la tarjeta en vista de carpeta

- **WHEN** el usuario pulsa el botón de renombrar en la tarjeta de un artículo dentro de `FolderExplorerView`
- **THEN** el sistema abre el diálogo de renombrado para dicho artículo y al confirmar actualiza su título en la cuadrícula y en la base de datos

#### Scenario: Renombrar nodo desde menú contextual del árbol

- **WHEN** el usuario selecciona "✏️ Renombrar" en el menú contextual (`···`) de cualquier carpeta o artículo en el árbol
- **THEN** el sistema abre el diálogo modal para cambiar el título y persiste el cambio atómicamente

#### Scenario: Mover artículo a otra categoría

- **WHEN** el usuario mueve un artículo de "Cardiología" a "Neumología"
- **THEN** el artículo aparece bajo "Neumología" conservando su contenido intacto

#### Scenario: Eliminar carpeta con contenido

- **WHEN** el usuario elimina una carpeta que contiene artículos y subcarpetas, y confirma
- **THEN** toda la descendencia queda eliminada (marcada como tombstone para la fusión)
