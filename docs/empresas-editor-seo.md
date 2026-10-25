# Empresas B2B y editor web

## Fuente de verdad

- El HTML de `empresas/index.html` y `empresas/jingles/index.html` contiene la representación pública inicial, los encabezados y el SEO técnico de cada página.
- `title`, `description`, `robots`, canonical, Open Graph y JSON-LD permanecen en el código y no forman parte del editor de copy.
- El editor global de `site.js` puede aplicar overrides de copy visible mediante `site_text_overrides` cuando existe una sesión administrativa. Esos overrides se aplican después de cargar el HTML y no sustituyen los metadatos técnicos.
- Las páginas nuevas no crean una tabla, migración ni sistema de edición paralelo.

## Cotización

El formulario B2B valida los campos en el navegador y prepara un mensaje revisable para el WhatsApp ya usado por Studio. No guarda datos ni declara un envío remoto exitoso. Una integración persistente requeriría una decisión y un endpoint seguro antes de implementarse.

## Publicación

Las rutas se agregan al sitemap generado por `scripts/build-store-seo.mjs`. El workflow Beta transforma el origen de Producción a `beta.hiddenroom.mx` y aplica `noindex, follow`; el workflow de Producción debe usar `https://hiddenroom.mx` y conservar las páginas indexables.

## Prueba editorial pendiente

No se realizó una escritura de prueba contra Supabase. El repositorio exige tratar el acceso remoto como solo lectura salvo autorización específica. La compatibilidad está cubierta de forma estática, pero la persistencia de un override real debe probarse en Beta con una cuenta autorizada, un texto reversible y un procedimiento explícito de restauración.
