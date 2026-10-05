# Spec Delta

## MODIFIED Requirements

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
