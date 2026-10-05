# Spec Delta

## MODIFIED Requirements

### Requirement: Imágenes como datos locales

El sistema SHALL permitir insertar imágenes pegando desde el portapapeles, arrastrando un archivo o capturando con la cámara (móvil). Las imágenes SHALL almacenarse localmente como blobs (comprimidas a un tamaño razonable al importar) y referenciarse en el Markdown con una referencia interna resoluble offline (`asset://<id>`). Asimismo, el sistema SHALL resolver y renderizar una vista previa visual de las imágenes directamente dentro del editor visual de Markdown (`MarkdownEditor`), convirtiendo asíncronamente las referencias `asset://<id>` a Object URLs de navegador locales, garantizando que el usuario visualice sus imágenes médicas tanto al redactar como al alternar entre modos sin romper el flujo de trabajo.

#### Scenario: Pegar una foto de pizarra

- **WHEN** el usuario pega una imagen del portapapeles dentro de un artículo
- **THEN** la imagen se muestra en el editor, se guarda como dato local y sigue visible tras recargar sin conexión

#### Scenario: Previsualización de imágenes existentes en modo editor

- **WHEN** el usuario abre o cambia a modo Editor en un artículo que contiene una o más imágenes con esquema `asset://<id>`
- **THEN** el editor resuelve los blobs desde IndexedDB y muestra la vista previa gráfica de cada imagen dentro del bloque correspondiente en el lienzo de edición en lugar de un icono roto o vacío

#### Scenario: Previsualización de imágenes externas o data URLs en modo editor

- **WHEN** el artículo contiene imágenes con URLs HTTP/HTTPS o Data URLs
- **THEN** el editor renderiza la imagen directamente preservando la URL original
