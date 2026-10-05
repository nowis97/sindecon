# Propuesta: Densidad Tipográfica (Interlineado Reducido y Estilización Unificada de H1/H2)

## Why

Para optimizar la consulta rápida y la densidad de información en entornos médicos y clínicos (lectura de protocolos, dosis, cuadros diagnósticos y fichas de estudio), el interlineado actual (1.75 / 1.65) resulta excesivamente espaciado. Asimismo, el encabezado h1 posee un estilo discordante (mayúsculas forzadas, subrayado tenue de ancho completo) respecto al diseño distintivo del encabezado h2 (color teal temático, subrayado a juego e inline-block).

Se requiere reducir el interlineado de todos los elementos de contenido y unificar la identidad visual de h1 con el estilo de h2, preservando una clara jerarquía mediante un tamaño de letra proporcionalmente mayor.

## What Changes

- **Interlineado Compacto y Densidad Visual**:
  - Reducción de line-height en .article-reader-view y .editor-host de 1.75 a 1.48.
  - Reducción de line-height en .reader-list y listas anidadas de 1.65 a 1.38.
  - Ajuste de espaciados verticales (margin-bottom en párrafos y bloques) para acompañar el ritmo tipográfico compacto sin perder legibilidad.
- **Unificación de Estilo en Heading 1 (h1)**:
  - h1 adopta el mismo tratamiento visual que h2: color temático ar(--reader-h2-color), subrayado directo order-bottom: 2px solid var(--reader-h2-color), display: inline-block y tipografía natural (sin forzar mayúsculas).
  - Jerarquía clara de tamaño: h1 mantiene un tamaño superior (1.48rem / 24px) respecto a h2 (1.22rem / 19.5px).
  - Adaptación coherente en modo oscuro, maquetación de 2 columnas y estilos de impresión (@media print).

## Capabilities

### Modified Capabilities
- content-editing: Refinar la presentación tipográfica y jerarquía de encabezados en la lectura y edición de artículos.

## Impact

- **Código**: pp/src/index.css.
- **Experiencia de Usuario**: Lectura más ágil, mayor volumen de información visible por pantalla sin scroll excesivo y diseño armónico en títulos médicos.
