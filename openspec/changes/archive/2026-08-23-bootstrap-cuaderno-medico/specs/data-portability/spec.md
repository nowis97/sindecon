## Purpose

Que el conocimiento nunca quede atrapado en la app: exportación a Markdown plano legible sin la aplicación, e importación por fusión que sirve de backup y de puente manual entre dispositivos.

## ADDED Requirements

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
