## Purpose

Crear y leer contenido médico rico (texto formateado, tablas, listas, imágenes y esquemas) mediante edición visual, con Markdown como formato de almacenamiento portable.

## Requirements

### Requirement: Edición WYSIWYG sobre Markdown

El sistema SHALL ofrecer edición visual (estilo Word) del contenido de los artículos, persistiendo el resultado como Markdown GFM. El round-trip (editar → guardar → recargar) MUST ser sin pérdidas: el documento recargado es equivalente al editado. El editor SHALL limitarse a lo que Markdown puede expresar (sin colores de fuente, tipografías ni layouts ajenos a Markdown).

#### Scenario: Round-trip sin pérdida

- **WHEN** el usuario edita un artículo con encabezados, negritas, listas y una tabla, y luego recarga la aplicación
- **THEN** el artículo se muestra con el mismo contenido y formato, y el Markdown guardado lo representa íntegramente

### Requirement: Tablas editables visualmente

El sistema SHALL permitir crear y editar tablas de forma visual (añadir/eliminar filas y columnas, editar celdas), persistiendo como tablas Markdown GFM.

#### Scenario: Editar tabla de fármacos

- **WHEN** el usuario añade una fila a la tabla de dosificación y escribe en sus celdas
- **THEN** la tabla se actualiza visualmente y el Markdown guardado contiene la fila nueva en sintaxis GFM

### Requirement: Esquemas mermaid con preview en vivo

El sistema SHALL soportar bloques de esquema en sintaxis mermaid dentro de los artículos. En el editor, cada bloque mermaid SHALL ofrecer alternar entre el código fuente y el diagrama renderizado (preview). Si la sintaxis es inválida, el sistema SHALL mostrar un indicador de error en lugar del diagrama.

#### Scenario: Ver el algoritmo renderizado mientras se edita

- **WHEN** el usuario escribe un bloque `mermaid` con un flowchart válido y activa el preview
- **THEN** el diagrama se renderiza dentro del editor sin salir del artículo

#### Scenario: Sintaxis mermaid inválida

- **WHEN** el bloque mermaid contiene un error de sintaxis
- **THEN** el editor muestra un aviso de error y el artículo conserva el código fuente sin perderse

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

### Requirement: Pegar Markdown crudo interpretado

El sistema SHALL interpretar como Markdown el texto plano pegado desde fuentes externas (notas, otros editores): encabezados, negritas, listas, tablas y fences de código se convierten en contenido formateado. Al pegar dentro de un bloque de código, el sistema SHALL insertar el texto literal sin interpretar.

#### Scenario: Pegar apuntes en markdown

- **WHEN** el usuario pega texto plano que contiene `## Sección` y una tabla GFM
- **THEN** el editor muestra el encabezado formateado y una tabla visual, no el texto con símbolos

#### Scenario: Pegar sintaxis mermaid dentro de un bloque de código

- **WHEN** el usuario pega `flowchart TD ...` estando el cursor dentro de un bloque de código
- **THEN** el texto queda literal como contenido del bloque

### Requirement: Copiar serializa a Markdown

El sistema SHALL serializar a Markdown el contenido copiado desde el editor, de modo que pegarlo en un editor de texto externo produzca Markdown portable.

#### Scenario: Copiar contenido hacia afuera

- **WHEN** el usuario selecciona contenido con formato en el editor y lo pega en un editor de texto plano
- **THEN** el texto pegado es Markdown válido que representa ese contenido

### Requirement: Vista lector

