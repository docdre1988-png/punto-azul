import { createClient } from '@supabase/supabase-js';
import { authenticated, token, cookie, equal, sessionConfigured, sameOrigin } from './auth.mjs';
let client;
function db() { if (process.env.STORE_ID !== 'punto-azul') throw new Error('Confirma y activa el proyecto Supabase de PUNTO AZUL con STORE_ID=punto-azul.'); if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) throw new Error('Falta conectar Supabase en las variables del servidor.'); return client ??= createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } }); }
const text = (v, max = 200) => typeof v === 'string' && v.trim().length <= max ? v.trim() : '';
function validate(kind, raw) {
  const name = text(raw.name); if (!name) throw new Error('El nombre es obligatorio (máximo 200 caracteres).');
  if (kind === 'categories') return { name, subtitle: text(raw.subtitle) };
  if (!Number.isFinite(raw.price) || raw.price < 0 || raw.price > 999999) throw new Error('Precio inválido.');
  if (!Array.isArray(raw.sizes) || raw.sizes.length > 30 || raw.sizes.some(s => !text(s, 60))) throw new Error('Indica hasta 30 tallas válidas o déjalas vacías para consultas.');
  const image = text(raw.image, 2000); if (image && !image.startsWith('/images/') && !/^https:\/\//.test(image)) throw new Error('Imagen inválida.');
  return { name, price: Math.round(raw.price * 100) / 100, categoryId: text(raw.categoryId), description: text(raw.description, 4000), image, color: text(raw.color), sizes: [...new Set(raw.sizes.map(s => s.trim()))], available: raw.available === true, visible: raw.visible === true, demo: raw.demo === true, badge: text(raw.badge, 40) };
}
async function body(req) { if (req.body) return typeof req.body === 'string' ? JSON.parse(req.body) : req.body; let value = ''; for await (const chunk of req) { value += chunk; if (Buffer.byteLength(value) > 3200000) throw new Error('Archivo demasiado grande.'); } return JSON.parse(value || '{}'); }
export default async function handler(req, res) {
  const send = (status, data) => { res.statusCode = status; res.setHeader('Content-Type', 'application/json'); res.setHeader('Cache-Control', 'no-store'); res.end(JSON.stringify(data)); };
  try {
    const action = new URL(req.url, 'http://local').searchParams.get('action') || 'session';
    const method = req.method;
    if (action === 'public' && method === 'GET') {
      if (process.env.STORE_ID !== 'punto-azul' || !process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) return send(200, { demo: true });
      const [p,c] = await Promise.all([db().from('products').select('*').eq('visible',true).order('created_at'),db().from('categories').select('*').order('created_at')]);
      if(p.error || c.error) throw new Error('No se pudo cargar el catálogo.');
      return send(200,{products:p.data,categories:c.data});
    }
    if (method !== 'GET') { if (!sameOrigin(req)) return send(403, { error: 'Solicitud no permitida desde otra página.' }); if (!req.headers['content-type']?.startsWith('application/json')) return send(415, { error: 'Se requiere JSON.' }); }
    if (action === 'session' && method === 'GET') return send(200, { authenticated: authenticated(req.headers.cookie), configured: Boolean(process.env.ADMIN_USER && process.env.ADMIN_PASSWORD && sessionConfigured()), database: Boolean(process.env.STORE_ID === 'punto-azul' && process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY) });
    if (action === 'login' && method === 'POST') {
      if (!process.env.ADMIN_USER || !process.env.ADMIN_PASSWORD) return send(503, { error: 'Configura usuario y contraseña administrativa en el servidor.' });
      const input = await body(req);
      if (!equal(input.username, process.env.ADMIN_USER) || !equal(input.password, process.env.ADMIN_PASSWORD)) { await new Promise(r => setTimeout(r, 700)); return send(401, { error: 'Credenciales incorrectas.' }); }
      res.setHeader('Set-Cookie', cookie(token())); return send(200, { ok: true });
    }
    if (!authenticated(req.headers.cookie)) return send(401, { error: 'Inicia sesión para continuar.' });
    if (action === 'logout' && method === 'POST') { res.setHeader('Set-Cookie', cookie('', true)); return send(200, { ok: true }); }
    if (action === 'catalog' && method === 'GET') { const [p,c] = await Promise.all([db().from('products').select('*').order('created_at'),db().from('categories').select('*').order('created_at')]); if (p.error || c.error) throw new Error('No se pudo cargar el catálogo. Comprueba setup.sql.'); return send(200, { products: p.data, categories: c.data }); }
    if (['products','categories'].includes(action)) {
      const input = await body(req);
      if (method === 'POST' || method === 'PUT') { const record = validate(action, input); const query = method === 'POST' ? db().from(action).insert(record) : db().from(action).update(record).eq('id', text(input.id)); const { error } = await query; if (error) throw new Error('No se pudo guardar. Comprueba la categoría y los datos.'); return send(200, { ok: true }); }
      if (method === 'DELETE') { const {error} = await db().from(action).delete().eq('id', text(input.id)); if(error) throw new Error('No se pudo eliminar. Retira primero los productos de esta categoría.'); return send(200,{ok:true}); }
    }
    if (action === 'image' && method === 'POST') { const input = await body(req); const bytes = Buffer.from(input.data || '', 'base64'); const mime = input.type; const ext = ({'image/jpeg':'jpg','image/png':'png','image/webp':'webp'})[mime]; if (!ext || !bytes.length || bytes.length > 2000000) throw new Error('Usa JPG, PNG o WebP de hasta 2 MB.'); const path = `${crypto.randomUUID()}.${ext}`; const {error} = await db().storage.from('products').upload(path, bytes, {contentType:mime,upsert:false}); if(error) throw new Error('No se pudo subir la imagen.'); return send(200,{url:db().storage.from('products').getPublicUrl(path).data.publicUrl}); }
    if (action === 'image' && method === 'DELETE') { const input = await body(req); const base = `${process.env.SUPABASE_URL}/storage/v1/object/public/products/`; if (!input.url?.startsWith(base)) throw new Error('Solo se pueden eliminar imágenes de esta tienda.'); const path = input.url.slice(base.length); if (!/^(?:[a-f0-9-]+|punto-azul\/pa-[a-z0-9-]+)\.(jpg|png|webp)$/.test(path)) throw new Error('Ruta de imagen inválida.'); const refs = await db().from('products').select('id').eq('image',input.url); if(refs.error || refs.data.length) throw new Error('Quita y guarda la imagen en todos los productos antes de eliminar el archivo.'); const {error} = await db().storage.from('products').remove([path]); if(error) throw new Error('No se pudo eliminar la imagen.'); return send(200,{ok:true}); }
    return send(405,{error:'Operación no permitida.'});
  } catch(e) { return send(400,{error:e.message || 'No se pudo completar la operación.'}); }
}
