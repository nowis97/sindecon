# search (Delta Spec: Command Palette y Filtro de Etiquetas)

## MODIFIED REQUIREMENTS

### REQ-SCH-002: Command Palette / Quick Switcher
El sistema DEBE proveer una paleta de comandos modal accesible mediante atajo de teclado (`Ctrl+K` / `Cmd+K`) y botón táctil.

#### Scenario: Apertura por atajo de teclado y búsqueda rápida
- **GIVEN** que el usuario presiona `Ctrl+K` o `Cmd+K` desde cualquier pantalla
- **WHEN** se ingresa texto en el campo de búsqueda
- **THEN** el sistema DEBE listar los artículos coincidentes por título y contenido junto con acciones rápidas del sistema
- **AND** permitir navegar los resultados con teclas de flecha `↑` / `↓` y seleccionar con `Enter`.

### REQ-SCH-003: Filtrado por Etiquetas
El sistema DEBE permitir filtrar artículos al hacer click en cualquier etiqueta (*tag*).

#### Scenario: Filtrado por tag clínico
- **GIVEN** que el usuario hace click en una etiqueta (ej. `#urgencias`) en el Dashboard o en la cabecera de un artículo
- **WHEN** se activa el filtro
- **THEN** el sistema DEBE mostrar los artículos que contienen dicha etiqueta ordenados por relevancia o fecha de edición.
