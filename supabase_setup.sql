-- INSTALACIÓN COMPLETA (proyecto de Supabase nuevo, todo en español)
-- Supabase > SQL Editor > New query > pega TODO > Run.
-- Si ya tienes datos con los nombres antiguos, usa supabase_migrar_a_espanol.sql.
--
-- Crea: clientes, productos, pedidos (las listas), detalle_pedido,
-- roles y usuarios_roles, con permisos por rol:
--   admin   -> panel completo
--   cliente -> se registra solo; ve el catálogo y maneja sus propias listas

create extension if not exists pgcrypto;

create table if not exists public.clientes (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  phone text,
  document_number text,
  notes text,
  user_id uuid references auth.users(id) on delete set null,
  email text,
  created_at timestamptz not null default now()
);

create table if not exists public.productos (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  category text not null default 'Abarrotes',
  unit text not null default 'unidad',
  price numeric(12,2) check (price is null or price >= 0),
  created_at timestamptz not null default now()
);

create table if not exists public.pedidos (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.clientes(id) on delete restrict,
  total numeric(12,2) not null default 0 check (total >= 0),
  status text not null default 'pendiente',
  notes text,
  created_at timestamptz not null default now()
);

create table if not exists public.detalle_pedido (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.pedidos(id) on delete cascade,
  product_id uuid references public.productos(id) on delete set null,
  product_name text not null,
  quantity numeric(12,2) not null check (quantity > 0),
  unit_price numeric(12,2) not null check (unit_price >= 0),
  line_total numeric(12,2) not null check (line_total >= 0),
  created_at timestamptz not null default now()
);

create table if not exists public.roles (
  id uuid primary key default gen_random_uuid(),
  name text not null unique
);

create table if not exists public.usuarios_roles (
  user_id uuid not null references auth.users(id) on delete cascade,
  role_id uuid not null references public.roles(id) on delete cascade,
  primary key (user_id, role_id)
);

-- ============ Roles ============
-- (el rol "customer" pasa a llamarse "cliente"; "admin" se queda igual)
update public.roles set name = 'cliente'
where name = 'customer' and not exists (select 1 from public.roles where name = 'cliente');

insert into public.roles(name) values ('admin'), ('cliente')
on conflict (name) do nothing;

-- ============ Vínculo cliente web <-> cliente del panel ============
alter table public.clientes add column if not exists user_id uuid references auth.users(id) on delete set null;
alter table public.clientes add column if not exists email text;

create unique index if not exists clientes_user_id_key
  on public.clientes(user_id) where user_id is not null;

-- ============ Limpieza de lo anterior (políticas, disparador y funciones) ============
do $$
declare r record;
begin
  for r in
    select schemaname, tablename, policyname
    from pg_policies
    where schemaname = 'public'
      and tablename in ('clientes','productos','pedidos','detalle_pedido','roles','usuarios_roles')
  loop
    execute format('drop policy %I on %I.%I', r.policyname, r.schemaname, r.tablename);
  end loop;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
drop trigger if exists cuenta_nueva on auth.users;
drop function if exists public.handle_new_user();
drop function if exists public.is_admin();
drop function if exists public.my_customer_id();
drop function if exists public.al_crear_usuario();
drop function if exists public.es_admin();
drop function if exists public.mi_cliente_id();

-- ============ Funciones ============
create function public.es_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.usuarios_roles ur
    join public.roles r on r.id = ur.role_id
    where ur.user_id = auth.uid() and lower(r.name) = 'admin'
  );
$$;

create function public.mi_cliente_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select id from public.clientes where user_id = auth.uid() limit 1;
$$;

-- Toda cuenta nueva: rol "cliente" + ficha en la tabla clientes.
create function public.al_crear_usuario()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.usuarios_roles(user_id, role_id)
  select new.id, r.id from public.roles r where r.name = 'cliente'
  on conflict do nothing;

  insert into public.clientes(name, email, user_id)
  values (
    coalesce(nullif(trim(new.raw_user_meta_data->>'name'), ''), split_part(new.email, '@', 1)),
    new.email,
    new.id
  )
  on conflict (user_id) where user_id is not null do nothing;

  return new;
end;
$$;

create trigger cuenta_nueva
  after insert on auth.users
  for each row execute function public.al_crear_usuario();

-- ============ Administrador (manual) ============
-- La cuenta debe existir antes (regístrala en /registro o créala en
-- Authentication > Users). Si ya existía, este insert le da el rol admin.
insert into public.usuarios_roles(user_id, role_id)
select u.id, r.id from auth.users u, public.roles r
where u.email = 'zegarraa14@gmail.com' and r.name = 'admin'
on conflict do nothing;

-- ============ Cuentas que ya existían ============
-- Sin ningún rol: pasan a cliente.
insert into public.usuarios_roles(user_id, role_id)
select u.id, r.id
from auth.users u
cross join public.roles r
where r.name = 'cliente'
  and not exists (select 1 from public.usuarios_roles ur where ur.user_id = u.id)
on conflict do nothing;

-- Se crea su ficha en clientes (los administradores no).
insert into public.clientes(name, email, user_id)
select
  coalesce(nullif(trim(u.raw_user_meta_data->>'name'), ''), split_part(u.email, '@', 1)),
  u.email,
  u.id
from auth.users u
where not exists (select 1 from public.clientes c where c.user_id = u.id)
  and not exists (
    select 1
    from public.usuarios_roles ur
    join public.roles r on r.id = ur.role_id
    where ur.user_id = u.id and lower(r.name) = 'admin'
  );

-- ============ Permisos (RLS) ============
alter table public.clientes enable row level security;
alter table public.productos enable row level security;
alter table public.pedidos enable row level security;
alter table public.detalle_pedido enable row level security;
alter table public.roles enable row level security;
alter table public.usuarios_roles enable row level security;

