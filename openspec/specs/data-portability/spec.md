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

El sistema SHALL importar un export previo FUSIONANDO con los datos actuales, nunca reemplazando: inserta nodos nuevos, actualiza los existentes solo si el `updated_at` entrante es más reciente, y aplica los tombstones entrantes. Los nodos existentes más recientes que el export SHALL permanecer intactos. El proceso de importación y extracción de archivos binarios/assets MUST operar usando tipos y APIs estándar de la plataforma web (`Uint8Array`, `Blob`), garantizando compatibilidad total tanto en navegadores web y PWA como en entornos de ejecución de pruebas.

#### Scenario: Recibir capturas del móvil sin perder ediciones del PC

- **WHEN** el usuario importa en el PC un export del móvil que contiene capturas del Inbox, y el PC tiene artículos editados después de ese export
- **THEN** las capturas nuevas se incorporan al Inbox y los artículos recientes del PC no se modifican

#### Scenario: Tombstone propaga eliminación

- **WHEN** se importa un export que registra como eliminado un artículo que localmente existe sin cambios posteriores
- **THEN** el artículo local queda eliminado

#### Scenario: Importación de assets en entorno web y PWA

- **WHEN** se importa un archivo zip o respaldo de Google Drive que contiene imágenes o adjuntos en la carpeta `assets/` en un navegador web o PWA
- **THEN** los assets se extraen y almacenan como Blobs en la base de datos local sin fallar por dependencias exclusivas de Node.js (`nodebuffer`)

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

### Requirement: Renderizado fiel de bloques de columnas en exportación a PDF e impresión
El sistema SHALL renderizar los bloques `:::columns` como columnas visuales paralelas alineadas durante la generación de PDF y vista de impresión de artículos individuales y por lotes. Si la exportación está configurada en 1 columna de página, el bloque interno `:::columns` SHALL mantener sus sub-columnas en paralelo dentro del ancho de la página.

#### Scenario: Exportar a PDF artículo con bloque de dos columnas
- **WHEN** el usuario genera el PDF de un artículo que contiene un bloque `:::columns`
- **THEN** el documento PDF resultante muestra las secciones del bloque en columnas paralelas sin cortes anómalos

### Requirement: Exportación de artículos individuales a PDF con selección de maquetación

El sistema SHALL permitir exportar o imprimir cualquier artículo clínico a formato PDF mediante un modal interactivo donde el usuario SHALL poder elegir entre dos modos de maquetación: **1 Columna (Lectura continua)** y **2 Columnas (Ficha médica / Resumen compacto)**. El documento generado SHALL incluir opciones para mostrar u ocultar la cabecera médica (título, fecha de modificación y ruta de carpetas) y las etiquetas (tags), aplicando reglas CSS optimizadas para impresión en papel (`@media print`) que eviten cortes accidentales en tablas, imágenes, diagramas y callouts, y empleando una tipografía con interlineado compacto (`line-height` entre 1.25 y 1.35) y márgenes de párrafo reducidos que maximicen la densidad de información clínica y reduzcan el número total de páginas impresas.

#### Scenario: Selección de maquetación en 2 columnas para ficha médica

- **WHEN** el usuario pulsa "Exportar PDF", selecciona la opción "2 Columnas (Ficha médica)" y confirma la acción
- **THEN** el sistema prepara el documento con maquetación de dos columnas compactas con interlineado reducido (`line-height: 1.30`) y dispara el diálogo de impresión/guardado en PDF del navegador (`window.print()`)

#### Scenario: Selección de maquetación en 1 columna para lectura lineal

- **WHEN** el usuario selecciona "1 Columna (Lectura continua)" en el modal de exportación PDF y confirma la acción
- **THEN** el sistema prepara el documento con diseño de columna completa y tipografía compacta (`line-height: 1.35`) antes de invocar la impresión

#### Scenario: Ocultación de elementos no imprimibles de la interfaz

