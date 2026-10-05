## Purpose

Acelerar la creación de fichas médicas mediante plantillas con estructura estándar, editables por el usuario y sembradas automáticamente con los 11 formatos maestros oficiales de la Versión 2.

## Requirements

### Requirement: Carpeta de sistema Plantillas

El sistema SHALL proveer una carpeta de sistema "Plantillas". Las plantillas son artículos normales ubicados en ella: se editan con el mismo editor WYSIWYG del resto del contenido y participan del export/import como cualquier artículo.

#### Scenario: Editar una plantilla existente

- **WHEN** el usuario abre la plantilla "Fármaco / Ficha farmacológica" y añade una sección "Notas personales"
- **THEN** la plantilla queda modificada y los artículos creados a partir de ella en adelante incluyen la nueva sección

### Requirement: Siembra de plantillas en el primer arranque

En el primer arranque o migración, el sistema SHALL sembrar en "Plantillas/" los 12 formatos maestros oficiales (los 11 de la Versión 2 más la nueva plantilla de farmacología clínica "Fármaco / Posología y administración clínica"): Patología / Enfermedad, Síndrome clínico / Diagnóstico sindromático, Síntoma / Motivo de consulta, Urgencia / Emergencia, Procedimiento / Técnica / Exploración clínica, Examen / Prueba / Interpretación diagnóstica, Concepto / Anatomía / Fisiología / Fisiopatología, Prevención / Tamizaje / Control clínico, Terapéutica / Estrategia de tratamiento, Fármaco / Ficha farmacológica, Fármaco / Posología y administración clínica y Patología oncológica / Cáncer. Cada plantilla SHALL contener sus secciones como encabezados Markdown, con tabla semilla donde el formato lo indica (p.ej. "Posología", "Tratamiento", "Fármacos y dosis"), fence mermaid semilla donde hay "Algoritmo" y listas guiadas de ítems clínicos. La siembra MUST ejecutarse de forma idempotente y no sobrescribir ediciones del usuario.

#### Scenario: Primer arranque
- **WHEN** el usuario abre la app por primera vez
- **THEN** existe la carpeta "Plantillas" con las 12 plantillas oficiales listas para usar

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

Al exportar o imprimir un artículo a PDF en modo 2 columnas, el cuerpo del artículo SHALL seguir el mismo orden de lectura continuo que la vista de 2 columnas en pantalla: el contenido fluye de arriba hacia abajo por la columna izquierda y continúa en la derecha, y los encabezados de sección MUST quedar dentro de la columna en lugar de ocupar ambas. Solo el encabezado del documento impreso (marca, fecha, título del artículo y ruta) SHALL ir a ancho completo.

#### Scenario: Visualización responsive
- **WHEN** el usuario visualiza un artículo en pantalla de escritorio
- **THEN** se maqueta en 2 columnas con la paleta clínica oficial y se adapta a 1 columna en móviles

#### Scenario: PDF en 2 columnas con el mismo orden que la pantalla
- **WHEN** el usuario exporta a PDF en 2 columnas un artículo con varias secciones de primer nivel (p.ej. "Síndromes hipertensivos del embarazo", "Preeclampsia", "Síndrome de HELLP")
- **THEN** cada sección empieza dentro de la columna, a continuación de la anterior, y el texto se lee de corrido: columna izquierda completa, luego columna derecha, luego la página siguiente

#### Scenario: Títulos de sección sin ancho completo en el PDF
- **WHEN** se genera la vista de impresión en 2 columnas
- **THEN** ningún encabezado de sección del cuerpo ocupa ambas columnas; solo el encabezado del documento va a ancho completo arriba

### Requirement: Estructura de la plantilla Fármaco / Posología y administración clínica

El sistema SHALL proveer la plantilla oficial "Fármaco / Posología y administración clínica" basada en el formato clínico manuscrito para uso en guardia y prescripción activa. Dicha plantilla SHALL estructurarse con:
1. Encabezado principal `# {título}`.
2. Sección `## Indicaciones` con lista numerada del 1 al 9.
3. Sección `## Posología` con tabla Markdown estructurada con las columnas: `Contexto`, `Dosis`, `Frecuencia`, `Vía`, `Máximo diario` y `Acotaciones`.
4. Sección `## Preparación y ajuste` con los ítems guiados: Dilución (en qué y en cuánto), Tiempo de administración, Ajuste en IRA, Ajuste en DHC y NO mezclar con.
5. Sección `## RAM relevantes` con lista numerada del 1 al 9.
6. Sección `## Marcas comerciales en Chile` con lista numerada del 1 al 5.
7. Sección `## Contraindicaciones` con lista numerada del 1 al 10.
8. Sección `## Fuentes` con lista numerada del 1 al 5.

#### Scenario: Creación de artículo a partir de la nueva plantilla de farmacología
- **WHEN** el usuario crea un artículo seleccionando la plantilla "Fármaco / Posología y administración clínica"
- **THEN** el artículo nuevo contiene todas las secciones, la tabla de posología con encabezados correctos y los campos guiados de preparación, seguridad y marcas comerciales en Chile
