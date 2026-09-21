## Why

Al sincronizar con Google Drive o importar un respaldo `.zip` con imágenes/adjuntos en la PWA o cualquier navegador web, el proceso falla con la excepción `nodebuffer is not supported by this platform`. Esto ocurre porque el motor de importación (`importFromZip`) invoca el método `.async('nodebuffer')` de JSZip, el cual solo existe en entornos Node.js y no es soportado en navegadores web.

## What Changes

- Sustituir la llamada a `.async('nodebuffer')` por `.async('uint8array')` al procesar archivos de la carpeta `assets/` en `importFromZip`.
- Envolver directamente el `Uint8Array` en el `Blob` final para su almacenamiento en Dexie/IndexedDB sin depender de APIs exclusivas de Node.
- Agregar prueba unitaria específica que verifique el empaquetado y desempaquetado de assets reales tanto en Node como emulando estándares web.

## Capabilities

### New Capabilities
<!-- Ninguna nueva capacidad -->

### Modified Capabilities
- `data-portability`: Garantizar que la importación de respaldos con assets/imágenes sea 100% compatible con la plataforma web/PWA sin depender de Node.js Buffer.

## Impact

- `app/src/db/exportImport.ts`: Paso 4 de extracción de assets en `importFromZip`.
- `app/src/db/exportImport.test.ts`: Validación de importación con assets reales adjuntos.
