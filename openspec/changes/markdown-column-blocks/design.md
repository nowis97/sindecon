# Design: Bloques Multicolumna en Markdown Clínico

## Context
See proposal.md for motivation and context.
Actualmente `ArticleReader.tsx` procesa el Markdown plano en un array lineal de bloques tipados (`Block[]`) mediante la función `parseMarkdownBlocks(md)`. Esta arquitectura permite introducir nuevos tipos de bloques contenedores de forma modular sin alterar los tipos existentes.

## Goals / Non-Goals

**Goals:**
- Extender el parser `parseMarkdownBlocks` para reconocer bloques `:::columns` y subsecciones delimitadas por `|||`.
- Permitir renderizado recursivo de cualquier bloque soportado dentro de cada columna (listas, tablas, fórmulas LaTeX, callouts, diagramas mermaid).
- Aplicar diseño responsivo fluido: 2 o 3 columnas paralelas en pantallas de más de 640px; apilamiento vertical suave en pantallas móviles.
- Integrar un botón en `MarkdownEditor.tsx` para insertar la plantilla a 1 toque.
- Mantener compatibilidad con la vista de impresión y exportación a PDF.

**Non-Goals:**
- Columnas infinitamente anidadas dentro de columnas (se restringe a 1 nivel de columnas para evitar layouts ilegibles).
- Anchos porcentuales arbitrarios por columna (se utiliza distribución equitativa `1fr` para consistencia tipográfica médica).

## Decisions

### 1. Definición del Tipo de Bloque AST
Se añade el tipo `columns` al enum/unión `Block`:
```ts
type Block =
  | ...
  | { type: 'columns'; columns: Block[][] }
```
*Razón*: Cada columna contiene su propia lista independiente de bloques (`Block[]`), permitiendo reutilizar la función de renderizado `renderBlock` de forma recursiva e idéntica a la raíz del documento.

### 2. Sintaxis y Delimitación
- Apertura: `:::columns` o `:::col` al inicio de una línea.
- Separador de columna: `|||` en su propia línea.
- Cierre: `:::` en su propia línea.

*Alternativas consideradas*:
- HTML `<div class="columns">`: Rechazado por ensuciar el Markdown y no ser amigable con la escritura en móvil.
- Directiva de Callout `> [!COLUMNS]`: Rechazado por requerir el prefijo `>` en cada línea, haciendo tediosa la edición de tablas o listas largas.

### 3. Renderizado y CSS Grid
El contenedor `.article-columns-grid` utiliza CSS Grid:
```css
.article-columns-grid {
  display: grid;
  grid-template-columns: repeat(var(--col-count, 2), minmax(0, 1fr));
  gap: 16px;
  margin: 14px 0;
}

@media (max-width: 640px) {
  .article-columns-grid {
    grid-template-columns: 1fr;
    gap: 12px;
  }
}
```
Cada columna se envuelve en `.article-column-item` con estilos de aislamiento tipográfico.

## Risks / Trade-offs

- **[Riesgo] Bloques de código conteniendo `|||` o `:::`**  
  $\rightarrow$ *Mitigación*: El parser detecta los bloques de código cercados (fenced blocks ```` ``` ````) prioritariamente antes de evaluar delimitadores de columna.
- **[Riesgo] Bloque `:::columns` sin cerrar al final del archivo**  
  $\rightarrow$ *Mitigación*: Si el archivo termina sin el delimitador de cierre `:::`, el parser cierra automáticamente el bloque consumiendo el contenido restante sin arrojar excepciones ni perder texto.
