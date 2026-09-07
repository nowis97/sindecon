## ADDED Requirements

### Requirement: Acción de importación masiva en carpetas del árbol
El sistema SHALL exponer opciones de importación masiva Markdown en los puntos de interacción de carpetas:
1. En el menú contextual (`···`) de cualquier carpeta del árbol de conocimientos con la opción "📥 Importar archivos .md".
2. En la barra de herramientas y vista exploradora de carpeta (`FolderExplorerView`) mediante un botón "📥 Importar .md".
3. Mediante soltado directo (Drag & Drop) de uno o múltiples archivos `.md` desde el explorador del sistema operativo sobre una carpeta del árbol.

#### Scenario: Abrir importador masivo desde menú de carpeta
- **WHEN** el usuario hace click en el menú `···` de la carpeta "Cardiología" y selecciona "📥 Importar archivos .md"
- **THEN** se abre el diálogo de importación masiva con la carpeta "Cardiología" preseleccionada como destino.

#### Scenario: Arrastrar archivos del sistema sobre una carpeta
- **WHEN** el usuario arrastra 5 archivos `.md` desde el escritorio del sistema operativo y los suelta sobre la carpeta "Farmacología"
- **THEN** el sistema inicia el flujo de importación masiva de esos archivos en "Farmacología".
