## Context

Actualmente en SINDECON:
- En escritorio (`> 768px`), la barra lateral (`.sidebar`) tiene dimensiones rígidas fijas (`width: 320px; min-width: 320px; max-width: 320px`). No existe ningún control ni estado para colapsarla, obligando al usuario a mantener visible el panel lateral incluso cuando desea concentrarse en la lectura de artículos médicos extensos, tablas diagnósticas o árboles de decisión clínica.
- La carpeta del sistema "Plantillas" (`system === 'templates'`) se genera como una carpeta raíz de primer nivel en el árbol. Para muchos usuarios clínicos, esta carpeta es estática y preferirían no verla en su árbol de trabajo diario para no mezclar sus especialidades médicas con las plantillas maestras, dado que ya disponen del selector desplegable "+ desde plantilla" en la barra de herramientas.

## Goals / Non-Goals

**Goals:**
- Permitir colapsar la barra lateral en escritorio para que el visor/editor de artículos aproveche el 100% del ancho de pantalla.
- Ofrecer botón de colapso en la cabecera del sidebar y botón de reapertura cuando esté colapsada.
- Añadir atajo de teclado para alternar la barra lateral (`Ctrl+B` / `Cmd+B`) protegiendo el atajo de negrita cuando el foco esté dentro del editor Milkdown o campos de texto.
- Permitir ocultar/mostrar la carpeta "Plantillas" del árbol mediante un control visual simple y persistente.
- Asegurar que la creación de artículos desde plantillas (`+ desde plantilla`) y la búsqueda continúen funcionando idénticamente aunque la carpeta esté oculta.

**Non-Goals:**
- Alterar el drawer móvil existente (`<= 768px`), el cual ya dispone de su propio ciclo de apertura/cierre flotante y backdrop.
- Eliminar o modificar los nodos ni la siembra de plantillas en la base de datos IndexedDB.

## Decisions

1. **Estado de colapso de escritorio en `App.tsx` y CSS:**
   - *Decisión*: Manejar el estado `desktopSidebarCollapsed` en `App.tsx`, inicializado desde `localStorage.getItem('sindecon_sidebar_collapsed_desktop') === 'true'`.
   - *CSS*: En pantallas desktop, cuando `.layout.desktop-sidebar-collapsed` está activo:
     - `.sidebar`: `width: 0; min-width: 0; max-width: 0; transform: translateX(-100%); opacity: 0; pointer-events: none; border-right: none;` con transición suave `transition: width 0.25s ease, transform 0.25s ease, opacity 0.2s ease`.
     - `.content`: toma automáticamente el espacio remanente (`flex: 1`).
     - Botón de reapertura: Se inyecta en el margen superior izquierdo de la zona de lectura (en `Breadcrumbs` o como botón flotante accesible `btn-sidebar-expand-desktop`) con ícono `⇥` / `☰ Temas`.
   - *Alternativas consideradas*: Ocultar mediante `display: none` sin transición (descartado por generar parpadeos visuales abruptos).

2. **Atajo de teclado con prevención de conflictos:**
   - *Decisión*: Capturar `Ctrl+B` / `Cmd+B` en un listener global de ventana, verificando que el foco activo no pertenezca a un editor de texto (`.milkdown`, `input`, `textarea`, `[contenteditable="true"]`).
   - *Razón*: En los editores de texto enriquecido, `Ctrl+B` aplica formato en negrita (`bold`). Si el foco está en el editor, el evento se deja fluir; si el foco está en la lectura o navegación general, colapsa/expande el sidebar.

3. **Visibilidad de la carpeta "Plantillas":**
   - *Decisión*: Estado reactivo `showTemplatesFolder` en `App.tsx` / `TreeView.tsx` persistido en `localStorage` con clave `sindecon_show_templates_folder` (por defecto `true`).
   - *Mecanismo de filtrado*: En `TreeView`, al renderizar el nivel raíz (`parentId === null`), si `!showTemplatesFolder`, se filtran los nodos con `node.system === 'templates'`.
   - *Control de interfaz*: Se agrega un botón toggle sutil en la toolbar del sidebar (o junto a la cabecera del árbol) con icono dinámico (ej. `📁 Plantillas: Visibles / Ocultas`) para alternar con un solo clic.
   - *Alternativas consideradas*: Eliminar la carpeta de la base de datos (descartado: rompería el modelo relacional de plantillas maestras y sincronización de backups).

## Risks / Trade-offs

- **[Riesgo] Usuario que oculta la carpeta y olvida cómo volver a verla**:
  - *Mitigación*: El botón de alternancia se ubica visiblemente en la barra de herramientas del árbol (`toolbar`), con tooltip explicativo del estado actual ("Ocultar carpeta Plantillas" / "Mostrar carpeta Plantillas").
- **[Riesgo] Desajuste de gráficos Mermaid o tablas al colapsar/expandir el sidebar**:
  - *Mitigación*: Los contenedores de lectura usan anchos adaptativos (`100%` con `max-width` responsivo), adaptándose de inmediato al cambio de viewport.
