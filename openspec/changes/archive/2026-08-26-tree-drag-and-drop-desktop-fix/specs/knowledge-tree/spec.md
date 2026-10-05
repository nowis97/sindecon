## MODIFIED Requirements

### Requirement: Drag and Drop de Artículos y Carpetas en el Árbol
El sistema SHALL permitir organizar el árbol de conocimiento arrastrando y soltando artículos y subcarpetas directamente sobre carpetas de destino o hacia la raíz de forma sólida y reactiva en plataformas Desktop y Web.

#### Scenario: Arrastrar artículo a una carpeta
- **GIVEN** el usuario tiene un artículo en la raíz o en una carpeta
- **WHEN** arrastra el artículo sobre una carpeta de destino en Desktop y lo suelta
- **THEN** el artículo se mueve a la carpeta de destino y el árbol se actualiza inmediatamente sin interrupciones por elementos internos

#### Scenario: Auto-despliegue de carpeta al arrastrar
- **GIVEN** una carpeta con subcarpetas está colapsada
- **WHEN** el usuario arrastra un artículo y mantiene el cursor sobre la carpeta por más de 350ms
- **THEN** la carpeta se despliega automáticamente mostrando sus subcarpetas para permitir soltar dentro de ellas

#### Scenario: Validación anti-ciclos al arrastrar carpetas
- **GIVEN** una carpeta que contiene subcarpetas
- **WHEN** el usuario intenta arrastrar la carpeta padre dentro de una de sus subcarpetas o dentro de sí misma
- **THEN** la acción no se permite y la carpeta destino no se resalta como válida
