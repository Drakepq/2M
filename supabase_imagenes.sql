-- FOTOS REALES DE PRODUCTOS (ejecutar una vez en Supabase > SQL Editor > Run)
alter table public.productos add column if not exists image_url text;
alter table public.productos add column if not exists marca text;

update public.productos p set marca = v.marca
from (values ('Aceite vegetal','Primor'),('Atún en conserva','Linda Mar'),('Arroz','Costeño'),('Leche evaporada','Gloria'),
 ('Fideos','Don Vittorio'),('Gaseosa','Inca Kola'),('Lejía','Clorox'),('Detergente','Bolívar'),('Poett','Poett'),
 ('Café','Altomayo'),('Sal','Emsal'),('Mayonesa','Alacena')) as v(n, marca)
where p.name = v.n and p.marca is null;

-- Bucket público para las fotos; solo el admin sube/edita.
insert into storage.buckets(id, name, public) values ('productos','productos',true)
on conflict (id) do update set public = true;
drop policy if exists "fotos publicas" on storage.objects;
drop policy if exists "admin sube fotos" on storage.objects;
drop policy if exists "admin edita fotos" on storage.objects;
drop policy if exists "admin borra fotos" on storage.objects;
create policy "fotos publicas" on storage.objects for select using (bucket_id = 'productos');
create policy "admin sube fotos" on storage.objects for insert to authenticated with check (bucket_id = 'productos' and public.es_admin());
create policy "admin edita fotos" on storage.objects for update to authenticated using (bucket_id = 'productos' and public.es_admin());
create policy "admin borra fotos" on storage.objects for delete to authenticated using (bucket_id = 'productos' and public.es_admin());
