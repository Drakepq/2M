# 2M Abarrotes — Mercado 2 de Mayo, Chimbote

Aplicación React + Vite + Supabase para registrar clientes, armar listas de compra y guardar cuentas.

## Puerto
El proyecto utiliza **http://localhost:5175/** para no interferir con el proyecto que usa el puerto 5173.

## Instalación en Windows (CMD)
1. Descomprime el ZIP.
2. Abre CMD en la carpeta `2M. abarrotes`.
3. Ejecuta `npm install`.
4. Configura `.env` con la URL y la publishable/anon key de tu proyecto Supabase.
5. Ejecuta `npm run dev`.
6. Abre `http://localhost:5175/`.

## Configurar un Supabase nuevo
1. Entra a https://supabase.com/dashboard y crea un proyecto nuevo con nombre, contraseña de base de datos y región.
2. Espera a que termine de crearse. En Project Settings / API (o Connect) copia la **Project URL** y la **publishable key** (la anon key legacy también sirve).
3. En la carpeta del proyecto, abre `.env` y pega:
   `VITE_SUPABASE_URL=https://TU-PROYECTO.supabase.co`
   `VITE_SUPABASE_ANON_KEY=TU_PUBLISHABLE_KEY`
   No compartas nunca la contraseña de la base de datos ni una `service_role` key.
4. En Supabase abre SQL Editor → New query. Copia el contenido completo de `supabase_setup.sql`, pégalo y pulsa Run. Crea las tablas en español (`clientes`, `productos`, `pedidos`, `detalle_pedido`, `roles`, `usuarios_roles`), los permisos por rol y un catálogo inicial sin precios. Las cuentas nuevas quedan como **cliente**; el rol **admin** se asigna al correo que aparece en la sección "Administrador" del archivo (la cuenta debe existir antes: regístrala en `/registro`).
5. Si ya tenías la base con los nombres antiguos (`customers`, `store_products`, etc.), no uses `supabase_setup.sql`: ejecuta `supabase_migrar_a_espanol.sql`, que renombra todo conservando tus datos.
6. Reinicia Vite si ya estaba ejecutándose: en CMD pulsa `Ctrl+C` y vuelve a ejecutar `npm run dev`.
7. Ingresa por `/acceso`. El administrador va al panel (`/admin`) y los clientes a `/cliente`, donde buscan productos y guardan su propia lista.

## Uso
- En **Clientes**, busca por nombre/teléfono/DNI, selecciona un cliente existente o registra uno nuevo.
- En **Productos**, agrega más productos y configura el precio cuando lo tengas. Los productos iniciales quedan con precio vacío.
- Pulsa **+ Lista** para agregar artículos a la lista del cliente seleccionado, ajusta cantidades y guarda la cuenta.
- En **Cuentas guardadas** puedes abrir cada cuenta y ver su detalle. El botón Imprimir cuenta abre la impresión del navegador.

## Importante
Los permisos del panel dependen del rol **admin** (tabla `usuarios_roles`). Si no ejecutas el SQL, cualquier cuenta registrada tendría acceso a los datos del panel. Las cuentas guardadas contienen el total y el detalle de productos al precio del momento de la compra.
