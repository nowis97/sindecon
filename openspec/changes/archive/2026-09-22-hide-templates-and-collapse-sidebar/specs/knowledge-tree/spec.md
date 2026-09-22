## ADDED Requirements

### Requirement: Visibilidad configurable de la carpeta de plantillas maestras
El sistema SHALL permitir al usuario alternar la visibilidad de la carpeta del sistema "Plantillas" en el árbol de conocimientos mediante una opción accesible en la barra de navegación del árbol. La preferencia SHALL persistir en el almacenamiento local del dispositivo. Cuando esté configurada como oculta, ni la carpeta "Plantillas" ni sus artículos contenidos se mostrarán en el árbol de navegación ni en la lista de temas raíz, pero la creación de notas a partir de plantillas continuará plenamente operativa desde los selectores del sistema.

#### Scenario: Ocultar carpeta de plantillas del árbol
- **WHEN** el usuario pulsa la opción para ocultar la carpeta de plantillas
- **THEN** la carpeta "Plantillas" desaparece inmediatamente de la raíz del árbol de navegación y la preferencia se guarda localmente

#### Scenario: Mostrar carpeta de plantillas del árbol
- **WHEN** el usuario activa la opción para mostrar la carpeta de plantillas
- **THEN** la carpeta "Plantillas" vuelve a renderizarse en la raíz del árbol con todos sus artículos maestros disponibles para consulta directa

#### Scenario: Creación de artículo desde plantilla con carpeta oculta
- **WHEN** la carpeta de plantillas está configurada como oculta y el usuario selecciona "+ desde plantilla" en la barra de herramientas
- **THEN** la lista de plantillas oficiales continúa disponible para crear el artículo normalmente sin requerir hacer visible la carpeta
