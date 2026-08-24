# knowledge-tree (Delta Spec: Modales, Dashboard y Menú Contextual)

## MODIFIED REQUIREMENTS

### REQ-KT-002: Operaciones sobre nodos
El sistema DEBE permitir crear carpetas y artículos, renombrar, mover y eliminar nodos.

#### Scenario: Creación y renombrado mediante modales integrados
- **GIVEN** que el usuario hace click en "+ Carpeta", "+ Artículo", "Renombrar" o en una opción del menú contextual `···`
- **WHEN** se solicita el nombre o título
- **THEN** el sistema DEBE abrir un diálogo modal `PromptDialog` con foco automático y validación de campo requerido (sin recurrir a `window.prompt`)
- **AND** al pulsar Enter o el botón primario DEBE persistir la operación en IndexedDB y cerrar el diálogo.

#### Scenario: Eliminación con confirmación modal destructiva
- **GIVEN** que el usuario selecciona eliminar un artículo o una carpeta con contenido
- **WHEN** se solicita confirmación
- **THEN** el sistema DEBE mostrar un diálogo `ConfirmDialog` con estilo destructivo y advertencia explícita
- **AND** tras confirmar DEBE ejecutar la eliminación en cascada y limpiar la selección si correspondía al nodo eliminado.

### REQ-KT-004: Visualización inicial y Empty State
El sistema DEBE proveer un panel de inicio interactivo (*Dashboard*) cuando no haya un nodo seleccionado.

#### Scenario: Renderizado del Dashboard de bienvenida
- **GIVEN** que ningún artículo o carpeta está seleccionado en el árbol
- **WHEN** se visualiza el área principal
- **THEN** el sistema DEBE mostrar el componente `Dashboard` con las métricas del cuaderno, accesos directos y notas recientes.
