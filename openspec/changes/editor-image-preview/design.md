# Design: Previsualización de Imágenes en Modo Editor

## Context

Sindecon almacena los archivos multimedia (imágenes médicas y capturas) como blobs en IndexedDB (`assets`), referenciándolos en Markdown con el esquema local `asset://<id>`.
En el modo lectura, `AssetImage.tsx` intercepta este esquema, recupera el blob con `getAssetBlob(id)` y genera un `blob:` Object URL para la etiqueta `<img>`.
En el modo edición, `MarkdownEditor.tsx` utiliza `@milkdown/crepe`. Crepe procesa los bloques de imagen mediante su característica `ImageBlock`, la cual transforma las imágenes de Markdown en nodos personalizados de ProseMirror (`image-block` e `image-inline`) con componentes web/Vue internos.
Dichos componentes dependen del hook de configuración `proxyDomURL: (url: string) => Promise<string> | string` para transformar esquemas no estándar antes de asignarlos a `src.value`. Dado que dicho hook no estaba definido en `MarkdownEditor`, el editor dejaba el `src` como `asset://<id>`, provocando que el navegador no pudiera cargarlas. Además, el plugin `imageAssetView.ts` existente solo definía un `nodeView` para `image` (el cual es sustituido por `image-block` en Crepe), quedando inoperante.

## Goals / Non-Goals

**Goals:**
- Renderizar automáticamente una previsualización visual nítida de todas las imágenes locales (`asset://<id>`) en el editor Crepe, tanto al abrir artículos existentes como al insertar o pegar nuevas imágenes.
- Mantener compatibilidad total con imágenes externas (`http://`, `https://`) y Data URLs (`data:image/...`).
- Gestionar de forma higiénica los Object URLs creados (`URL.createObjectURL`), revocándolos al desmontar el editor o al actualizar imágenes para prevenir fugas de memoria.
- Proveer un estado visual de carga o fallback amigable si el asset no existe en IndexedDB.

**Non-Goals:**
- Modificar el esquema de almacenamiento en IndexedDB o la sintaxis `asset://<id>` en Markdown.
- Implementar herramientas de edición o recorte de imágenes dentro del editor.

## Decisions

### 1. Utilizar el hook nativo `proxyDomURL` en `Crepe.Feature.ImageBlock`
- **Decisión**: Configurar `proxyDomURL` directamente en la inicialización de Crepe dentro de `MarkdownEditor.tsx`:
  ```ts
  [Crepe.Feature.ImageBlock]: {
    onUpload: async (file: File) => {
      const compressed = await compressImage(file)
      const { id } = await createAssetFromFile(compressed)
      return `asset://${id}`
    },
    proxyDomURL: async (url: string) => {
      if (url.startsWith('asset://')) {
        const id = url.slice('asset://'.length)
        const blob = await getAssetBlob(id)
        if (blob) {
          const objectUrl = URL.createObjectURL(blob)
          activeObjectUrlsRef.current.add(objectUrl)
          return objectUrl
        }
      }
      return url
    },
  }
  ```
- **Razón**: Es el punto de extensión oficial y canónico de Milkdown Crepe. Funciona de manera transparente tanto en `imageBlockConfig` como en `inlineImageConfig`, resolviendo la promesa asíncrona antes de asignar el valor al DOM sin alterar la barra de herramientas de Crepe (caption, alinear, reemplazar).
- **Alternativa descartada**: Reemplazar todo el `nodeView` de `image-block` con un componente manual en ProseMirror. Esto rompería la integración de Crepe con el menú contextual de bloques, botones de subida y leyendas.

### 2. Ciclo de vida y limpieza de Object URLs
- **Decisión**: Mantener un `Set<string>` en un `useRef` (`activeObjectUrlsRef`) en `MarkdownEditor.tsx`. En la función de limpieza del `useEffect` de montaje del editor, iterar sobre el Set y ejecutar `URL.revokeObjectURL(url)`.
- **Razón**: Cada `URL.createObjectURL` reserva memoria en el proceso del navegador hasta que se revoca explícitamente o se recarga la pestaña. La limpieza en el desmontaje garantiza cero fugas de memoria en sesiones clínicas prolongadas con múltiples artículos.

### 3. Ajuste de compatibilidad en `imageAssetView.ts`
- **Decisión**: Mantener `imageAssetPlugin` actualizado para registrar vistas tanto en `image` como en `image-block` en caso de que algún parseo intermedio o plugin estándar requiera resolución Prosemirror pura.
- **Razón**: Principio de defensa en profundidad para garantizar que ninguna vía de renderizado quede desatendida.

## Risks / Trade-offs

- **[Riesgo] Asset eliminado o no encontrado en IndexedDB**: Si un artículo referencia un `asset://` cuyo registro fue eliminado o no sincronizado.
  → **Mitigación**: `proxyDomURL` devuelve un fallback visual (o mantiene la URL original para que Crepe active `onImageLoadError`), evitando excepciones no controladas.
- **[Riesgo] Múltiples resoluciones del mismo asset en un documento largo**:
  → **Mitigación**: `getAssetBlob` es una consulta rápida indexada por clave primaria en Dexie. Opcionalmente se puede memorizar en un mapa temporal `assetId -> objectUrl` durante la sesión activa del editor.
