## Purpose

Acelerar la creación de fichas médicas mediante plantillas con estructura estándar, editables por el usuario y sembradas automáticamente con los 11 formatos maestros oficiales de la Versión 2.

## Requirements

### Requirement: Carpeta de sistema Plantillas

El sistema SHALL proveer una carpeta de sistema "Plantillas". Las plantillas son artículos normales ubicados en ella: se editan con el mismo editor WYSIWYG del resto del contenido y participan del export/import como cualquier artículo.

#### Scenario: Editar una plantilla existente

- **WHEN** el usuario abre la plantilla "Fármaco / Ficha farmacológica" y añade una sección "Notas personales"
- **THEN** la plantilla queda modificada y los artículos creados a partir de ella en adelante incluyen la nueva sección

### Requirement: Siembra de plantillas en el primer arranque

En el primer arranque o migración, el sistema SHALL sembrar en "Plantillas/" los 11 formatos maestros v2 definidos en `plantillas_sindecon/`: Patología / Enfermedad, Síndrome clínico / Diagnóstico sindromático, Síntoma / Motivo de consulta, Urgencia / Emergencia, Procedimiento / Técnica / Exploración clínica, Examen / Prueba / Interpretación diagnóstica, Concepto / Anatomía / Fisiología / Fisiopatología, Prevención / Tamizaje / Control clínico, Terapéutica / Estrategia de tratamiento, Fármaco / Ficha farmacológica y Patología oncológica / Cáncer. Cada plantilla SHALL contener sus secciones como encabezados Markdown, con tabla semilla donde el formato lo indica (p.ej. "Tratamiento", "Fármacos y dosis"), fence mermaid semilla donde hay "Algoritmo" y listas de perlas clínicas. La siembra MUST ejecutarse una sola vez y no sobrescribir ediciones del usuario.

#### Scenario: Primer arranque
- **WHEN** el usuario abre la app por primera vez
- **THEN** existe la carpeta "Plantillas" con las 11 plantillas listas para usar

#### Scenario: Re-arranque tras personalizar
- **WHEN** el usuario editó una plantilla y vuelve a abrir la app
- **THEN** la plantilla conserva la edición del usuario (la siembra no se repite ni sobrescribe)

### Requirement: Crear artículo desde plantilla

Al crear un artículo, el sistema SHALL ofrecer elegir una plantilla (o empezar en blanco). Crear desde plantilla SHALL copiar el contenido actual de la plantilla al nuevo artículo y reemplazar el placeholder `{título}` por el nombre del artículo. El artículo creado SHALL ser independiente: ediciones posteriores de la plantilla no lo afectan.

#### Scenario: Crear ficha de enfermedad
- **WHEN** el usuario crea "Cáncer gástrico" en "Oncología" eligiendo la plantilla Patología oncológica / Cáncer
- **THEN** el artículo nace con todas las secciones de la plantilla (Definición, Epidemiología, ..., Estadificación / TNM, Tratamiento según estadio, Perlas clínicas) y su encabezado principal es "Cáncer gástrico"

### Requirement: Maquetación editorial a 2 columnas y estilo clínico
El lector de artículos SHALL permitir visualización a 2 columnas tipo díptico médico en pantallas de escritorio y tablets, con tipografía `Roboto`, títulos principales en Navy (`#142337`) y encabezados de sección en Teal (`#008080`), adaptándose a 1 columna en pantallas móviles.
