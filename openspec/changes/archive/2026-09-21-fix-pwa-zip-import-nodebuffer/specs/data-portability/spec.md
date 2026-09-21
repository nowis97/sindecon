## MODIFIED Requirements

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
