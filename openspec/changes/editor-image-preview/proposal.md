# Proposal: Previsualización de Imágenes en Modo Editor

## Why

En el modo editor (`MarkdownEditor` basado en Milkdown Crepe), las imágenes que referencian recursos locales mediante el esquema `asset://<id>` no muestran una vista previa y aparecen rotas o invisibles. Esto ocurre porque Crepe utiliza su componente interno `ImageBlock` (`image-block` e `image-inline`), el cual espera un transformador `proxyDomURL` para convertir esquemas personalizados a URLs cargables por el navegador (`blob:`). Al no estar configurado dicho hook, el navegador intenta solicitar directamente `asset://<id>`, provocando que el usuario pierda el contexto visual de sus imágenes médicas mientras redacta o edita.

## What Changes

- Configurar `proxyDomURL` en la característica `[Crepe.Feature.ImageBlock]` de `MarkdownEditor.tsx` para resolver las URLs `asset://<id>` extrayendo los blobs correspondientes desde IndexedDB (`getAssetBlob`) y generando un Object URL (`blob:http...`).
- Actualizar `imageAssetPlugin` / `imageAssetView.ts` para que soporte los tipos de nodos `image-block`, `image` e `image-inline` de Milkdown Crepe como capa de respaldo coherente.
- Añadir limpieza de Object URLs creados para evitar fugas de memoria durante el ciclo de vida del editor.
- Asegurar que imágenes externas (`http`, `https`, `data:`) continúen mostrándose sin alteraciones.

## Capabilities

### New Capabilities
None

### Modified Capabilities
- `content-editing`: Se amplía el requisito de imágenes locales para garantizar que toda imagen con esquema `asset://` se resuelva y renderice con vista previa visual inmediata dentro del editor interactivo (`MarkdownEditor`), tanto al cargar notas existentes como al insertar nuevas imágenes.

## Impact

- **Código afectado**:
  - `app/src/components/editor/MarkdownEditor.tsx`: Configuración de `proxyDomURL` en `Crepe.Feature.ImageBlock`.
  - `app/src/components/editor/imageAssetView.ts`: Soporte adecuado de nodos `image-block` y resolución asíncrona de blobs.
- **Rendimiento y Memoria**: Resolución local-first directa desde IndexedDB mediante URLs de objeto blob efímeras.
- **Pruebas**: Nuevas pruebas unitarias y E2E en Playwright verificando la previsualización de imágenes en el editor.
