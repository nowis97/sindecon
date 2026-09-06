## ADDED Requirements

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
