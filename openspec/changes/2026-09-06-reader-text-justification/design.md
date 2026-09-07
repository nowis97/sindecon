## Context

El modo Lector (`ArticleReader.tsx`) procesa y renderiza el árbol de bloques Markdown enriquecido para artículos médicos. Actualmente el texto se alinea a la izquierda por defecto. La adición de alineación justificada requiere una configuración tipográfica limpia en CSS con manejo de guionado silábico y un selector intuitivo en la barra de herramientas.

## Goals / Non-Goals

**Goals:**
- Proporcionar alineación de texto justificada (`text-align: justify`, `text-justify: inter-word`, `hyphens: auto`) para párrafos, listas, callouts y citas en modo Lector y en la vista de impresión/exportación PDF.
- Añadir un control en la barra de herramientas del lector (`reader-toolbar-row`) para alternar entre justificado e izquierda.
- Persistir la preferencia de alineación en `localStorage` con la clave `sindecon_reader_text_align` (valor por defecto `'justify'`).
- Preservar la alineación izquierda o centrada en encabezados (`.reader-heading`), bloques de código (`.reader-code-block`) y celdas de tablas (`.reader-table`).

**Non-Goals:**
- Modificar el comportamiento de edición WYSIWYG del editor ProseMirror/Milkdown (el editor mantiene su flujo visual estándar).
- Afectar el visor de flashcards o el árbol de navegación.

## Decisions

### 1. Clases CSS de Alineación y Reglas Tipográficas
- Aplicar la clase `.text-justified` en `.article-reader-view` y `.print-reader-view`.
- En `index.css`:
  ```css
  .article-reader-view.text-justified .reader-paragraph,
  .article-reader-view.text-justified .reader-blockquote,
  .article-reader-view.text-justified .reader-callout-text,
  .article-reader-view.text-justified .reader-list,
  .article-reader-view.text-justified .article-column-item p,
  .print-reader-view.text-justified .reader-paragraph,
  .print-reader-view.text-justified .reader-blockquote,
  .print-reader-view.text-justified .reader-callout-text {
    text-align: justify;
    text-justify: inter-word;
    hyphens: auto;
    -webkit-hyphens: auto;
  }
  ```
- *Alternativas consideradas*: Justificar forzosamente sin opción de alternar. *Razón*: Aunque el texto justificado es el estándar para fichas médicas editoriales, algunos usuarios prefieren alineación a la izquierda según el tamaño de pantalla o preferencia personal.

### 2. Estado React y Persistencia
- Añadir estado en `ArticleReader.tsx`:
  ```tsx
  const [isJustified, setIsJustified] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem('sindecon_reader_text_align')
      return saved !== null ? saved === 'justify' : true
    } catch {
      return true
    }
  })
  ```
- Botón en `reader-toolbar-row`:
  ```tsx
  <button
    type="button"
    className={`btn-reader-align-toggle ${isJustified ? 'active' : ''}`}
    onClick={toggleAlignment}
    title={isJustified ? 'Cambiar a alineación izquierda' : 'Cambiar a texto justificado'}
  >
    {isJustified ? '↔️ Justificado' : '⬅️ Izquierda'}
  </button>
  ```

## Risks / Trade-offs

- **[Riesgo]** Huecos blancos excesivos en líneas con términos médicos largos.  
  → **Mitigación**: Uso de `hyphens: auto`, `-webkit-hyphens: auto` y `text-justify: inter-word` junto a `word-break: break-word` para un ajuste silábico natural en español.