El sistema SHALL ofrecer una vista de lectura de cada artículo que renderice el Markdown completo (formato, tablas, listas, imágenes y esquemas mermaid) con tipografía optimizada para lectura médica y soporte de alineación justificada del texto (`text-align: justify`). Las imágenes médicas SHALL mostrarse centradas horizontalmente, adaptándose fluidamente al ancho de su columna tanto en vista de 1 como de 2 columnas o dentro de bloques multicolumna, sin desbordar los límites del contenedor y con protección contra cortes verticales entre columnas (`break-inside: avoid`). Las imágenes en modo lector SHALL ser estáticas y libres de pistas interactivas o modales de ampliación (zoom). Asimismo, el sistema SHALL proveer un control en la barra de herramientas del lector para alternar opcionalmente entre alineación justificada e izquierda, persistiendo dicha preferencia en el almacenamiento local. En pantallas estrechas, los esquemas mermaid anchos SHALL permitir zoom y desplazamiento. La presentación tipográfica SHALL aplicar un interlineado compacto de alta densidad informativa, y los encabezados de nivel 1 (h1) SHALL presentar el mismo estilo visual distintivo de los encabezados de nivel 2 (h2) (color de acento y subrayado temático), diferenciándose por una escala de tamaño superior.

#### Scenario: Consulta en el hospital desde el móvil

- **WHEN** el usuario abre un artículo con un algoritmo mermaid ancho en el móvil
- **THEN** puede leer el artículo y hacer zoom/pan sobre el diagrama sin perder legibilidad

#### Scenario: Interlineado compacto en lectura de notas clínicas

- **WHEN** el usuario visualiza artículos médicos en modo lector o editor
- **THEN** el texto, párrafos y listas se renderizan con un interlineado denso y cómodo (~1.48) que maximiza el contenido visible por pantalla

#### Scenario: Estilo unificado de Heading 1 respecto a Heading 2