- **WHEN** se dispara la impresión o exportación a PDF
- **THEN** las barras laterales, barras de navegación inferior, botones de edición y elementos de control de la app quedan estrictamente ocultos en el PDF resultante

#### Scenario: Densidad de lectura e interlineado compacto en elementos clínicos del PDF

- **WHEN** se genera la vista de impresión en cualquier modalidad (1 o 2 columnas)
- **THEN** los párrafos, listas, tablas, citas y bloques de aviso (callouts) se renderizan con interlineado compacto (`line-height` ≤ 1.35) y separación vertical moderada, evitando saltos de línea innecesariamente amplios en papel

### Requirement: Persistencia y sincronización de configuración de IA en Google Drive

El sistema SHALL persistir y sincronizar de forma bidireccional la configuración de Inteligencia Artificial (proveedor, clave de API y modelo seleccionado) en el espacio privado ppDataFolder de Google Drive del usuario mediante el archivo i-config.json. Al iniciar sesión en Google Drive o ejecutar el ciclo de sincronización, si el almacenamiento local no cuenta con una clave de API configurada y existe una versión en Google Drive, el sistema SHALL descargar y aplicar la configuración automáticamente en el almacenamiento local IndexedDB.

#### Scenario: Carga automática de API Key al iniciar sesión en un dispositivo nuevo

- **WHEN** un usuario inicia sesión con su cuenta de Google Drive en un dispositivo o navegador sin clave de API configurada
- **THEN** el sistema descarga automáticamente el archivo i-config.json de su espacio privado ppDataFolder y guarda la configuración de IA en IndexedDB dejándola lista para su uso inmediato sin requerir configuración manual

#### Scenario: Subida reactiva al guardar nueva configuración de IA con Drive conectado

- **WHEN** el usuario actualiza o ingresa una nueva API Key o cambia de modelo en el modal de Ajustes de IA estando Google Drive conectado
- **THEN** el sistema guarda la configuración localmente en IndexedDB y sube de inmediato el archivo i-config.json actualizado al espacio ppDataFolder de Google Drive

#### Scenario: Preservación local al desconectar Google Drive

- **WHEN** el usuario decide desconectar su cuenta de Google Drive
- **THEN** la configuración de IA local (API Key y modelo) permanece intacta en el dispositivo local para evitar interrupciones en el flujo de trabajo

#### Scenario: Aislamiento estricto de exportaciones manuales en ZIP

- **WHEN** el usuario exporta un respaldo completo de su cuaderno a archivo .zip
- **THEN** el archivo .zip generado NO contiene claves de API ni secretos de IA, previniendo fugas de credenciales privadas al compartir respaldos

### Requirement: Sincronización persistente en Google Drive con Silent Token Refresh

El sistema SHALL mantener la sesión del usuario en Google Drive de forma persistente a través de reinicios y cierres de la aplicación, renovando automáticamente los Access Tokens expirados en segundo plano mediante Google Identity Services (GIS) sin interrumpir al usuario ni abrir ventanas emergentes cuando la cuenta ya ha sido autorizada previamente.

#### Scenario: Auto-reconexión silenciosa al abrir la aplicación
- **WHEN** el usuario abre SINDECON habiendo vinculado previamente su cuenta de Google Drive y el Access Token temporal ha caducado
- **THEN** el sistema solicita silenciosamente un nuevo Access Token (prompt: '') en segundo plano
- **AND** el estado de sincronización se actualiza automáticamente a conectado ( Al día) sin solicitar interacción manual

#### Scenario: Refresco proactivo en segundo plano
- **WHEN** la aplicación permanece abierta y el Access Token activo está próximo a expirar (después de 45-50 minutos)
- **THEN** el sistema renueva el Access Token de forma silenciosa para asegurar la continuidad de la sincronización automática

#### Scenario: Desconexión explícita por el usuario
- **WHEN** el usuario pulsa en Desconectar cuenta en el modal de Google Drive
- **THEN** el sistema elimina todas las credenciales y marcas de sesión persistente, volviendo al estado desconectado
