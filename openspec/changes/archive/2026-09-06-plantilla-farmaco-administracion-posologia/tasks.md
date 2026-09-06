## 1. Extensión del modelo y generador de plantillas

- [x] 1.1 Extender la interfaz `Section` en `app/src/db/templates.ts` con la propiedad opcional `defaultContent?: string[]` y actualizar `buildTemplateBody` para incluir dicho contenido cuando esté definido, verificando con `npm test` en `app/`.
- [x] 1.2 Definir la plantilla `Fármaco / Posología y administración clínica` en el arreglo `TEMPLATES` de `app/src/db/templates.ts` con todas las secciones del manuscrito (resumen general, indicaciones 1-9, tabla de posología con 6 columnas, preparación/ajuste, RAM 1-9, marcas comerciales en Chile 1-5, contraindicaciones 1-10 y fuentes).

## 2. Siembra y persistencia

- [x] 2.1 Actualizar `seedTemplatesIfNeeded` en `app/src/db/templates.ts` para asegurar la siembra idempotente de la nueva plantilla en la carpeta `Plantillas/` tanto para instalaciones nuevas como existentes (usando verificación directa de nodo o actualización a marcador `seeded_templates_v2_1`).

## 3. Pruebas y verificación

- [x] 3.1 Actualizar los tests unitarios en `app/src/db/templates.test.ts` para validar las 12 plantillas oficiales y agregar aserciones específicas sobre las secciones, tabla y contenido guiado de `Fármaco / Posología y administración clínica`.
- [x] 3.2 Ejecutar `npm test` en `app/` y comprobar que todos los tests unitarios pasen sin errores ni advertencias de regresión.
