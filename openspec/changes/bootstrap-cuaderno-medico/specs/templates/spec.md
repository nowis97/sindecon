## Purpose

Acelerar la creación de fichas médicas mediante plantillas con estructura estándar, editables por el usuario y sembradas automáticamente con los 10 formatos maestros del documento fuente.

## ADDED Requirements

### Requirement: Carpeta de sistema Plantillas

El sistema SHALL proveer una carpeta de sistema "Plantillas". Las plantillas son artículos normales ubicados en ella: se editan con el mismo editor WYSIWYG del resto del contenido y participan del export/import como cualquier artículo.

#### Scenario: Editar una plantilla existente

- **WHEN** el usuario abre la plantilla "Fármaco" y añade una sección "Notas personales"
- **THEN** la plantilla queda modificada y los artículos creados a partir de ella en adelante incluyen la nueva sección

### Requirement: Siembra de plantillas en el primer arranque

En el primer arranque con base de datos vacía, el sistema SHALL sembrar en "Plantillas/" los 10 formatos maestros definidos en `Formatos_sintesis_conocimiento_medico.pdf`: Patología/Enfermedad, Síndrome clínico, Síntoma/Motivo de consulta, Urgencia/Emergencia, Procedimiento/Técnica, Examen/Prueba diagnóstica, Concepto básico, Prevención/Tamizaje, Terapéutica y Fármaco. Cada plantilla SHALL contener sus secciones como encabezados Markdown, con tabla semilla donde el formato lo indica (p.ej. "Fármacos y dosis") y fence mermaid semilla donde hay "Algoritmo". La siembra MUST ejecutarse una sola vez y no sobrescribir ediciones del usuario.

#### Scenario: Primer arranque

- **WHEN** el usuario abre la app por primera vez
- **THEN** existe la carpeta "Plantillas" con las 10 plantillas listas para usar

#### Scenario: Re-arranque tras personalizar

- **WHEN** el usuario editó una plantilla y vuelve a abrir la app
- **THEN** la plantilla conserva la edición del usuario (la siembra no se repite ni sobrescribe)

### Requirement: Crear artículo desde plantilla

Al crear un artículo, el sistema SHALL ofrecer elegir una plantilla (o empezar en blanco). Crear desde plantilla SHALL copiar el contenido actual de la plantilla al nuevo artículo y reemplazar el placeholder `{título}` por el nombre del artículo. El artículo creado SHALL ser independiente: ediciones posteriores de la plantilla no lo afectan.

#### Scenario: Crear ficha de enfermedad

- **WHEN** el usuario crea "Hipertensión arterial" en "Cardiología" eligiendo la plantilla Patología/Enfermedad
- **THEN** el artículo nace con todas las secciones de la plantilla (Definición, Epidemiología, ... Perlas clínicas) y su encabezado principal es "Hipertensión arterial"

#### Scenario: Artículo independiente de su plantilla

- **WHEN** el usuario modifica la plantilla después de haber creado un artículo desde ella
- **THEN** el artículo previamente creado permanece sin cambios
