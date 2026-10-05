## ADDED Requirements

### Requirement: Vista de Explorador de Contenidos de Carpeta
Cuando una carpeta está seleccionada en el árbol o migas de pan, el área de contenido principal SHALL mostrar una vista de explorador interactivo (FolderExplorerView) con la cabecera de la carpeta, recuento de elementos contenidos (X subcarpetas • Y artículos), cuadrícula de subcarpetas navegables, lista/tarjetas de artículos contenidos con etiquetas y favoritos, y acciones directas para añadir contenido a esa carpeta.

#### Scenario: Explorar contenido de una carpeta con subcarpetas y artículos
- **WHEN** el usuario selecciona una carpeta que contiene subcarpetas y artículos
- **THEN** el panel principal muestra el título de la carpeta, la cuadrícula de subcarpetas con acceso clicable y la lista de artículos con sus etiquetas clínicas

#### Scenario: Visualización de carpeta vacía
- **WHEN** el usuario abre una carpeta que no contiene elementos
- **THEN** el explorador muestra un estado vacío amigable con botones directos para crear un nuevo artículo o una subcarpeta

#### Scenario: Navegación descendente desde el explorador
- **WHEN** el usuario hace clic en una tarjeta de subcarpeta dentro del explorador
- **THEN** la aplicación navega hacia esa subcarpeta, actualizando la selección en el árbol lateral y los breadcrumbs

### Requirement: Diferenciación visual estricta entre carpetas y artículos en el árbol
El árbol de navegación lateral SHALL diferenciar con alta claridad visual las carpetas contenedoras de los artículos de lectura/edición, empleando iconografía contrastada (📁/📂 con rotación de chevron vs 📄 de ficha clínica), badges contadores de hijos en carpetas y resaltado de artículo activo.

#### Scenario: Identificación visual de carpeta con badge contador
- **WHEN** se renderiza una carpeta en el árbol lateral
- **THEN** la fila muestra el icono de carpeta, el indicador de despliegue interactivo y un chip con la cantidad total de elementos directos que contiene

#### Scenario: Identificación de artículo con acceso a favoritos
- **WHEN** se renderiza un artículo en el árbol lateral
- **THEN** la fila muestra el icono de documento médico, guías de sangría de árbol y botón de anclar a favoritos
