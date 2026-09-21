## Context

En `app/src/db/exportImport.ts`, la función `importFromZip` itera sobre los archivos contenidos en `assets/` y ejecuta `await zip.file(path)!.async('nodebuffer')`. En un navegador o PWA, JSZip detecta que el objeto global `Buffer` de Node.js no existe y arroja `nodebuffer is not supported by this platform`.

## Goals / Non-Goals

**Goals:**
- Hacer que la extracción de assets en `importFromZip` utilice `async('uint8array')`, compatible de forma nativa en navegadores web, PWA y Node.js.
- Construir el `Blob` directamente con `new Blob([buf], { type: mime })` a partir del `Uint8Array`.
- Añadir un test unitario en `exportImport.test.ts` con assets binarios reales que garantice la no regresión.

**Non-Goals:**
- Modificar el protocolo de sincronización de Google Drive ni el formato de archivo ZIP existente (se mantiene `_manifest.json`, `assets/`, `.md`).
- Introducir polyfills pesados de Buffer en el bundle de Vite.

## Decisions

- **Usar `'uint8array'` en lugar de `'blob'` o `'arraybuffer'` en JSZip**:
  - *Razón*: `Uint8Array` es compatible tanto en el runtime de Node.js (Vitest) como en todos los navegadores modernos. Permite instanciar `new Blob([uint8Array], { type: mime })` de manera uniforme.
  - *Alternativas consideradas*:
    - Polyfill de Node Buffer: Descartado por violar la regla de simplicidad (Ponytail), añadir peso innecesario al bundle y complejizar la configuración de Vite.
    - `async('blob')`: En Node.js (Vitest sin DOM), JSZip puede requerir configuración adicional de Blob polyfill dependiendo de la versión de JSZip, mientras que `uint8array` es un tipo de datos universal de ECMAScript.

## Risks / Trade-offs

- **[Riesgo] Manejo de memoria con archivos adjuntos grandes en móviles**:
  - *Mitigación*: La extracción se realiza archivo por archivo dentro del bucle secuencial, liberando las referencias anteriores antes de persistir en Dexie.
