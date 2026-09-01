## ADDED Requirements

### Requirement: Acciones de exportación documental en carpetas

El sistema SHALL proveer puntos de acceso directos para exportar a PDF desde el explorador de carpetas (`FolderView`) y desde el menú contextual de carpetas del árbol de navegación lateral (`TreeView`).

#### Scenario: Abrir exportación de lote desde el explorador de carpetas
- **WHEN** el usuario navega a una carpeta y pulsa el botón "🖨️ Exportar Carpeta a PDF" en la barra de herramientas
- **THEN** se despliega el modal de configuración de exportación consolidada con todos los artículos de dicha carpeta precargados

#### Scenario: Exportar carpeta desde el menú contextual del árbol
- **WHEN** el usuario hace clic derecho o abre el menú contextual de una carpeta en la barra lateral y selecciona "Exportar a PDF"
- **THEN** se abre el modal de exportación consolidada para dicha carpeta
