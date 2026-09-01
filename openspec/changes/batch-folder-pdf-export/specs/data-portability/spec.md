## ADDED Requirements

### Requirement: Exportación consolidada de carpetas y múltiples artículos a PDF

El sistema SHALL permitir exportar una carpeta completa con todos sus artículos (y opcionalmente subcarpetas descendientes) o una selección personalizada de artículos a un único documento PDF o vista de impresión de alta fidelidad. El documento consolidado MUST incluir portada temática (con nombre de la carpeta, fecha y recuento de artículos), tabla de contenidos (Índice temático con etiquetas) y saltos de página obligatorios (`break-after: page;`) entre cada artículo para evitar el solapamiento de temas. La maquetación SHALL respetar las opciones de 1 columna o 2 columnas (tipo ficha médica), y el nombre sugerido del archivo en el diálogo nativo de descarga MUST corresponder a `<Nombre_Carpeta> - Compendio SINDECON.pdf`.

#### Scenario: Exportar carpeta completa con subtemas a PDF
- **WHEN** el usuario selecciona "Exportar carpeta a PDF" en la carpeta "Cardiología" (que contiene 6 artículos) y confirma la maquetación de 2 columnas
- **THEN** el sistema genera un documento estructurado con portada "Cardiología", índice de los 6 temas, renderizado secuencial de cada artículo con formato completo y saltos de página limpios, sugiriendo el nombre "Cardiología - Compendio SINDECON" en el diálogo de impresión

#### Scenario: Deseleccionar artículos específicos antes de exportar
- **WHEN** el usuario abre el modal de exportación por lote de una carpeta y desmarca 2 de los 5 artículos
- **THEN** el documento PDF resultante y su tabla de contenidos solo incluyen los 3 artículos seleccionados