-- Roles: cada usuario lee solo los suyos; nadie los escribe desde la app.
create policy "todos leen roles" on public.roles
  for select to authenticated using (true);
create policy "usuario ve sus roles" on public.usuarios_roles
  for select to authenticated using (user_id = auth.uid());

-- Panel: solo administradores.
create policy "admin gestiona clientes" on public.clientes
  for all to authenticated using (public.es_admin()) with check (public.es_admin());
create policy "admin gestiona productos" on public.productos
  for all to authenticated using (public.es_admin()) with check (public.es_admin());
create policy "admin gestiona pedidos" on public.pedidos
  for all to authenticated using (public.es_admin()) with check (public.es_admin());
create policy "admin gestiona detalle" on public.detalle_pedido
  for all to authenticated using (public.es_admin()) with check (public.es_admin());

-- Cliente: ve su ficha, lee el catálogo y maneja solo SUS pedidos (editables mientras estén pendientes).
create policy "cliente ve su ficha" on public.clientes
  for select to authenticated using (user_id = auth.uid());

create policy "clientes ven productos" on public.productos
  for select to authenticated using (true);

create policy "cliente ve sus pedidos" on public.pedidos
  for select to authenticated using (customer_id = public.mi_cliente_id());
create policy "cliente crea pedidos pendientes" on public.pedidos
  for insert to authenticated
  with check (customer_id = public.mi_cliente_id() and status = 'pendiente');
create policy "cliente edita pedidos pendientes" on public.pedidos
  for update to authenticated
  using (customer_id = public.mi_cliente_id() and status = 'pendiente')
  with check (customer_id = public.mi_cliente_id() and status = 'pendiente');
create policy "cliente elimina pedidos pendientes" on public.pedidos
  for delete to authenticated
  using (customer_id = public.mi_cliente_id() and status = 'pendiente');

create policy "cliente ve su detalle" on public.detalle_pedido
  for select to authenticated
  using (exists (
    select 1 from public.pedidos p
    where p.id = order_id and p.customer_id = public.mi_cliente_id()
  ));
create policy "cliente agrega detalle a pendientes" on public.detalle_pedido
  for insert to authenticated
  with check (exists (
    select 1 from public.pedidos p
    where p.id = order_id and p.customer_id = public.mi_cliente_id() and p.status = 'pendiente'
  ));
create policy "cliente quita detalle de pendientes" on public.detalle_pedido
  for delete to authenticated
  using (exists (
    select 1 from public.pedidos p
    where p.id = order_id and p.customer_id = public.mi_cliente_id() and p.status = 'pendiente'
  ));

-- Listas que guardó el administrador de clientes sin cuenta web: quedan como "atendido".
update public.pedidos
set status = 'atendido'
where status = 'pendiente'
  and customer_id in (select id from public.clientes where user_id is null);

-- ============ Catálogo inicial (sin precios) ============
insert into public.productos(name, category, unit, price) values
('Arroz','Abarrotes','kg',null),('Azúcar','Abarrotes','kg',null),('Aceite vegetal','Abarrotes','botella',null),
('Atún en conserva','Conservas','lata',null),('Leche evaporada','Lácteos','lata',null),('Leche fresca','Lácteos','litro',null),
('Fideos','Abarrotes','paquete',null),('Harina','Abarrotes','kg',null),('Avena','Abarrotes','bolsa',null),
('Lentejas','Abarrotes','kg',null),('Frijol','Abarrotes','kg',null),('Arveja partida','Abarrotes','kg',null),
('Sal','Abarrotes','bolsa',null),('Café','Abarrotes','frasco',null),('Té','Abarrotes','caja',null),
('Chocolate en polvo','Abarrotes','bolsa',null),('Galletas','Abarrotes','paquete',null),('Pan de molde','Abarrotes','bolsa',null),
('Mantequilla','Lácteos','unidad',null),('Margarina','Abarrotes','unidad',null),('Queso','Lácteos','kg',null),
('Huevos','Abarrotes','unidad',null),('Mayonesa','Abarrotes','frasco',null),('Kétchup','Abarrotes','frasco',null),
('Mostaza','Abarrotes','frasco',null),('Vinagre','Abarrotes','botella',null),('Sillao','Abarrotes','botella',null),
('Caldo en cubos','Abarrotes','caja',null),('Sopa instantánea','Abarrotes','unidad',null),('Conserva de durazno','Conservas','lata',null),
('Mermelada','Abarrotes','frasco',null),('Gelatina','Abarrotes','sobre',null),('Jabón de lavar','Limpieza','unidad',null),
('Detergente','Limpieza','bolsa',null),('Lejía','Limpieza','botella',null),('Poett','Limpieza','botella',null),
('Lavavajilla','Limpieza','unidad',null),('Esponja','Limpieza','unidad',null),('Papel higiénico','Higiene','paquete',null),
('Papel toalla','Higiene','paquete',null),('Jabón de tocador','Higiene','unidad',null),('Shampoo','Higiene','botella',null),
('Pasta dental','Higiene','unidad',null),('Cepillo dental','Higiene','unidad',null),('Desodorante','Higiene','unidad',null),
('Toallas higiénicas','Higiene','paquete',null),('Pañales','Higiene','paquete',null),('Bolsas de basura','Limpieza','paquete',null),
('Fósforos','Hogar','caja',null),('Velas','Hogar','unidad',null),('Agua mineral','Bebidas','botella',null),
('Gaseosa','Bebidas','botella',null),('Jugo en caja','Bebidas','caja',null),('Caramelos','Dulces','bolsa',null),
('Comida para mascotas','Otros','bolsa',null)
on conflict (name) do nothing;
