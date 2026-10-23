import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type FormEvent
} from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase, isSupabaseConfigured } from '../lib/supabase'
import './Admin.css'

type Customer = {
  id: string
  name: string
  phone: string | null
  document_number: string | null
  notes: string | null
  created_at: string
  user_id: string | null
  email: string | null
}

type Product = {
  id: string
  name: string
  category: string
  unit: string
  price: number | null
}

type Order = {
  id: string
  created_at: string
  total: number
  status: string
  notes: string | null
  customer_id: string
}

type OrderItem = {
  id: string
  product_id: string | null
  product_name: string
  quantity: number
  unit_price: number
  line_total: number
}

type CartItem = {
  product: Product
  quantity: number
  price: number
}

type Section =
  | 'dashboard'
  | 'clientes'
  | 'productos'
  | 'pendientes'
  | 'precios'
  | 'cuentas'

const money = (n: number) =>
  `S/ ${Number(n || 0).toFixed(2)}`

const dateTime = (value: string) =>
  new Date(value).toLocaleString('es-PE', {
    dateStyle: 'short',
    timeStyle: 'short'
  })

/*
  Normaliza los textos para que:
  "azu" encuentre "Azúcar"
  "lacteos" encuentre "Lácteos"
  "poett" encuentre "Poett"
*/
function normalizeText(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
}

const categories = [
  'Abarrotes',
  'Bebidas',
  'Conservas',
  'Lácteos',
  'Limpieza',
  'Higiene',
  'Hogar',
  'Dulces',
  'Otros'
]

