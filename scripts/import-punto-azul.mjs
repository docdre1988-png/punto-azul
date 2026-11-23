import {readFileSync,writeFileSync} from 'node:fs';
import {createClient} from '@supabase/supabase-js';
if(new URL(process.env.SUPABASE_URL).hostname!=='xoddcucjjlohhgdhnjfl.supabase.co')throw Error('Proyecto incorrecto');
const db=createClient(process.env.SUPABASE_URL,process.env.SUPABASE_SERVICE_ROLE_KEY,{auth:{persistSession:false}});
const catalog=JSON.parse(readFileSync('public/catalog.json','utf8'));
const buckets=await db.storage.listBuckets();if(buckets.error)throw buckets.error;
if(!buckets.data.some(b=>b.id==='products')){const r=await db.storage.createBucket('products',{public:true,fileSizeLimit:2000000,allowedMimeTypes:['image/jpeg','image/png','image/webp']});if(r.error)throw r.error;}
for(const product of catalog.products){
 const file=`${product.id}.jpg`;
 const path=`punto-azul/${file}`;
 const upload=await db.storage.from('products').upload(path,readFileSync(`public/images/punto-azul/${file}`),{contentType:'image/jpeg',upsert:true});
 if(upload.error)throw upload.error;
 product.image=db.storage.from('products').getPublicUrl(path).data.publicUrl;
}
writeFileSync('public/catalog.json',JSON.stringify(catalog,null,2)+'\n');
console.log('20 fotografías alojadas en Supabase Storage.');
if(process.argv.includes('--images-only'))process.exit(0);
const categoryIds=new Map();
for(const c of catalog.categories){
 const found=await db.from('categories').select('id').eq('name',c.name);if(found.error)throw found.error;
 let id=found.data[0]?.id;
 if(!id){const r=await db.from('categories').insert({name:c.name,subtitle:c.subtitle}).select('id').single();if(r.error)throw r.error;id=r.data.id;}
 categoryIds.set(c.id,id);
}
for(const p of catalog.products){
 const found=await db.from('products').select('id').eq('image',p.image);if(found.error)throw found.error;
 if(found.data.length)continue;
 const {id,...record}=p;
 const r=await db.from('products').insert({...record,categoryId:categoryIds.get(p.categoryId)});if(r.error)throw r.error;
}
const verify=await db.from('products').select('id,image');if(verify.error)throw verify.error;
console.log(`Catálogo comprobado: ${verify.data.length} productos. Importación sin borrar registros existentes.`);
