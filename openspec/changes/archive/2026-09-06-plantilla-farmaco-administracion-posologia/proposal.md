## Why

Actualmente SINDECON cuenta con la plantilla maestra "Fármaco / Ficha farmacológica" orientada a una revisión monográfica teórica (grupo, mecanismo de acción, semivida, metabolismo, etc.). Sin embargo, en el contexto de guardia y práctica clínica activa en Chile, se requiere una plantilla operativa y rápida centrada en la administración segura del medicamento, posología según contexto clínico, preparación/dilución, ajustes en falla orgánica (renal y hepática), incompatibilidades de mezcla ("NO mezclar con"), marcas comerciales disponibles en Chile, contraindicaciones y referencias bibliográficas, tal como está plasmado en el bosquejo clínico manuscrito.

## What Changes

- **Nueva Plantilla Maestra Clínica:** Incorporar la plantilla "Fármaco / Posología y administración clínica" al catálogo de plantillas oficiales en `templates.ts`.
- **Estructura según bosquejo manuscrito:**
  1. **Encabezado principal:** Título del fármaco (`# {título}`).
  2. **Identificación y resumen:** `## Qué es, grupo farmacológico y datos generales` (descripción esencial en recuadro o bloque de resumen).
  3. **Indicaciones:** `## Indicaciones` (lista estructurada con ítems numerados del 1 al 9).
  4. **Posología contextualizada:** `## Posología` con tabla estructurada conteniendo las columnas: `Contexto`, `Dosis`, `Frecuencia`, `Vía`, `Máximo diario` y `Acotaciones`.
  5. **Preparación y ajuste:** `## Preparación y ajuste` con ítems guiados:
     - Dilución (en qué solución y en cuánto volumen)
     - Tiempo de administración (en cuánto tiempo pasar / velocidad de infusión)
     - Ajuste en IRA (Insuficiencia Renal Aguda / alteración de función renal)
     - Ajuste en DHC (Daño Hepático Crónico / insuficiencia hepática)
     - NO mezclar con (incompatibilidades físico-químicas de infusión o coadministración)
  6. **Reacciones Adversas (RAM):** `## RAM relevantes` (lista estructurada de hasta 9 reacciones adversas clave).
  7. **Disponibilidad local:** `## Marcas comerciales en Chile` (lista estructurada de hasta 5 presentaciones comerciales en el mercado chileno).
  8. **Seguridad del paciente:** `## Contraindicaciones` (lista estructurada de hasta 10 contraindicaciones).
  9. **Evidencia:** `## Fuentes` (secciones separadas para guías, textos de referencia y fuentes oficiales).
- **Extensión del generador de plantillas (`buildTemplateBody`):** Soporte en `templates.ts` para ítems predefinidos en listas o texto guía sin alterar las 11 plantillas maestras existentes.
- **Siembra idempotente:** Actualización de la función de siembra para incorporar esta nueva plantilla en instalaciones existentes y nuevas sin pisar modificaciones de usuario.
- **Pruebas unitarias:** Actualización de `templates.test.ts` para verificar la siembra y formato de la nueva plantilla.

## Capabilities

### New Capabilities
<!-- Ninguna nueva capacidad a nivel de arquitectura general -->

### Modified Capabilities
- `templates`: Actualización del catálogo de plantillas maestras para incluir la nueva plantilla de farmacología clínica ("Fármaco / Posología y administración clínica"), detallando su estructura de secciones, tabla de posología y listas de seguridad farmacológica.

## Impact

- **Código modificado:**
  - `app/src/db/templates.ts`: Definición de la nueva plantilla, tipos de sección y siembra.
  - `app/src/db/templates.test.ts`: Validación de la siembra y contenido del Markdown generado.
- **Base de datos:** Se sembrará un nuevo nodo en la carpeta del sistema `Plantillas` (`sys-tpl-farmaco-posologia-y-administracion-clinica`) manteniendo retrocompatibilidad total.
- **Dependencias:** Cero dependencias nuevas.
