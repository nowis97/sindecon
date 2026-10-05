## Context

Ver `proposal.md` para la motivación y contexto clínico. En el modelo de datos de SINDECON, cada nodo (`NodeRow`) tiene un campo `order: number` que determina su posición ordinal entre hermanos bajo el mismo `parent_id`. `childrenOf(nodes, parentId)` en `tree.ts` ordena por `a.order - b.order`.

Actualmente, cuando se crean o importan notas, los elementos adquieren órdenes secuenciales según su momento de inserción. No existe una función para reordenar alfabéticamente de forma rápida o visualizar temporalmente bajo otros criterios de ordenación.

## Goals / Non-Goals

**Goals:**
- Proporcionar ordenamiento alfabético en español (`es`) de alto rendimiento respetando acentos, mayúsculas y secuencias numéricas (ej. *Ficha 1*, *Ficha 2*, *Ficha 10*).
- Permitir la persistencia atómica en IndexedDB de la nueva secuencia de `order` para que el cambio se refleje en todo el árbol y en dispositivos sincronizados.
- Permitir la alternancia de criterios de ordenación dinámicos en la vista exploradora de carpeta (`FolderExplorerView`) sin forzar la sobreescritura de la base de datos hasta que el usuario lo decida.
- Añadir puntos de acceso ergonómicos en el menú contextual (`···`) de carpetas y en la barra de herramientas de la carpeta.

**Non-Goals:**
- Forzar un ordenamiento alfabético global e inmutable en todo el árbol (los usuarios clínicos necesitan la libertad de ordenar manualmente sus protocolos prioritarios arriba).
- Reordenar automáticamente en tiempo real cada vez que se renombra un artículo (sería disruptivo para el flujo de trabajo del usuario).

## Decisions

### 1. Colación con `Intl.Collator` en Capa de Dominio Pura (`tree.ts`)
- **Decisión**: Implementar `sortNodesBy(nodes: NodeRow[], criteria: SortCriteria): NodeRow[]` utilizando `new Intl.Collator('es', { numeric: true, sensitivity: 'base' })`.
- **Razón**: Asegura ordenamiento clínico natural en español sin dependencias externas:
  - "Ácido acetilsalicílico" se ordena junto a "Aciclovir".
  - "Estadio 2" precede a "Estadio 10" (orden numérico natural).
  - Mantiene las subcarpetas ordenadas A-Z en su sección y los artículos ordenados A-Z en la suya.

### 2. Actualización Transaccional en Dexie (`sortChildrenInFolder` en `nodes.ts`)
- **Decisión**: Ejecutar la actualización de `order` de todos los hermanos dentro de `db.transaction('rw', db.nodes, ...)`.
- **Razón**: Garantiza consistencia ACID, actualiza `updated_at` para la sincronización con Google Drive y PWA sync engine, y dispara un único re-render reactivo en `useLiveQuery`.

### 3. Doble Nivel de Control en UI: Visualización vs Persistencia
- **Decisión**: 
  - En `FolderExplorerView`: selector de orden dinámico (`'manual' | 'alpha-asc' | 'alpha-desc' | 'recent'`) que reordena en memoria para exploración rápida.
  - Botón *"🔤 Ordenar A-Z"* (y opción de menú contextual en `TreeView`) para persistir la secuencia alfabética en `order`.
- **Razón**: Ofrece la máxima flexibilidad: el médico puede inspeccionar la carpeta en orden A-Z temporalmente o fijar el orden alfabético permanentemente en la base de datos.

## Risks / Trade-offs

- **[Riesgo] Carpetas con carpetas y artículos mezclados**
  - *Mitigación*: La ordenación agrupa primero las subcarpetas ordenadas A-Z y luego los artículos ordenados A-Z, preservando la jerarquía visual estándar del explorador.
- **[Riesgo] Pérdida accidental de un orden manual previo al pulsar ordenar A-Z**
  - *Mitigación*: Mostrar toast explicativo claro y no aplicar reordenamiento automático destructivo.
