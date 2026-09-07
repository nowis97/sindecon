## Purpose

Que el conocimiento nunca quede atrapado en la app: exportación a Markdown plano legible sin la aplicación, e importación por fusión que sirve de backup y de puente manual entre dispositivos.

## Requirements

### Requirement: Export a Markdown portable

El sistema SHALL exportar toda la base de conocimiento como una estructura de carpetas espejo del árbol (zip): cada artículo es un archivo `.md` con frontmatter YAML (`id`, `tags`, `order`, `updated_at`) y las imágenes se exportan como archivos en `assets/`. Las referencias internas de imagen SHALL reescribirse a rutas relativas en el Markdown exportado. El export SHALL incluir un manifiesto con la versión del formato y un registro de nodos eliminados (tombstones). El Markdown exportado MUST ser legible sin la app (cualquier visor Markdown lo abre).

#### Scenario: Exportar y leer sin la app

- **WHEN** el usuario exporta y abre un `.md` resultante en un editor externo
- **THEN** el contenido es Markdown GFM legible, con frontmatter válido y las imágenes resolviendo por ruta relativa

#### Scenario: Export incluye manifiesto versionado

- **WHEN** el usuario exporta la base de conocimiento
- **THEN** el zip contiene un manifiesto con la versión del formato de export y el registro de eliminados

### Requirement: Import por fusión

El sistema SHALL importar un export previo FUSIONANDO con los datos actuales, nunca reemplazando: inserta nodos nuevos, actualiza los existentes solo si el `updated_at` entrante es más reciente, y aplica los tombstones entrantes. Los nodos existentes más recientes que el export SHALL permanecer intactos.

#### Scenario: Recibir capturas del móvil sin perder ediciones del PC

- **WHEN** el usuario importa en el PC un export del móvil que contiene capturas del Inbox, y el PC tiene artículos editados después de ese export
- **THEN** las capturas nuevas se incorporan al Inbox y los artículos recientes del PC no se modifican

#### Scenario: Tombstone propaga eliminación

- **WHEN** se importa un export que registra como eliminado un artículo que localmente existe sin cambios posteriores
- **THEN** el artículo local queda eliminado

### Requirement: Compatibilidad de formato entre versiones

El sistema SHALL rechazar con mensaje claro un export cuya versión de formato no soporte, y SHALL poder leer exports de versiones anteriores soportadas.

#### Scenario: Importar backup antiguo

- **WHEN** el usuario importa un export creado con una versión anterior soportada del formato
- **THEN** la importación se completa aplicando las adaptaciones necesarias

#### Scenario: Export de versión desconocida

- **WHEN** el usuario importa un archivo con versión de formato no soportada
- **THEN** la app informa del problema sin alterar los datos locales

### Requirement: Identidad estable de los datos

Todo nodo SHALL tener un identificador único universal (uuid) y marca de modificación desde su creación, y las eliminaciones SHALL registrarse como tombstones. Esto aplica desde el primer dato creado, para que la fusión (y el futuro sync automático) nunca requiera migración de identidades.

#### Scenario: Datos fusionables desde el día uno

- **WHEN** el usuario crea y elimina nodos desde el primer uso de la app
- **THEN** cada nodo tiene uuid y updated_at, y cada eliminación queda registrada como tombstone exportable

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
