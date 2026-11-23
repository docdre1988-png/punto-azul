# PUNTO AZUL · Moda urbana

React + TypeScript + Vite. Catálogo, búsqueda, filtros, detalle de producto, bolsa y administración con Supabase. WhatsApp: +51 994 840 197.

## Desarrollo

`npm run dev` · `npm run build` · `npm test`

## Conectar el proyecto nuevo

1. Configurar `.env`: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` (admite la nueva clave `sb_secret_`), `STORE_ID=punto-azul`, `ADMIN_USER`, `ADMIN_PASSWORD` y `SESSION_SECRET`. Nunca usar prefijo VITE_ para secretos.
2. Ejecutar `setup-punto-azul.sql` en SQL Editor del proyecto Supabase nuevo. No ejecutar el setup antiguo.
3. Ejecutar `node --env-file=.env scripts/import-punto-azul.mjs`. Carga fotos a Storage y crea categorías y productos sin borrar los existentes. Puede reanudarse sin duplicarlos.
4. Configurar las mismas variables de servidor en Vercel para el despliegue. Comprobar `/api/admin?action=public` y `/admin` en el dominio final.

Las 20 prendas usan las fotos proporcionadas por el negocio. Precios, tallas y disponibilidad comercial pendientes de confirmación. Sin tallas se muestra Consultar precio, nunca S/ 0.00. Las imágenes locales son copias optimizadas; los originales no se modifican. `public/catalog.json` permite mostrar el catálogo si la API no está disponible.

La clave pública no es necesaria: el navegador consulta la API del servidor, que custodia la clave privada. El catálogo remoto se activa solo con `STORE_ID=punto-azul` para evitar usar por accidente las credenciales de la plantilla anterior.
