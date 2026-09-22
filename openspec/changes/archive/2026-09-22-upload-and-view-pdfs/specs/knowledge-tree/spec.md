## ADDED Requirements

### Requirement: Subida individual y múltiple de documentos PDF a carpetas
El sistema SHALL permitir al usuario cargar uno o varios archivos PDF simultáneamente a cualquier carpeta del árbol de conocimientos mediante un diálogo modal dedicado. Cada archivo PDF seleccionado SHALL ser procesado para generar un artículo en la carpeta de destino elegida, sugiriendo como título inicial el nombre del archivo sin su extensión `.pdf` y permitiendo al usuario modificar dicho título opcionalmente antes de proceder a la creación.

#### Scenario: Cargar múltiples PDFs con prellenado de títulos limpios
- **WHEN** el usuario selecciona o arrastra tres archivos PDF (ej. `guia_hta_2024.pdf`, `algoritmo_rcp.pdf` y `analitica.pdf`) en el modal de subida de PDFs
- **THEN** el sistema lista los tres documentos mostrando su tamaño y sugiere los títulos limpios "guia hta 2024", "algoritmo rcp" y "analitica" en campos de texto editables

#### Scenario: Modificar opcionalmente el título de un PDF antes de guardar
- **WHEN** el usuario edita el campo de título del archivo `guia_hta_2024.pdf` a "Guía de Hipertensión Arterial 2024" y confirma la subida
- **THEN** el sistema crea el artículo en la carpeta destino con el título personalizado "Guía de Hipertensión Arterial 2024"

#### Scenario: Eliminar un archivo de la lista de selección
- **WHEN** el usuario pulsa el botón de eliminar junto a uno de los archivos cargados en el modal antes de confirmar
- **THEN** dicho archivo se retira de la lista y no se crea ningún artículo ni asset asociado para él

#### Scenario: Acceso contextual desde el menú de carpeta y la vista de exploración
- **WHEN** el usuario abre el menú de opciones (`···`) de una carpeta en el árbol o pulsa el botón "📄 Subir PDF" en la barra de herramientas de `FolderExplorerView`
- **THEN** el modal de subida de PDFs se abre con dicha carpeta preseleccionada como destino predeterminado