- **WHEN** el artículo contiene encabezados de nivel 1 (# Título) y nivel 2 (## Sección)
- **THEN** h1 se renderiza con el mismo tratamiento estético que h2 (color de acento temático y borde inferior subrayado), manteniendo un tamaño de fuente mayor para preservar la jerarquía

#### Scenario: Lectura con texto justificado por defecto

- **WHEN** el usuario visualiza un artículo en modo Lector
- **THEN** los párrafos, listas, citas médicas y callouts se presentan con alineación justificada uniforme y guionado silábico suave para una óptima lectura clínica.

#### Scenario: Alternar alineación de texto a la izquierda

- **WHEN** el usuario hace clic en el botón de alternancia de alineación en la barra de herramientas del lector
- **THEN** el lector cambia la presentación del texto a alineación a la izquierda y guarda la preferencia en `localStorage`.

#### Scenario: Centrado y ajuste de imágenes en maquetación de 2 columnas

- **WHEN** el usuario visualiza un artículo con imágenes en modo de 2 columnas o en bloques de columnas paralelas
- **THEN** la imagen se renderiza centrada en la columna, escalada proporcionalmente al 100% del ancho de la columna sin generar desbordamiento ni saltos cortados.

#### Scenario: Imagen limpia sin opción de zoom

- **WHEN** el usuario visualiza una imagen médica en el modo lector
- **THEN** la imagen no presenta mensajes de ampliación ("🔍 Toca para ampliar"), no responde con aperturas de modal al hacer clic y mantiene el cursor estándar de lectura.

### Requirement: Micro-interacciones en lectura, edición e importación

El sistema SHALL proveer retroalimentación visual fluida al alternar modos de visualización, interactuar con elementos médicos enriquecidos y procesar contenidos importados.

#### Scenario: Alternancia animada entre modo Lector y Editor

- **WHEN** el usuario hace clic en los botones del control segmentado (Lector / Editor)
- **THEN** el indicador de selección se desplaza hacia el modo elegido y el contenido realiza un desvanecimiento cruzado suave sin alterar la posición de scroll

#### Scenario: Interacción táctil en Callouts clínicos y tablas

- **WHEN** el usuario visualiza o interactúa con callouts de alerta, dosis de fármacos o perlas clínicas en modo lector
- **THEN** los elementos proporcionan una respuesta visual de realce con micro-sombras y bordes con brillo clínico

#### Scenario: Retroalimentación en el asistente de importación inteligente

- **WHEN** el usuario arrastra un archivo Word (.docx) o pega texto en el modal de importación
- **THEN** la zona de suelta reacciona visualmente y la vista previa de conversión se actualiza con transiciones suaves

### Requirement: Cabecera de artículo estilo Notion con segmented tabs y pill tags
La vista de artículo DEBE contar con una cabecera limpia con breadcrumbs jerárquicos, segmented control para alternar entre `Lector`, `Editor` e `Importar IA`, etiquetas estilo pastilla (`badge-pill`) con colores distintivos y soporte completo de modo oscuro.

#### Scenario: Edición de etiquetas y cambio de vista
- **WHEN** el usuario añade una etiqueta o cambia entre modo Lector y Editor
- **THEN** la vista actualiza el control segmentado con animación suave y renderiza las etiquetas con alto contraste

### Requirement: Visualizador interactivo de documentos PDF en artículos
El sistema SHALL detectar artículos cuyo contenido principal sea un documento PDF referenciado mediante un asset local (`asset://<id>`) y renderizar un visor de PDF integrado en el modo lectura del artículo (`ArticleReader`), ofreciendo controles para interactuar con el documento (zoom, navegación de páginas e impresión nativa) sin necesidad de software de terceros. Adicionalmente, el visor SHALL proveer acciones de respaldo para descargar el archivo PDF original o abrirlo en una pestaña independiente del navegador.

#### Scenario: Renderizado del visor nativo de PDF en modo lectura
- **WHEN** el usuario selecciona un artículo que contiene un documento PDF
- **THEN** el lector de artículos muestra el visor embebido con el archivo cargado directamente desde IndexedDB (`URL.createObjectURL(blob)`), adaptado al ancho de la pantalla

#### Scenario: Abrir en pestaña nueva y descargar archivo
- **WHEN** el usuario pulsa en el botón "↗️ Abrir en pestaña" o "⬇️ Descargar" en la barra de herramientas del visor de PDF
- **THEN** el sistema abre el documento en una pestaña independiente o inicia la descarga del archivo binario con el nombre del artículo

#### Scenario: Renombrar artículo con documento PDF
- **WHEN** el usuario hace clic en el botón de renombrar (`btn-article-rename`) en la cabecera del visor de un artículo PDF
- **THEN** el título del artículo se actualiza en IndexedDB, en el árbol lateral y en la cabecera del visor manteniendo el archivo PDF intacto

### Requirement: Modo de anotación a mano alzada en visor de PDF

El sistema SHALL proporcionar un modo interactivo de anotaciones a mano alzada dentro del visor de documentos PDF (`PdfDocumentViewer`). Cuando el modo de anotación esté activado, el sistema SHALL capturar eventos de puntero (ratón, lápiz óptico/stylus y toque táctil) sobre una capa de lienzo transparente alineada con cada página del PDF, deshabilitando el desplazamiento gestual accidental sobre el área de dibujo (`touch-action: none`). Cuando el modo esté desactivado, el visor SHALL permitir el desplazamiento y paneo normal del documento.

#### Scenario: Activar modo de anotación y dibujar sobre la página
- **WHEN** el usuario pulsa el botón "Anotar / Modo Lápiz" en la barra del visor de PDF
- **THEN** la barra de herramientas de dibujo se hace visible, el cursor cambia a indicador de dibujo y los trazos realizados sobre cualquier página del PDF quedan dibujados en tiempo real sobre la capa de la página

#### Scenario: Desactivar modo de anotación para desplazarse libremente
- **WHEN** el usuario desactiva el modo de anotación pulsando nuevamente el botón de alternancia o cerrando la barra de dibujo
- **THEN** las anotaciones dibujadas permanecen visibles sobre las páginas y el usuario puede hacer scroll vertical y horizontal sin realizar trazos accidentales

### Requirement: Herramientas de trazo (Lápiz, Resaltador y Borrador)

El sistema SHALL proveer una paleta de herramientas de anotación con al menos tres modos:
1. **Lápiz / Bolígrafo:** Trazo fino continuo y opaco con grosor configurable y selector de color (ej. negro, azul, rojo y verde).
2. **Resaltador:** Trazo grueso semitransparente que permite leer el texto subyacente del PDF (ej. amarillo fluorescente, verde claro o rosa).
3. **Borrador:** Herramienta para eliminar trazos dibujados previamente al pasar sobre ellos o hacer clic en ellos.
4. **Deshacer / Limpiar:** Acciones para deshacer el último trazo realizado (`Undo`) y limpiar todos los trazos de la página activa.

#### Scenario: Resaltar texto médico en una página del PDF
- **WHEN** el usuario selecciona la herramienta de resaltador amarillo y traza una línea sobre una sección de texto de la página
- **THEN** se dibuja un trazo translúcido que destaca el texto manteniéndolo completamente legible

#### Scenario: Borrar un trazo dibujado
- **WHEN** el usuario selecciona la herramienta borrador y toca un trazo previamente dibujado en la página
- **THEN** el trazo correspondiente se elimina de la capa de dibujo sin afectar el contenido original del PDF

#### Scenario: Deshacer último trazo
- **WHEN** el usuario realiza un trazo incorrecto y pulsa el botón "Deshacer"
- **THEN** el último trazo dibujado en la página actual desaparece inmediatamente

### Requirement: Escalado vectorial y persistencia local de anotaciones

Las anotaciones de cada página del PDF SHALL almacenarse como secuencias de trazos vectoriales normalizados respecto a la resolución base (escala 1.0) de la página. El sistema SHALL guardar automáticamente las anotaciones de cada página en el almacenamiento local persistente (IndexedDB) asociado al artículo. Al cambiar el zoom del PDF (ampliar o reducir) o al recargar la aplicación, el sistema SHALL redibujar los trazos escalados proporcionalmente para que su posición y dimensiones coincidan exactamente con el contenido del PDF.

#### Scenario: Mantener posición exacta de anotaciones al cambiar zoom
- **WHEN** el usuario dibuja un círculo alrededor de un término en una página y luego aumenta el zoom al 150%
- **THEN** las dimensiones del círculo y su posición relativa sobre el término aumentan proporcionalmente sin desplazarse ni desfasarse

#### Scenario: Persistencia y restauración tras recargar
- **WHEN** el usuario realiza anotaciones en un PDF, navega a otro artículo o recarga la aplicación y vuelve al PDF
- **THEN** las anotaciones dibujadas se cargan desde el almacenamiento local y se muestran exactamente en sus respectivas páginas

### Requirement: Bloques de columnas paralelas (:::columns)
El sistema SHALL interpretar y renderizar bloques delimitados por `:::columns` y `:::` conteniendo uno o más separadores `|||` como un diseño de columnas paralelas en Modo Lector. Cada columna individual SHALL parsear y renderizar contenido Markdown completo (encabezados, listas anidadas, tablas, fórmulas LaTeX, imágenes, enlaces wiki y callouts). En pantallas de ancho menor a 640px (móvil), el sistema SHALL apilar las columnas verticalmente preservando el orden de lectura.

#### Scenario: Renderizar dos columnas con contenido médico variado
- **WHEN** un artículo contiene un bloque `:::columns` con una sección a la izquierda y otra a la derecha separadas por `|||`
- **THEN** el Modo Lector muestra ambas columnas en paralelo en pantallas de escritorio y tableta, renderizando negritas, listas y tablas dentro de cada una

#### Scenario: Renderizar tres columnas dinámicas
- **WHEN** un artículo contiene un bloque `:::columns` con dos separadores `|||` (tres secciones de contenido)
- **THEN** el Modo Lector distribuye el ancho disponible equitativamente entre las 3 columnas en escritorio

#### Scenario: Apilamiento responsivo en dispositivos móviles
- **WHEN** el usuario visualiza un artículo con `:::columns` en una pantalla de ancho reducido (< 640px)
- **THEN** las columnas se muestran apiladas secuencialmente una debajo de la otra sin desbordamiento horizontal

### Requirement: Inserción de plantilla de columnas en editor
El sistema SHALL incluir un control de acción rápida en la barra de herramientas del editor Markdown que inserte la plantilla básica de dos columnas `:::columns` con divisor `|||` en la posición del cursor.

#### Scenario: Insertar plantilla de columnas a 1 toque
- **WHEN** el usuario pulsa el botón de columnas en la barra de herramientas del editor
- **THEN** se inserta el bloque `:::columns` con dos columnas de ejemplo en la posición activa del cursor
