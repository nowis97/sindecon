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

El sistema SHALL permitir insertar imágenes pegando desde el portapapeles, arrastrando un archivo o capturando con la cámara (móvil). Las imágenes SHALL almacenarse localmente como blobs (comprimidas a un tamaño razonable al importar) y referenciarse en el Markdown con una referencia interna resoluble offline.

#### Scenario: Pegar una foto de pizarra

- **WHEN** el usuario pega una imagen del portapapeles dentro de un artículo
- **THEN** la imagen se muestra en el editor, se guarda como dato local y sigue visible tras recargar sin conexión

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

El sistema SHALL ofrecer una vista de lectura de cada artículo que renderice el Markdown completo (formato, tablas, listas, imágenes y esquemas mermaid) con tipografía optimizada para lectura médica y soporte de alineación justificada del texto (`text-align: justify`). Las imágenes médicas SHALL mostrarse centradas horizontalmente, adaptándose fluidamente al ancho de su columna tanto en vista de 1 como de 2 columnas o dentro de bloques multicolumna, sin desbordar los límites del contenedor y con protección contra cortes verticales entre columnas (`break-inside: avoid`). Las imágenes en modo lector SHALL ser estáticas y libres de pistas interactivas o modales de ampliación (zoom). Asimismo, el sistema SHALL proveer un control en la barra de herramientas del lector para alternar opcionalmente entre alineación justificada e izquierda, persistiendo dicha preferencia en el almacenamiento local. En pantallas estrechas, los esquemas mermaid anchos SHALL permitir zoom y desplazamiento.

#### Scenario: Consulta en el hospital desde el móvil

- **WHEN** el usuario abre un artículo con un algoritmo mermaid ancho en el móvil
- **THEN** puede leer el artículo y hacer zoom/pan sobre el diagrama sin perder legibilidad

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
