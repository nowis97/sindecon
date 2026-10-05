## ADDED Requirements

### Requirement: Ordenamiento alfabético opcional de artículos y carpetas
El sistema SHALL permitir reordenar los elementos hijos de cualquier carpeta de forma alfabética (A-Z y Z-A), tanto de manera persistente en la base de datos local como de manera dinámica en la vista de exploración de carpetas.

#### Scenario: Reordenar alfabéticamente de forma persistente desde el menú contextual
- **WHEN** el usuario abre el menú contextual (`···`) de una carpeta en el árbol y selecciona "🔤 Ordenar alfabéticamente (A-Z)"
- **THEN** el sistema actualiza el atributo `order` de todos los nodos hijos de la carpeta en IndexedDB según el orden alfabético de sus títulos (respetando diacríticos y números en español) y actualiza el árbol de inmediato.

#### Scenario: Cambiar criterio de orden en la vista exploradora de carpeta
- **WHEN** el usuario navega a una carpeta y selecciona un criterio de orden en el selector de la vista (ej. "Alfabético (A-Z)", "Alfabético (Z-A)" o "Más recientes")
- **THEN** las subcarpetas y artículos en la cuadrícula de la vista se muestran ordenados según el criterio seleccionado sin alterar el orden manual del árbol hasta que el usuario decida persistirlo.

#### Scenario: Fijar orden alfabético actual como orden permanente del árbol
- **WHEN** el usuario pulsa el botón "🔤 Ordenar A-Z" en la barra de herramientas de la vista de carpeta
- **THEN** el sistema persiste la nueva secuencia numérica en el campo `order` de los nodos hijos en IndexedDB y muestra una notificación toast confirmando el reordenamiento.
