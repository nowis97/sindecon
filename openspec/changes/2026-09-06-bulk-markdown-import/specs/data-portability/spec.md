## ADDED Requirements

### Requirement: Importación masiva de archivos Markdown (.md)
El sistema SHALL permitir al usuario seleccionar múltiples archivos Markdown (`.md`, `.markdown`) o carpetas completas del sistema operativo e importarlos como artículos clínicos independientes dentro de una carpeta de destino especificada o en una nueva carpeta.

#### Scenario: Selección múltiple de archivos Markdown
- **WHEN** el usuario selecciona 10 archivos `.md` desde el selector de archivos del navegador
- **THEN** el sistema procesa cada archivo en lote, creando un artículo clínico por cada archivo bajo la carpeta de destino activa.

#### Scenario: Importación de carpeta completa preservando nombres
- **WHEN** el usuario selecciona una carpeta local del sistema mediante selector de directorios o arrastre de archivos
- **THEN** el sistema importa todos los archivos Markdown contenidos, asignando los títulos correspondientes y ubicándolos en la carpeta destino seleccionada.

### Requirement: Extracción inteligente de títulos y etiquetas en importación masiva
El sistema SHALL determinar automáticamente el título del artículo clínico importado aplicando el siguiente orden de precedencia:
1. Atributo `title` en el bloque Frontmatter YAML inicial (`--- ... ---`).
2. El primer encabezado `# Título` (H1) presente en el documento Markdown.
3. El nombre del archivo en disco, eliminando la extensión `.md` / `.markdown` y limpiando guiones/guiones bajos.
Asimismo, el sistema SHALL extraer etiquetas declaradas en el Frontmatter (`tags: [...]`) y asociarlas a los metadatos del artículo en IndexedDB.

#### Scenario: Archivo con Frontmatter YAML completo
- **WHEN** se importa un archivo con encabezado `--- title: "Amikacina" tags: [antibiotico, aminoglucosido] ---`
- **THEN** el artículo se crea con título "Amikacina", las etiquetas `["antibiotico", "aminoglucosido"]` y el cuerpo Markdown desprovisto del bloque YAML frontal.

#### Scenario: Archivo sin Frontmatter pero con H1
- **WHEN** se importa un archivo `insuficiencia_cardiaca.md` que inicia con `# Insuficiencia Cardíaca: Diagnóstico y Manejo`
- **THEN** el artículo se crea con título "Insuficiencia Cardíaca: Diagnóstico y Manejo".

#### Scenario: Archivo sin encabezados ni Frontmatter
- **WHEN** se importa un archivo nombrado `shock_septico_guias.md` que contiene solo texto plano y tablas
- **THEN** el artículo se crea con título "Shock Septico Guias".

### Requirement: Manejo de colisiones y progreso de importación masiva
El sistema SHALL proporcionar opciones de resolución cuando un artículo entrante tenga el mismo título que un artículo ya existente en la carpeta de destino:
- **Omitir duplicados**: No importa el archivo colisionante.
- **Crear copia**: Crea el artículo con un sufijo numérico automático (ej. `Amikacina (1)`).
- **Sobreescribir**: Actualiza el contenido del artículo existente preservando su ID y backlinks.
Durante el procesamiento, el sistema SHALL mostrar una barra de progreso y contador en tiempo real (`X de N artículos importados`).

#### Scenario: Progreso y reporte de importación por lotes
- **WHEN** se procesa un lote de 25 archivos Markdown
- **THEN** la interfaz muestra el avance de cada archivo procesado y al finalizar presenta un resumen de artículos creados, actualizados u omitidos.
