-- PRECIOS + PROMOCIONES (ejecutar una vez en Supabase > SQL Editor > Run)
-- Precios referenciales en soles para tienda de abarrotes (Chimbote, Mercado 2 de Mayo).
-- Ajústalos cuando quieras desde el panel: "Productos y precios".

update public.productos p set price = v.precio
from (values
('Arroz',4.20),('Azúcar',3.90),('Aceite vegetal',9.50),('Atún en conserva',5.50),('Leche evaporada',4.20),
('Leche fresca',4.50),('Fideos',3.20),('Harina',4.00),('Avena',3.50),('Lentejas',7.00),('Frijol',7.50),
('Arveja partida',6.50),('Sal',1.50),('Café',9.00),('Té',3.00),('Chocolate en polvo',6.00),('Galletas',1.20),
('Pan de molde',8.50),('Mantequilla',4.50),('Margarina',5.00),('Queso',24.00),('Huevos',0.50),('Mayonesa',7.50),
('Kétchup',6.50),('Mostaza',5.50),('Vinagre',3.50),('Sillao',3.50),('Caldo en cubos',4.00),('Sopa instantánea',1.80),
('Conserva de durazno',8.00),('Mermelada',5.50),('Gelatina',1.50),('Jabón de lavar',2.00),('Detergente',8.50),
('Lejía',4.00),('Poett',5.50),('Lavavajilla',4.50),('Esponja',1.00),('Papel higiénico',7.00),('Papel toalla',6.50),
('Jabón de tocador',2.50),('Shampoo',8.50),('Pasta dental',4.50),('Cepillo dental',3.50),('Desodorante',9.00),
('Toallas higiénicas',5.00),('Pañales',22.00),('Bolsas de basura',4.50),('Fósforos',0.80),('Velas',1.00),
('Agua mineral',2.00),('Gaseosa',5.50),('Jugo en caja',2.50),('Caramelos',3.00),('Comida para mascotas',18.00)
) as v(nombre, precio)
where p.name = v.nombre;

-- Promociones (se recrea la tabla: borra cualquier tabla "promociones" anterior)
drop table if exists public.promociones cascade;
create table public.promociones (
  id uuid primary key default gen_random_uuid(),
  titulo text not null,
  descripcion text,
  product_id uuid references public.productos(id) on delete cascade,
  precio_promo numeric(12,2) not null check (precio_promo >= 0),
  activa boolean not null default true,
  fecha_fin date,
  created_at timestamptz not null default now()
);
alter table public.promociones enable row level security;
drop policy if exists "ver promociones" on public.promociones;
drop policy if exists "admin gestiona promociones" on public.promociones;
create policy "ver promociones" on public.promociones for select to anon, authenticated using (activa);
create policy "admin gestiona promociones" on public.promociones
  for all to authenticated using (public.es_admin()) with check (public.es_admin());

-- La tienda pública (sin iniciar sesión) puede VER el catálogo y los precios.
drop policy if exists "publico ve productos" on public.productos;
create policy "publico ve productos" on public.productos for select to anon using (true);

-- Promociones de ejemplo
insert into public.promociones(titulo, descripcion, product_id, precio_promo, fecha_fin)
select t.titulo, t.descr, p.id, t.precio, current_date + 14
from (values
('Arroz','Arroz de la semana','Llévalo más barato todo el mes',3.90),
('Aceite vegetal','Aceite en oferta','Cocina rico y ahorra',8.90),
('Leche evaporada','Leche en oferta','Para toda la familia',3.80),
('Detergente','Limpieza al mejor precio','Ropa limpia, bolsillo feliz',7.50),
('Gaseosa','Refréscate','Ideal para compartir',4.50)
) as t(prod, titulo, descr, precio)
join public.productos p on p.name = t.prod
where not exists (select 1 from public.promociones);
