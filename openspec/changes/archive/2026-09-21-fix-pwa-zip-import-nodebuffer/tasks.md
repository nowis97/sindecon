## 1. Core Fix

- [x] 1.1 Reemplazar `zip.file(path)!.async('nodebuffer')` por `.async('uint8array')` en `app/src/db/exportImport.ts` y crear el Blob a partir del Uint8Array directamente.
- [x] 1.2 Agregar test unitario con assets binarios reales en `app/src/db/exportImport.test.ts` y verificar que la suite completa de pruebas pase con `npm test`.
