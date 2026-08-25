# Change Proposal: Drag and Drop en el Árbol de Navegación

## Motivation
Actualmente, para mover un artículo o subcarpeta entre diferentes categorías, el usuario debe abrir el menú de opciones contextuales (`···`), seleccionar "Mover", ver un banner y hacer clic en la carpeta destino.
Para mejorar la productividad y brindar una experiencia de usuario moderna (similar a Obsidian, VS Code o Notion), se requiere la capacidad de **arrastrar y soltar (Drag and Drop)** artículos y subcarpetas directamente sobre cualquier carpeta del árbol o hacia la raíz.

## Proposed Solution
1. **Soporte de arrastre nativo (`draggable`)**: Los nodos del árbol (artículos y carpetas) se pueden arrastrar.
2. **Carpetas como dropzones interactivas**: Las carpetas se iluminan al recibir el cursor (`.drag-over`) y aceptan el elemento al soltarlo.
3. **Auto-expansión inteligente**: Al posar un elemento sobre una carpeta colapsada durante 600ms, esta se despliega automáticamente.
4. **Zona de soltado a la Raíz**: Se habilita una zona para soltar elementos en la raíz (`parent_id = null`).
5. **Validación anti-ciclos**: Integrada con la función `canMove` existente para garantizar la coherencia de la base de datos.
6. **Mantenimiento del menú actual**: El flujo de mover por menú contextual sigue disponible para accesibilidad y dispositivos móviles.
