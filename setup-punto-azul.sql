-- PUNTO AZUL: ejecutar solo en el proyecto xoddcucjjlohhgdhnjfl.
-- Crea catálogo, permisos y almacenamiento sin importar productos de otras tiendas.
begin;
create table public.categories (
 id uuid primary key default gen_random_uuid(), name text not null check(length(name) between 1 and 200),
 subtitle text not null default '', created_at timestamptz not null default now()
);
create table public.products (
 id uuid primary key default gen_random_uuid(), name text not null,
 "categoryId" uuid not null references public.categories(id) on delete restrict,
 price numeric(10,2) not null check(price >= 0), description text not null default '',
 image text not null default '', color text not null default '', sizes jsonb not null default '["Única"]',
 available boolean not null default true, visible boolean not null default true,
 demo boolean not null default false, badge text not null default '', created_at timestamptz not null default now()
);
alter table public.products enable row level security;
alter table public.categories enable row level security;
revoke all on public.products, public.categories from anon, authenticated;
grant select on public.products, public.categories to anon, authenticated;
grant all on public.products, public.categories to service_role;
create policy "public categories" on public.categories for select to anon, authenticated using (true);
create policy "visible products" on public.products for select to anon, authenticated using (visible = true);
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('products','products',true,2000000,array['image/jpeg','image/png','image/webp'])
on conflict (id) do nothing;
-- Bucket público para lectura. No crear políticas de escritura para anon/authenticated.

-- Las categorías y productos se cargan con scripts/import-punto-azul.mjs.
commit;
