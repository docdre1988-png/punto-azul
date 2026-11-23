# Subir a Vercel

1. En Vercel selecciona **Add New → Project** e importa `docdre1988-png/punto-azul` (rama `main`).
2. Usa estos ajustes (el repositorio ya los declara):
   - Framework: **Vite**.
   - Root Directory: **./**.
   - Build Command: **npm run build**.
   - Output Directory: **dist**.
   - Node.js: **22.x**.
3. En **Environment Variables**, añade estas cuatro variables para **Production**. Copia los valores desde tu `.env` local:

| Variable | Valor |
| --- | --- |
| `SUPABASE_URL` | URL del proyecto Supabase |
| `SUPABASE_SERVICE_ROLE_KEY` | Clave secreta de Supabase |
| `ADMIN_USER` | Usuario administrativo |
| `ADMIN_PASSWORD` | Contraseña administrativa |

4. Pulsa **Deploy**.
5. Abre la tienda y `/admin`. Inicia sesión, crea una categoría y un producto, sube una foto y comprueba el producto en la tienda. Prepara un pedido y revisa el mensaje de WhatsApp antes de enviarlo.

El catálogo muestra los productos visibles de tu Supabase. Si la base está vacía, aparecerá el estado de catálogo vacío.

## Notas prácticas

- No añadas `VITE_` a las variables anteriores. Se utilizan exclusivamente en el servidor.
- `.env` queda fuera de Git y de las subidas con la CLI. Las variables deben configurarse en Vercel.
- `/api/admin` ejecuta la función del servidor; `/admin` abre el panel React.
- Los cambios que subas a `main` podrán desplegarse automáticamente mediante la integración GitHub de Vercel.
- Este proyecto está preparado para desplegar. La verificación en el dominio público se realiza después del primer despliegue.

La protección de sesión y la comprobación del dominio se configuran automáticamente. No necesitas SESSION_SECRET ni APP_ORIGIN.
