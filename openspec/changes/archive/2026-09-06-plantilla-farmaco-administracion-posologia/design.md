## Context

Ver `proposal.md` para la justificación clínica y `specs/templates/spec.md` para los requerimientos normativos.

Actualmente, SINDECON define 11 plantillas maestras oficiales en `app/src/db/templates.ts` a través de la constante `TEMPLATES: Template[]`. La función constructora `buildTemplateBody(template: Template)` genera el Markdown inicial usando una lógica simple basada en `kind: 'text' | 'table' | 'algorithm' | 'list'`.

Para plasmar fielmente el formato manuscrito aportado en el PDF de 3 páginas, se requiere que la nueva plantilla provea ítems guiados específicos (como campos de preparación/dilución, incompatibilidades de mezcla y listas con conteo clínico predeterminado para indicaciones, RAM, marcas chilenas, contraindicaciones y fuentes).

## Goals / Non-Goals

**Goals:**
- Implementar la plantilla maestra `Fármaco / Posología y administración clínica` con fidelidad exacta a las 3 páginas del PDF manuscrito.
- Extender la interfaz `Section` y la función `buildTemplateBody` de forma retrocompatible para permitir `defaultContent` o ítems guiados.
- Actualizar la lógica de siembra (`seedTemplatesIfNeeded`) para que incorpore la nueva plantilla en bases de datos existentes sin tocar plantillas ya editadas ni alterar la carpeta `Plantillas`.
- Actualizar y enriquecer la suite de tests en `templates.test.ts` (ahora 12 plantillas oficiales).

**Non-Goals:**
- No se reemplaza ni se altera la plantilla previa `Fármaco / Ficha farmacológica` (ambas coexisten para propósitos distintos: una monográfica/teórica y otra práctica/operativa de guardia).
- No se modifica la estructura del editor WYSIWYG ni los componentes de navegación.

## Decisions

### Decisión 1: Extensión retrocompatible de `Section` en `templates.ts`
- **Elección:** Añadir la propiedad opcional `defaultContent?: string[]` a la interfaz `Section`.
- **Razón:** Permite que cualquier sección defina exactamente su contenido inicial en Markdown (p.ej. los campos con viñetas de *Preparación y ajuste*, los 9 ítems de *Indicaciones*, los 10 de *Contraindicaciones*, o las fuentes divididas). Si `defaultContent` no está presente, `buildTemplateBody` ejecuta su comportamiento estándar (`kind: 'table'`, `algorithm`, `list` o `Escribe aquí.`).
- **Alternativas descartadas:** Crear múltiples `kind` específicos (como `'numbered-9'`, `'preparacion-fields'`), lo cual sobrecargaría el tipado con lógica ad-hoc. `defaultContent` es limpio, declarativo y reutilizable.

### Decisión 2: Estructura exacta de la plantilla según el manuscrito
La plantilla `Fármaco / Posología y administración clínica` tendrá la siguiente definición de secciones:
1. `Qué es, grupo farmacológico y datos generales`: Párrafo introductorio o recuadro resumen.
2. `Indicaciones`: Lista numerada del 1 al 9.
3. `Posología`: Tabla con encabezados `['Contexto', 'Dosis', 'Frecuencia', 'Vía', 'Máximo diario', 'Acotaciones']`.
4. `Preparación y ajuste`:
   - `- **Dilución:** (en qué y en cuánto)`
   - `- **Tiempo de administración:** (en cuánto tiempo pasar)`
   - `- **Ajuste en IRA:**`
   - `- **Ajuste en DHC:**`
   - `- **NO mezclar con:**`
5. `RAM relevantes`: Lista numerada del 1 al 9.
6. `Marcas comerciales en Chile`: Lista numerada del 1 al 5.
7. `Contraindicaciones`: Lista numerada del 1 al 10.
8. `Fuentes`: Bloques separados con delimitadores o subtítulos (Guías clínicas, Fichas de referencia, etc.) con numeración 1 a 5.

### Decisión 3: Clave de siembra y actualización idempotente
- **Elección:** Añadir la siembra de la nueva plantilla de manera idempotente comprobando individualmente la existencia de su nodo (`sys-tpl-farmaco-posologia-y-administracion-clinica`). Adicionalmente, actualizar el marcador de versión de siembra (p. ej. `seeded_templates_v2_1`) para que usuarios que ya abrieron la app en `v2` reciban automáticamente la nueva plantilla sin necesidad de borrar IndexedDB ni reiniciar manualmente.
- **Razón:** Garantiza que tanto usuarios nuevos como existentes cuenten con la plantilla inmediatamente en su árbol lateral y dashboard.

## Risks / Trade-offs

- **[Riesgo]** Confusión entre las dos plantillas de fármacos.  
  **Mitigación:** Títulos claramente diferenciados: `Fármaco / Ficha farmacológica` (enfoque farmacológico general/mecanismo de acción) vs `Fármaco / Posología y administración clínica` (enfoque operativo de guardia, preparación y dosificación).
- **[Riesgo]** Romper pruebas existentes que esperan exactamente 11 plantillas.  
  **Mitigación:** Actualizar los tests unitarios en `templates.test.ts` para validar las 12 plantillas oficiales y verificar exhaustivamente el contenido generado para la nueva plantilla.