export default function Admin() {
  const navigate = useNavigate()

  const [email, setEmail] = useState('')
  const [checking, setChecking] = useState(true)
  const [section, setSection] = useState<Section>('dashboard')

  const [customers, setCustomers] = useState<Customer[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [orders, setOrders] = useState<Order[]>([])

  const [query, setQuery] = useState('')
  const [selected, setSelected] = useState<Customer | null>(null)

  const [customerName, setCustomerName] = useState('')
  const [phone, setPhone] = useState('')
  const [documentNumber, setDocumentNumber] = useState('')
  const [notes, setNotes] = useState('')

  const [cart, setCart] = useState<CartItem[]>([])
  const [productQuery, setProductQuery] = useState('')
  const [catalogQuery, setCatalogQuery] = useState('')

  const [newProduct, setNewProduct] = useState('')
  const [newPrice, setNewPrice] = useState('')
  const [newCategory, setNewCategory] = useState('Abarrotes')

  const [orderNotes, setOrderNotes] = useState('')

  /*
    Si contiene un ID, estamos editando una lista guardada.
    Si es null, estamos creando una lista nueva.
  */
  const [editingOrderId, setEditingOrderId] = useState<string | null>(null)

  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  // Pendientes: pedidos de clientes por atender. Guardadas: ya atendidas / registradas por el admin.
  const pendingOrders = orders.filter(order => order.status === 'pendiente')
  const savedOrders = orders.filter(order => order.status !== 'pendiente')

  const total = useMemo(
    () =>
      cart.reduce(
        (sum, item) => sum + item.quantity * item.price,
        0
      ),
    [cart]
  )

  const load = useCallback(async () => {
    setError('')

    const [c, p, o] = await Promise.all([
      supabase
        .from('clientes')
        .select('*')
        .order('name'),

      supabase
        .from('productos')
        .select('*')
        .order('name'),

      supabase
        .from('pedidos')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(100)
    ])

    const loadError = c.error || p.error || o.error

    if (loadError) {
      setError(loadError.message)
      return
    }

    setCustomers((c.data || []) as Customer[])
    setProducts((p.data || []) as Product[])
    setOrders((o.data || []) as Order[])
  }, [])

  useEffect(() => {
    let active = true

    async function checkSession() {
      const { data, error } =
        await supabase.auth.getSession()

      if (!active) return

      if (error || !data.session) {
        navigate('/acceso')
        setChecking(false)
        return
      }

      setEmail(data.session.user.email || '')
      setChecking(false)

      void load()
    }

    void checkSession()

    return () => {
      active = false
    }
  }, [navigate, load])

  /*
    Búsqueda de clientes sin importar mayúsculas ni tildes.
  */
  const normalizedCustomerQuery = normalizeText(query)

  const filteredCustomers = customers.filter(customer => {
    const text = normalizeText(
      `${customer.name} ${
        customer.phone || ''
      } ${
        customer.document_number || ''
      } ${
        customer.email || ''
      }`
    )

    return text.includes(normalizedCustomerQuery)
  })

  /*
    Búsqueda de productos sin importar tildes.
    Ejemplo:
    "azu" -> "Azúcar"
  */
  const normalizedProductQuery = normalizeText(productQuery)

  const filteredProducts = products.filter(product => {
    const text = normalizeText(
      `${product.name} ${product.category}`
    )

    return text.includes(normalizedProductQuery)
  })

  /*
    Catálogo de productos.
  */
  const normalizedCatalogQuery = normalizeText(catalogQuery)

  const catalogProducts = products.filter(product => {
    const text = normalizeText(
      `${product.name} ${product.category} ${product.unit}`
    )

    return text.includes(normalizedCatalogQuery)
  })

  function goTo(next: Section) {
    setSection(next)
    setMessage('')
    setError('')

    // Clientes nuevos y pedidos nuevos llegan desde las cuentas web.
    if (next === 'clientes' || next === 'pendientes') {
      void load()
    }
  }

  /*
    Marca una lista pendiente como atendida:
    sale de "Listas pendientes" y pasa a "Listas guardadas".
  */
  async function markAttended(order: Order) {
    setError('')
    setMessage('')

    if (Number(order.total) <= 0) {
      setError(
        'Antes de marcarla como atendida, usa Editar para asignar los precios de la lista.'
      )
      return
    }

    const { data, error: updateError } = await supabase
      .from('pedidos')
      .update({ status: 'atendido' })
      .eq('id', order.id)
      .select()
      .single()

    if (updateError || !data) {
      setError(
        updateError?.message ||
          'No se pudo marcar la lista como atendida.'
      )
      return
    }

    setOrders(old =>
      old.map(item =>
        item.id === order.id ? (data as Order) : item
      )
    )

    setMessage('Lista atendida. Ahora aparece en Listas guardadas.')
  }

  async function saveCustomer(e: FormEvent) {
    e.preventDefault()

    setError('')
    setMessage('')

    if (!customerName.trim()) return

    setBusy(true)

    const { data, error } = await supabase
      .from('clientes')
      .insert({
        name: customerName.trim(),
        phone: phone.trim() || null,
        document_number:
          documentNumber.trim() || null,
        notes: notes.trim() || null
      })
      .select()
      .single()

    setBusy(false)

    if (error) {
      setError(error.message)
      return
    }

    const customer = data as Customer

    setCustomers(prev =>
      [...prev, customer].sort((a, b) =>
        a.name.localeCompare(b.name)
      )
    )

    setSelected(customer)

    setCustomerName('')
    setPhone('')
    setDocumentNumber('')
    setNotes('')
    setQuery('')

    setMessage(
      `Cliente ${customer.name} registrado. Ya puedes crear su lista de compra.`
    )
  }

  function selectCustomer(customer: Customer) {
    setSelected(customer)
    setCart([])
    setProductQuery('')
    setOrderNotes('')
    setEditingOrderId(null)

    setMessage(
      `Cliente seleccionado: ${customer.name}`
    )

    setError('')
  }

  function addToCart(product: Product) {
    if (!selected) {
      setError('Primero selecciona un cliente.')
      return
    }

    setCart(old => {
      const found = old.find(
        item => item.product.id === product.id
      )

      if (found) {
        return old.map(item =>
          item.product.id === product.id
            ? {
                ...item,
                quantity: item.quantity + 1
              }
            : item
        )
      }

      return [
        ...old,
        {
          product,
          quantity: 1,
          price: Number(product.price ?? 0)
        }
      ]
    })

    setProductQuery('')
    setMessage(
      `${product.name} agregado a la lista.`
    )
    setError('')
  }

  function changeQty(
    id: string,
    quantity: number
  ) {
    setCart(old =>
      quantity <= 0
        ? old.filter(
            item => item.product.id !== id
          )
        : old.map(item =>
            item.product.id === id
              ? {
                  ...item,
                  quantity
                }
              : item
          )
    )
  }

  function editQuantity(
    id: string,
    value: string
  ) {
    setCart(old =>
      old.map(item => {
        if (item.product.id !== id) {
          return item
        }

        if (value === '') {
          return {
            ...item,
            quantity: 0
          }
        }

        const quantity = Number(value)

        if (
          Number.isInteger(quantity) &&
          quantity >= 1
        ) {
          return {
            ...item,
            quantity
          }
        }

        return item
      })
    )
  }

  function editCartPrice(
    id: string,
    value: string
  ) {
    setCart(old =>
      old.map(item =>
        item.product.id === id
          ? {
              ...item,
              price:
                value === ''
                  ? 0
                  : Math.max(
                      0,
                      Number(value) || 0
                    )
            }
          : item
      )
    )
  }

  /*
    Guarda una lista nueva o actualiza una lista existente.
  */
  async function saveOrder() {
    setError('')
    setMessage('')

    if (!selected) {
      setError(
        'Selecciona un cliente antes de guardar la lista.'
      )
      return
    }

    if (!cart.length) {
      setError(
        'Agrega al menos un producto a la lista.'
      )
      return
    }

    if (cart.some(item => item.quantity < 1)) {
      setError(
        'Completa las cantidades antes de guardar la lista.'
      )
      return
    }

    if (
      cart.some(
        item =>
          !Number.isFinite(item.price) ||
          item.price <= 0
      )
    ) {
      setError(
        'Hay productos sin precio válido. Asigna un precio habitual o un precio negociado mayor que cero.'
      )
      return
    }

    setBusy(true)

    /*
      =====================================================
      EDITAR LISTA EXISTENTE
      =====================================================
    */
    if (editingOrderId) {
      const { data: updatedOrder, error: updateError } =
        await supabase
          .from('pedidos')
          .update({
            total,
            notes: orderNotes.trim() || null
          })
          .eq('id', editingOrderId)
          .select()
          .single()

      if (updateError || !updatedOrder) {
        setBusy(false)
        setError(
          updateError?.message ||
            'No se pudo actualizar la lista.'
        )
        return
      }

      /*
        Quitamos los productos anteriores
        y guardamos los productos actuales.
      */
      const { error: deleteItemsError } =
        await supabase
          .from('detalle_pedido')
          .delete()
          .eq('order_id', editingOrderId)

      if (deleteItemsError) {
        setBusy(false)
        setError(deleteItemsError.message)
        return
      }

      const { error: itemsError } =
        await supabase
          .from('detalle_pedido')
          .insert(
            cart.map(item => ({
              order_id: editingOrderId,
              product_id: item.product.id,
              product_name: item.product.name,
              quantity: item.quantity,
              unit_price: item.price,
              line_total:
                item.quantity * item.price
            }))
          )

      if (itemsError) {
        setBusy(false)
        setError(itemsError.message)
        return
      }

      setOrders(old =>
        old.map(order =>
          order.id === editingOrderId
            ? (updatedOrder as Order)
            : order
        )
      )

      setCart([])
      setProductQuery('')
      setOrderNotes('')
      setEditingOrderId(null)

      setBusy(false)

      setMessage(
        `Lista de ${selected.name} actualizada correctamente.`
      )

      setSection(
        updatedOrder.status === 'pendiente'
          ? 'pendientes'
          : 'cuentas'
      )

      return
    }

    /*
      =====================================================
      CREAR LISTA NUEVA
      =====================================================
    */

    const { data: order, error: orderError } =
      await supabase
        .from('pedidos')
        .insert({
          customer_id: selected.id,
          total,
          status: 'atendido',
          notes: orderNotes.trim() || null
        })
        .select()
        .single()

    if (orderError || !order) {
      setBusy(false)

      setError(
        orderError?.message ||
          'No se pudo guardar la lista.'
      )

      return
    }

    const { error: itemsError } =
      await supabase
        .from('detalle_pedido')
        .insert(
          cart.map(item => ({
            order_id: order.id,
            product_id: item.product.id,
            product_name: item.product.name,
            quantity: item.quantity,
            unit_price: item.price,
            line_total:
              item.quantity * item.price
          }))
        )

    if (itemsError) {
      await supabase
        .from('pedidos')
        .delete()
        .eq('id', order.id)

      setBusy(false)
      setError(itemsError.message)

      return
    }

    setOrders(old => [
      order as Order,
      ...old
    ])

    setCart([])
    setProductQuery('')
    setOrderNotes('')
    setEditingOrderId(null)

    setBusy(false)

    setMessage(
      `Lista guardada para ${selected.name}: ${money(total)}.`
    )

    setSection('cuentas')
  }

  async function addProduct(e: FormEvent) {
    e.preventDefault()

    setError('')
    setMessage('')

    if (!newProduct.trim()) return

    if (
      newPrice !== '' &&
      (
        !Number.isFinite(Number(newPrice)) ||
        Number(newPrice) < 0
      )
    ) {
      setError('Introduce un precio válido.')
      return
    }

    setBusy(true)

    const { data, error } =
      await supabase
        .from('productos')
        .insert({
          name: newProduct.trim(),
          category: newCategory,
          unit: 'unidad',
          price:
            newPrice === ''
              ? null
              : Number(newPrice)
        })
        .select()
        .single()

    setBusy(false)

    if (error) {
      setError(error.message)
      return
    }

    setProducts(old =>
      [...old, data as Product].sort(
        (a, b) =>
          a.name.localeCompare(b.name)
      )
    )

    setNewProduct('')
    setNewPrice('')

    setMessage(
      'Producto agregado al catálogo de Supabase.'
    )
  }

  async function setPrice(
    product: Product,
    value: string
  ) {
    setError('')
    setMessage('')

    const price =
      value.trim() === ''
        ? null
        : Number(value)

    if (
      price !== null &&
      (
        !Number.isFinite(price) ||
        price < 0
      )
    ) {
      setError('Introduce un precio válido.')
      return
    }

    const { error } =
      await supabase
        .from('productos')
        .update({ price })
        .eq('id', product.id)

    if (error) {
      setError(error.message)
      return
    }

    setProducts(old =>
      old.map(item =>
        item.id === product.id
          ? {
              ...item,
              price
            }
          : item
      )
    )

    setMessage(
      `Precio habitual actualizado: ${product.name}.`
    )
  }

  /*
    Elimina un producto del catálogo.
  */
  async function deleteProduct(
    product: Product
  ) {
    const confirmed =
      window.confirm(
        `¿Eliminar "${product.name}" del catálogo?`
      )

    if (!confirmed) return

    setError('')
    setMessage('')
    setBusy(true)

    const { error } =
      await supabase
        .from('productos')
        .delete()
        .eq('id', product.id)

    setBusy(false)

    if (error) {
      setError(
        `No se pudo eliminar "${product.name}". Es posible que este producto esté siendo utilizado por una lista guardada.`
      )
      return
    }

    /*
      También lo quitamos de la lista actual
      si estaba seleccionado.
    */
    setCart(old =>
      old.filter(
        item =>
          item.product.id !== product.id
      )
    )

    setProducts(old =>
      old.filter(
        item =>
          item.id !== product.id
      )
    )

    setMessage(
      `Producto "${product.name}" eliminado del catálogo.`
    )
  }

  /*
    Carga una lista guardada para editarla.
  */
  async function editSavedOrder(
    order: Order
  ) {
    setError('')
    setMessage('')
    setBusy(true)

    const customer =
      customers.find(
        item =>
          item.id === order.customer_id
      )

    if (!customer) {
      setBusy(false)
      setError(
        'No se encontró el cliente de esta lista.'
      )
      return
    }

    const { data, error } =
      await supabase
        .from('detalle_pedido')
        .select(
          'id, product_id, product_name, quantity, unit_price, line_total'
        )
        .eq('order_id', order.id)

    setBusy(false)

    if (error) {
      setError(error.message)
      return
    }

    const orderItems =
      (data || []) as OrderItem[]

    const newCart: CartItem[] = []

    for (const item of orderItems) {
      const product =
        products.find(
          product =>
            product.id === item.product_id
        )

      /*
        Si el producto ya no existe en el catálogo,
        no podemos editarlo correctamente porque
        Supabase necesita el product_id.
      */
      if (!product) {
        setError(
          `No se puede editar esta lista porque "${item.product_name}" ya no existe en el catálogo.`
        )
        return
      }

      newCart.push({
        product,
        quantity: Number(item.quantity),
        price: Number(item.unit_price)
      })
    }

    setSelected(customer)
    setCart(newCart)
    setProductQuery('')
    setOrderNotes(order.notes || '')
    setEditingOrderId(order.id)

    setMessage(
      `Editando la lista de ${customer.name}.`
    )

    setSection('productos')
  }

  async function logout() {
    await supabase.auth.signOut()
    navigate('/')
  }

  if (checking) {
    return (
      <div className="admin-gate">
        Comprobando sesión…
      </div>
    )
  }

  if (!isSupabaseConfigured) {
    return (
      <div className="admin-gate">
        Configura las credenciales de Supabase en el archivo .env.
        <Link to="/acceso"> Volver</Link>
      </div>
    )
  }

  const sectionTitles: Record<
    Section,
    string
  > = {
    dashboard: 'Dashboard',
    clientes: 'Clientes',
    productos: 'Lista de compra',
    pendientes: 'Listas pendientes',
    precios: 'Productos y precios',
    cuentas: 'Listas guardadas'
  }

  return (
    <div className="admin-layout">
      <aside className="admin-sidebar">
        <Link
          className="admin-logo"
          to="/"
        >
          2M<span>.</span>
        </Link>

        <p className="admin-eyebrow">
          TIENDA · CONTROL
        </p>

        <nav className="admin-nav">
          {([
            ['dashboard', 'Dashboard'],
            ['clientes', 'Clientes'],
            ['productos', 'Lista de compra'],
            ['pendientes', pendingOrders.length ? `Listas pendientes (${pendingOrders.length})` : 'Listas pendientes'],
            ['precios', 'Productos y precios'],
            ['cuentas', 'Listas guardadas']
          ] as [Section, string][]).map(
            ([id, label]) => (
              <button
                key={id}
                className={
                  section === id
                    ? 'active'
                    : ''
                }
                onClick={() =>
                  goTo(id)
                }
              >
                {label}
              </button>
            )
          )}
        </nav>

        <div className="admin-sidebar-bottom">
          <small>{email}</small>

          <Link to="/">
            Ver inicio ↗
          </Link>

          <button
            className="admin-logout"
            onClick={() =>
              void logout()
            }
          >
            Cerrar sesión
          </button>
        </div>
      </aside>

      <main className="admin-main">
        <header className="admin-topbar">
          <div>
            <p className="admin-eyebrow">
              MERCADO 2 DE MAYO / CHIMBOTE
            </p>

            <h1>
              {sectionTitles[section]}
            </h1>
          </div>

          <button
            className="admin-button secondary"
            onClick={() =>
              void load()
            }
          >
            Actualizar datos
          </button>
        </header>

        {error && (
          <div className="admin-alert error">
            {error}
          </div>
        )}

        {message && (
          <div className="admin-alert success">
            {message}
          </div>
        )}

        {/* =================================================
            DASHBOARD
        ================================================= */}

        {section === 'dashboard' && (
          <>
            <div className="admin-stats">
              {[
                [
                  'Clientes registrados',
                  customers.length
                ],
                [
                  'Productos',
                  products.length
                ],
                [
                  'Listas guardadas',
                  savedOrders.length
                ],
                [
                  'Total de listas',
                  money(
                    orders.reduce(
                      (sum, order) =>
                        sum +
                        Number(
                          order.total || 0
                        ),
                      0
                    )
                  )
                ]
              ].map(
                ([label, value]) => (
                  <div
                    className="admin-stat"
                    key={String(label)}
                  >
                    <span>
                      {label}
                    </span>

                    <strong>
                      {value}
                    </strong>
                  </div>
                )
              )}
            </div>

            <section className="admin-panel">
              <h2>
                Bienvenido a tu tienda
              </h2>

              <p>
                Registra clientes, prepara sus
                listas de compra y guarda cada
                lista para consultarla después.
              </p>

              <div className="quick-actions">
                <button
                  className="admin-button"
                  onClick={() =>
                    goTo('clientes')
                  }
                >
                  Buscar / registrar cliente
                </button>

                <button
                  className="admin-button secondary"
                  onClick={() =>
                    goTo('precios')
                  }
                >
                  Gestionar productos y precios
                </button>
              </div>
            </section>

            <section className="admin-panel">
              <h2>
                Últimas listas
              </h2>

              <Orders
                orders={orders.slice(
                  0,
                  5
                )}
                customers={customers}
                onEdit={editSavedOrder}
              />
            </section>
          </>
        )}

        {/* =================================================
            CLIENTES
        ================================================= */}

        {section === 'clientes' && (
          <>
            <section className="admin-panel">
              <h2>
                Buscar cliente
              </h2>

              <input
                className="search-input"
                value={query}
                onChange={e =>
                  setQuery(
                    e.target.value
                  )
                }
                placeholder="Nombre, teléfono o DNI..."
              />

              <div className="customer-list">
                {filteredCustomers.map(
                  customer => (
                    <button
                      key={customer.id}
                      className={`customer-row ${
                        selected?.id ===
                        customer.id
                          ? 'chosen'
                          : ''
                      }`}
                      onClick={() =>
                        selectCustomer(
                          customer
                        )
                      }
                    >
                      <span>
                        <strong>
                          {customer.name}
                        </strong>

                        <small>
                          {customer.phone ||
                            customer.email ||
                            'Sin teléfono'}

                          {customer.document_number
                            ? ` · DNI ${customer.document_number}`
                            : ''}
                        </small>
                      </span>

                      <span>
                        {selected?.id ===
                        customer.id
                          ? 'Seleccionado'
                          : 'Elegir →'}
                      </span>
                    </button>
                  )
                )}

                {!filteredCustomers.length && (
                  <p className="muted">
                    No se encontraron clientes.
                  </p>
                )}
              </div>
            </section>

            <section className="admin-panel">
              <h2>
                Registrar nuevo cliente
              </h2>

              <form
                className="admin-form"
                onSubmit={saveCustomer}
              >
                <label>
                  Nombre completo

                  <input
                    value={customerName}
                    onChange={e =>
                      setCustomerName(
                        e.target.value
                      )
                    }
                    required
                    placeholder="Nombre y apellidos"
                  />
                </label>

                <label>
                  Teléfono

                  <input
                    value={phone}
                    onChange={e =>
                      setPhone(
                        e.target.value
                      )
                    }
                    placeholder="Número de contacto"
                  />
                </label>

                <label>
                  DNI (opcional)

                  <input
                    value={documentNumber}
                    onChange={e =>
                      setDocumentNumber(
                        e.target.value
                      )
                    }
                    placeholder="DNI"
                  />
                </label>

                <label>
                  Notas

                  <textarea
                    value={notes}
                    onChange={e =>
                      setNotes(
                        e.target.value
                      )
                    }
                    placeholder="Referencia u observaciones"
                  />
                </label>

                <div className="admin-form-actions">
                  <button
                    className="admin-button"
                    disabled={busy}
                  >
                    {busy
                      ? 'Guardando...'
                      : 'Guardar cliente'}
                  </button>
                </div>
              </form>
            </section>

            {selected && (
              <section className="admin-panel">
                <div className="panel-heading">
                  <div>
                    <p className="admin-eyebrow">
                      CLIENTE SELECCIONADO
                    </p>

                    <h2>
                      {selected.name}
                    </h2>

                    <p className="muted">
                      {selected.phone ||
                        selected.email ||
                        'Sin teléfono'}

                      {selected.document_number
                        ? ` · DNI ${selected.document_number}`
                        : ''}
                    </p>
                  </div>

                  <button
                    className="admin-button secondary"
                    onClick={() => {
                      setCart([])
                      setOrderNotes('')
                      setEditingOrderId(null)
                      goTo('productos')
                    }}
                  >
                    Crear lista →
                  </button>
                </div>

                <h3>
                  Historial de listas
                </h3>

                <Orders
                  orders={orders.filter(
                    order =>
                      order.customer_id ===
                      selected.id
                  )}
                  customers={customers}
                  onEdit={editSavedOrder}
                />
              </section>
            )}
          </>
        )}

        {/* =================================================
            LISTA DE COMPRA
        ================================================= */}

        {section === 'productos' && (
          <section className="admin-panel">
            <div className="panel-heading">
              <div>
                <p className="admin-eyebrow">
                  {editingOrderId
                    ? 'EDITANDO LISTA'
                    : 'LISTA DE COMPRA'}
                </p>

                <h2>
                  {selected?.name ||
                    'Selecciona un cliente'}
                </h2>

                <p className="muted">
                  {editingOrderId
                    ? 'Modifica los productos, cantidades o precios y guarda los cambios.'
                    : 'Busca productos y cambia sus precios según el acuerdo con el cliente.'}
                </p>
              </div>

              <strong className="cart-total">
                {money(total)}
              </strong>
            </div>

            {!selected && (
              <div className="notice">
                Primero ve a Clientes y selecciona al cliente.
              </div>
            )}

            {editingOrderId && (
              <div className="notice">
                Estás editando una lista guardada.
                Al guardar, se actualizará esa misma lista.
              </div>
            )}

            <div className="product-search-box">
              <label htmlFor="product-search">
                Buscar producto
              </label>

              <input
                id="product-search"
                className="search-input"
                value={productQuery}
                onChange={e =>
                  setProductQuery(
                    e.target.value
                  )
                }
                placeholder="Escribe el nombre del producto..."
                autoComplete="off"
                disabled={!selected}
              />

              {productQuery.trim() !== '' &&
                selected && (
                  <div className="product-suggestions">
                    {filteredProducts.length ? (
                      filteredProducts
                        .slice(0, 8)
                        .map(product => (
                          <button
                            type="button"
                            key={product.id}
                            className="product-suggestion"
                            onClick={() =>
                              addToCart(
                                product
                              )
                            }
                          >
                            <span>
                              <strong>
                                {product.name}
                              </strong>

                              <small>
                                {
                                  product.category
                                }{' '}
                                ·{' '}
                                {
                                  product.unit
                                }
                              </small>
                            </span>

                            <span className="suggestion-price">
                              {product.price ==
                              null
                                ? 'Sin precio'
                                : money(
                                    Number(
                                      product.price
                                    )
                                  )}

                              <b>
                                + Agregar
                              </b>
                            </span>
                          </button>
                        ))
                    ) : (
                      <p className="no-suggestions">
                        No se encontraron productos.
                        Puedes agregarlos desde
                        Productos y precios.
                      </p>
                    )}
                  </div>
                )}
            </div>

            <div className="purchase-list-heading">
              <h3>
                Productos de la compra
              </h3>

              <span>
                {cart.length} productos diferentes
              </span>
            </div>

            {!cart.length ? (
              <div className="empty-purchase">
                <span className="empty-purchase-icon">
                  ＋
                </span>

                <h3>
                  Tu lista está vacía
                </h3>

                <p>
                  Busca un producto arriba
                  para comenzar.
                </p>
              </div>
            ) : (
              <div className="admin-table-wrap">
                <table className="admin-table">
                  <thead>
                    <tr>
                      <th>
                        Producto
                      </th>

                      <th>
                        Precio unit. (S/)
                      </th>

                      <th>
                        Cantidad
                      </th>

                      <th>
                        Subtotal
                      </th>

                      <th></th>
                    </tr>
                  </thead>

                  <tbody>
                    {cart.map(item => (
                      <tr
                        key={
                          item.product.id
                        }
                      >
                        <td>
                          <strong>
                            {
                              item.product
                                .name
                            }
                          </strong>
                        </td>

                        <td>
                          <input
                            className="qty-input"
                            type="number"
                            min="0"
                            step="0.01"
                            value={
                              item.price
                            }
                            aria-label={`Precio unitario de ${item.product.name}`}
                            onChange={e =>
                              editCartPrice(
                                item
                                  .product
                                  .id,
                                e.target
                                  .value
                              )
                            }
                          />
                        </td>

                        <td>
                          <input
                            className="qty-input"
                            type="number"
                            min="1"
                            step="1"
                            value={
                              item.quantity ===
                              0
                                ? ''
                                : item.quantity
                            }
                            aria-label={`Cantidad de ${item.product.name}`}
                            onChange={e =>
                              editQuantity(
                                item
                                  .product
                                  .id,
                                e.target
                                  .value
                              )
                            }
                            onBlur={() => {
                              setCart(
                                old =>
                                  old.map(
                                    row =>
                                      row
                                        .product
                                        .id ===
                                        item
                                          .product
                                          .id &&
                                      row.quantity <
                                        1
                                        ? {
                                            ...row,
                                            quantity: 1
                                          }
                                        : row
                                  )
                              )
                            }}
                          />
                        </td>

                        <td>
                          {money(
                            item.quantity *
                              item.price
                          )}
                        </td>

                        <td>
                          <button
                            type="button"
                            className="text-button"
                            onClick={() =>
                              changeQty(
                                item
                                  .product
                                  .id,
                                0
                              )
                            }
                          >
                            Quitar
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {cart.some(
              item => item.price <= 0
            ) && (
              <div className="notice">
                Hay productos sin precio válido.
                Ingresa el precio habitual o el
                precio negociado para cada producto.
              </div>
            )}

            <label className="notes-label">
              Notas de la lista

              <textarea
                value={orderNotes}
                onChange={e =>
                  setOrderNotes(
                    e.target.value
                  )
                }
                placeholder="Ej. Abona el viernes, entregar en..."
              />
            </label>

            <div className="purchase-footer">
              <div>
                <span>
                  Total de la compra
                </span>

                <strong>
                  {money(total)}
                </strong>
              </div>

              <button
                className="admin-button"
                disabled={
                  busy ||
                  !selected ||
                  cart.length === 0 ||
                  cart.some(
                    item =>
                      item.quantity < 1 ||
                      !Number.isFinite(
                        item.price
                      ) ||
                      item.price <= 0
                  )
                }
                onClick={() =>
                  void saveOrder()
                }
              >
                {busy
                  ? 'Guardando...'
                  : editingOrderId
                    ? 'Guardar cambios'
                    : 'Guardar lista'}
              </button>
            </div>
          </section>
        )}

        {/* =================================================
            PRODUCTOS Y PRECIOS
        ================================================= */}

        {section === 'precios' && (
          <>
            <section className="admin-panel">
              <h2>
                Agregar producto
              </h2>

              <p className="muted">
                Los nuevos productos se registrarán en Supabase.
              </p>

              <form
                className="admin-form"
                onSubmit={addProduct}
              >
                <label>
                  Nombre del producto

                  <input
                    value={newProduct}
                    onChange={e =>
                      setNewProduct(
                        e.target.value
                      )
                    }
                    required
                    placeholder="Ej. Arroz extra"
                  />
                </label>

                <label>
                  Categoría

                  <select
                    value={newCategory}
                    onChange={e =>
                      setNewCategory(
                        e.target.value
                      )
                    }
                  >
                    {categories.map(
                      category => (
                        <option
                          key={category}
                          value={category}
                        >
                          {category}
                        </option>
                      )
                    )}
                  </select>
                </label>

                <label>
                  Precio habitual (S/)

                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={newPrice}
                    onChange={e =>
                      setNewPrice(
                        e.target.value
                      )
                    }
                    placeholder="Ej. 4.50"
                  />
                </label>

                <div className="admin-form-actions">
                  <button
                    className="admin-button"
                    disabled={busy}
                  >
                    {busy
                      ? 'Guardando...'
                      : 'Agregar producto'}
                  </button>
                </div>
              </form>
            </section>

            <section className="admin-panel">
              <div className="panel-heading">
                <div>
                  <h2>
                    Catálogo de productos
                  </h2>

                  <p className="muted">
                    {products.length} productos registrados
                  </p>
                </div>
              </div>

              <input
                className="search-input"
                value={catalogQuery}
                onChange={e =>
                  setCatalogQuery(
                    e.target.value
                  )
                }
                placeholder="Buscar producto o categoría..."
              />

              <div className="product-grid">
                {catalogProducts.map(
                  product => (
                    <div
                      className="product-row"
                      key={product.id}
                    >
                      <span>
                        <strong>
                          {product.name}
                        </strong>

                        <small>
                          {product.category} ·{' '}
                          {product.unit}
                        </small>
                      </span>

                      <label className="price-edit">
                        <span>
                          Precio habitual (S/)
                        </span>

                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          key={`${product.id}-${product.price}`}
                          defaultValue={
                            product.price ??
                            ''
                          }
                          placeholder="Sin precio"
                          onBlur={e => {
                            const value =
                              e.target
                                .value

                            if (
                              value === '' ||
                              (
                                Number.isFinite(
                                  Number(
                                    value
                                  )
                                ) &&
                                Number(
                                  value
                                ) >= 0
                              )
                            ) {
                              if (
                                value ===
                                  '' ||
                                Number(
                                  value
                                ) !==
                                  Number(
                                    product.price
                                  )
                              ) {
                                void setPrice(
                                  product,
                                  value
                                )
                              }
                            } else {
                              setError(
                                'Introduce un precio válido.'
                              )
                            }
                          }}
                        />
                      </label>

                      <button
                        type="button"
                        className="admin-button secondary"
                        disabled={busy}
                        onClick={() =>
                          void deleteProduct(
                            product
                          )
                        }
                      >
                        Eliminar
                      </button>
                    </div>
                  )
                )}

                {!catalogProducts.length && (
                  <p className="muted">
                    No hay productos que coincidan con la búsqueda.
                  </p>
                )}
              </div>
            </section>
          </>
        )}

        {/* =================================================
            LISTAS GUARDADAS
        ================================================= */}

        {/* =================================================
            LISTAS PENDIENTES (pedidos de clientes)
        ================================================= */}

        {section === 'pendientes' && (
          <section className="admin-panel">
            <div className="panel-heading">
              <div>
                <h2>
                  Listas pendientes
                </h2>

                <p className="muted">
                  Pedidos de clientes por atender. Usa Editar para asignar precios y luego Marcar atendido.
                </p>
              </div>

              <strong>
                {pendingOrders.length} listas
              </strong>
            </div>

            <Orders
              orders={pendingOrders}
              customers={customers}
              onEdit={editSavedOrder}
              onAttend={markAttended}
              emptyText="No hay listas pendientes."
            />
          </section>
        )}

        {section === 'cuentas' && (
          <section className="admin-panel">
            <div className="panel-heading">
              <div>
                <h2>
                  Listas guardadas
                </h2>

                <p className="muted">
                  Historial de compras registradas.
                </p>
              </div>

              <strong>
                {savedOrders.length} listas
              </strong>
            </div>

            <Orders
              orders={savedOrders}
              customers={customers}
              onEdit={editSavedOrder}
            />
          </section>
        )}
      </main>
    </div>
  )
}

/* =========================================================
   LISTAS GUARDADAS
========================================================= */

const statusLabel = (status: string) =>
  status === 'pendiente'
    ? 'Pendiente'
    : status === 'atendido'
      ? 'Atendido'
      : status

function Orders({
  orders,
  customers,
  onEdit,
  onAttend,
  emptyText = 'Todavía no hay listas guardadas.'
}: {
  orders: Order[]
  customers: Customer[]
  onEdit: (order: Order) => void
  onAttend?: (order: Order) => void
  emptyText?: string
}) {
  const [expanded, setExpanded] =
    useState<string | null>(null)

  const [items, setItems] = useState<
    Record<string, OrderItem[]>
  >({})

  const [loading, setLoading] =
    useState<string | null>(null)

  const [loadError, setLoadError] =
    useState('')

  const [printingOrderId, setPrintingOrderId] =
    useState<string | null>(null)

  async function loadItems(
    orderId: string
  ): Promise<OrderItem[] | null> {
    if (items[orderId]) {
      return items[orderId]
    }

    setLoading(orderId)
    setLoadError('')

    const { data, error } =
      await supabase
        .from('detalle_pedido')
        .select(
          'id, product_id, product_name, quantity, unit_price, line_total'
        )
        .eq('order_id', orderId)

    setLoading(null)

    if (error) {
      setLoadError(error.message)
      return null
    }

    const orderItems =
      (data || []) as OrderItem[]

    setItems(prev => ({
      ...prev,
      [orderId]: orderItems
    }))

    return orderItems
  }

  async function show(order: Order) {
    if (expanded === order.id) {
      setExpanded(null)
      return
    }

    setExpanded(order.id)
    setLoadError('')

    await loadItems(order.id)
  }

  async function printList(order: Order) {
    const orderItems =
      await loadItems(order.id)

    if (!orderItems) {
      return
    }

    setPrintingOrderId(order.id)

    /*
      Esperamos un momento para que React
      renderice .print-area antes de abrir
      la ventana de impresión.
    */
    window.setTimeout(() => {
      window.print()
    }, 100)
  }

  useEffect(() => {
    function afterPrint() {
      setPrintingOrderId(null)
    }

    window.addEventListener(
      'afterprint',
      afterPrint
    )

    return () => {
      window.removeEventListener(
        'afterprint',
        afterPrint
      )
    }
  }, [])

  if (!orders.length) {
    return (
      <p className="muted">
        {emptyText}
      </p>
    )
  }

  const printingOrder =
    orders.find(
      order =>
        order.id === printingOrderId
    ) || null

  const printingItems =
    printingOrder
      ? items[printingOrder.id] || []
      : []

  const printingCustomer =
    printingOrder
      ? customers.find(
          customer =>
            customer.id ===
            printingOrder.customer_id
        )
      : null

  return (
    <>
      <div className="order-list">
        {orders.map(order => {
          const customer =
            customers.find(
              item =>
                item.id ===
                order.customer_id
            )

          return (
            <div
              className="order-entry"
              key={order.id}
            >
              <button
                className="order-head"
                onClick={() =>
                  void show(order)
                }
              >
                <span>
                  <strong>
                    {customer?.name ||
                      'Cliente'}
                  </strong>

                  <small>
                    {dateTime(
                      order.created_at
                    )}{' '}
                    · {statusLabel(order.status)}
                  </small>
                </span>

                <span className="order-right">
                  <strong>
                    {money(
                      Number(
                        order.total
                      )
                    )}
                  </strong>

                  {expanded ===
                  order.id
                    ? '−'
                    : '+'}
                </span>
              </button>

              {expanded ===
                order.id && (
                <div className="order-detail">
                  {loading ===
                    order.id && (
                    <p className="muted">
                      Cargando productos...
                    </p>
                  )}

                  {loadError && (
                    <p className="admin-alert error">
                      {loadError}
                    </p>
                  )}

                  {(items[
                    order.id
                  ] || []).map(item => (
                    <div
                      key={item.id}
                    >
                      <span>
                        {
                          item.product_name
                        }{' '}
                        × {item.quantity}
                        {' · '}
                        {money(
                          Number(
                            item.unit_price
                          )
                        )}{' '}
                        c/u
                      </span>

                      <strong>
                        {money(
                          Number(
                            item.line_total
                          )
                        )}
                      </strong>
                    </div>
                  ))}

                  {order.notes && (
                    <p className="muted">
                      Nota:{' '}
                      {order.notes}
                    </p>
                  )}

                  <div className="order-detail-total">
                    <strong>
                      Total
                    </strong>

                    <strong>
                      {money(
                        Number(
                          order.total
                        )
                      )}
                    </strong>
                  </div>

                  <div className="order-actions">
                    <button
                      type="button"
                      className="admin-button secondary"
                      onClick={() =>
                        onEdit(order)
                      }
                    >
                      Editar
                    </button>

                    {onAttend &&
                      order.status === 'pendiente' && (
                        <button
                          type="button"
                          className="admin-button"
                          onClick={() =>
                            onAttend(order)
                          }
                        >
                          Marcar atendido
                        </button>
                      )}

                    <button
                      type="button"
                      className="admin-button"
                      disabled={
                        loading ===
                        order.id
                      }
                      onClick={() =>
                        void printList(
                          order
                        )
                      }
                    >
                      Imprimir lista
                    </button>
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* =================================================
          ÁREA EXCLUSIVA DE IMPRESIÓN

          Esta parte NO aparece en pantalla.
          Tu Admin.css ya tiene las reglas
          @media print para .print-area.
      ================================================= */}

      {printingOrder &&
        printingCustomer && (
          <div className="print-area">
            <div className="print-header">
              <h1>
                2M Abarrotes
              </h1>

              <p>
                Mercado 2 de Mayo · Chimbote
              </p>
            </div>

            <div className="print-info">
              <div>
                <strong>
                  Cliente
                </strong>

                <span>
                  {
                    printingCustomer.name
                  }
                </span>
              </div>

              <div>
                <strong>
                  Fecha
                </strong>

                <span>
                  {dateTime(
                    printingOrder.created_at
                  )}
                </span>
              </div>
            </div>

            <table className="print-table">
              <thead>
                <tr>
                  <th>
                    Producto
                  </th>

                  <th>
                    Cant.
                  </th>

                  <th>
                    Precio
                  </th>

                  <th>
                    Total
                  </th>
                </tr>
              </thead>

              <tbody>
                {printingItems.map(
                  item => (
                    <tr
                      key={item.id}
                    >
                      <td>
                        {
                          item.product_name
                        }
                      </td>

                      <td>
                        {
                          item.quantity
                        }
                      </td>

                      <td>
                        {money(
                          Number(
                            item.unit_price
                          )
                        )}
                      </td>

                      <td>
                        {money(
                          Number(
                            item.line_total
                          )
                        )}
                      </td>
                    </tr>
                  )
                )}
              </tbody>
            </table>

            <div className="print-total">
              <span>
                TOTAL
              </span>

              <strong>
                {money(
                  Number(
                    printingOrder.total
                  )
                )}
              </strong>
            </div>

            {printingOrder.notes && (
              <div className="print-notes">
                <strong>
                  Nota:
                </strong>{' '}
                {printingOrder.notes}
              </div>
            )}

            <div className="print-footer">
              2M Abarrotes · Mercado 2 de Mayo
            </div>
          </div>
        )}
    </>
  )
}