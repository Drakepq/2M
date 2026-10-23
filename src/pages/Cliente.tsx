import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import './Cliente.css'

type Product = {
  id: string
  name: string
  category: string
  unit: string
  price: number | null
}

// Producto dentro de la lista que se está armando.
type DraftItem = {
  product_id: string | null
  product_name: string
  quantity: number
  unit_price: number
}

type OrderItem = {
  id: string
  product_id: string | null
  product_name: string
  quantity: number
  unit_price: number
  line_total: number
}

type Order = {
  id: string
  created_at: string
  total: number
  status: string
  detalle_pedido: OrderItem[]
}

const money = (n: number) => `S/ ${Number(n || 0).toFixed(2)}`

const dateTime = (value: string) =>
  new Date(value).toLocaleString('es-PE', {
    dateStyle: 'short',
    timeStyle: 'short',
  })

const statusLabel = (status: string) =>
  status === 'pendiente'
    ? 'Pendiente'
    : status === 'atendido'
      ? 'Atendido'
      : status

// "azu" encuentra "Azúcar", "lacteos" encuentra "Lácteos"
function normalizeText(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
}

export default function Cliente() {
  const navigate = useNavigate()

  const [name, setName] = useState('Cliente')
  const [email, setEmail] = useState('')
  const [customerId, setCustomerId] = useState<string | null>(null)
  const [checking, setChecking] = useState(true)

  const [products, setProducts] = useState<Product[]>([])
  const [orders, setOrders] = useState<Order[]>([])

  // Lista que se está armando. Si editingId tiene valor, se edita un pedido pendiente.
  const [items, setItems] = useState<DraftItem[]>([])
  const [editingId, setEditingId] = useState<string | null>(null)
  const [expanded, setExpanded] = useState<string | null>(null)

  const [query, setQuery] = useState('')
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  async function loadOrders() {
    const { data, error: ordersError } = await supabase
      .from('pedidos')
      .select(
        'id, created_at, total, status, detalle_pedido(id, product_id, product_name, quantity, unit_price, line_total)',
      )
      .order('created_at', { ascending: false })

    if (ordersError) {
      setError(ordersError.message)
      return
    }

    setOrders((data || []) as Order[])
  }

  useEffect(() => {
    let active = true

    async function init() {
      const { data, error: userError } = await supabase.auth.getUser()

      if (userError || !data.user) {
        navigate('/acceso')
        return
      }

      setEmail(data.user.email || '')
      setName(data.user.user_metadata?.name || 'Cliente')

      const [customerRes, productsRes, ordersRes] = await Promise.all([
        supabase
          .from('clientes')
          .select('id')
          .eq('user_id', data.user.id)
          .maybeSingle(),
        supabase
          .from('productos')
          .select('id, name, category, unit, price')
          .order('name'),
        supabase
          .from('pedidos')
          .select(
            'id, created_at, total, status, detalle_pedido(id, product_id, product_name, quantity, unit_price, line_total)',
          )
          .order('created_at', { ascending: false }),
      ])

      if (!active) return

      const loadError =
        customerRes.error || productsRes.error || ordersRes.error

      if (loadError) setError(loadError.message)

      if (!customerRes.error && !customerRes.data) {
        setError(
          'Tu cuenta todavía no está vinculada a la tienda. Avisa al administrador.',
        )
      }

      setCustomerId(customerRes.data?.id ?? null)
      setProducts((productsRes.data || []) as Product[])
      setOrders((ordersRes.data || []) as Order[])
      setChecking(false)
    }

    void init()

    return () => {
      active = false
    }
  }, [navigate])

  const normalizedQuery = normalizeText(query)

  const filteredProducts = products.filter((product) =>
    normalizeText(`${product.name} ${product.category}`).includes(
      normalizedQuery,
    ),
  )

  const productById = (id: string | null) =>
    id ? products.find((product) => product.id === id) : undefined

  const draftTotal = items.reduce(
    (sum, item) => sum + item.quantity * item.unit_price,
    0,
  )

  function addProduct(product: Product) {
    setItems((old) => {
      const found = old.find((item) => item.product_id === product.id)

      if (found) {
        return old.map((item) =>
          item.product_id === product.id
            ? { ...item, quantity: item.quantity + 1 }
            : item,
        )
      }

      return [
        ...old,
        {
          product_id: product.id,
          product_name: product.name,
          quantity: 1,
          unit_price: Number(product.price ?? 0),
        },
      ]
    })

    setQuery('')
    setError('')
    setMessage('')
  }

  function changeQty(index: number, quantity: number) {
    setItems((old) =>
      old.map((item, i) =>
        i === index
          ? { ...item, quantity: Math.max(1, Math.floor(quantity) || 1) }
          : item,
      ),
    )
  }

  function removeItem(index: number) {
    setItems((old) => old.filter((_, i) => i !== index))
  }

  function cancelEditing() {
    setItems([])
    setEditingId(null)
    setQuery('')
    setError('')
    setMessage('')
  }

  // Solo las listas pendientes se pueden editar.
  function editOrder(order: Order) {
    if (order.status !== 'pendiente') return

    setItems(
      order.detalle_pedido.map((item) => ({
        product_id: item.product_id,
        product_name: item.product_name,
        quantity: Number(item.quantity),
        unit_price: Number(item.unit_price),
      })),
    )
    setEditingId(order.id)
    setExpanded(null)
    setQuery('')
    setError('')
    setMessage('Editando tu lista pendiente.')
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  async function submitList() {
    setError('')
    setMessage('')

    if (!customerId) {
      setError('Tu cuenta todavía no está vinculada a la tienda.')
      return
    }

    if (!items.length) {
      setError('Agrega al menos un producto a la lista.')
      return
    }

    setSaving(true)

    const rows = (orderId: string) =>
      items.map((item) => ({
        order_id: orderId,
        product_id: item.product_id,
        product_name: item.product_name,
        quantity: item.quantity,
        unit_price: item.unit_price,
        line_total: item.quantity * item.unit_price,
      }))

    // ---- Editar lista pendiente ----
    if (editingId) {
      const { data: updated, error: updateError } = await supabase
        .from('pedidos')
        .update({ total: draftTotal })
        .eq('id', editingId)
        .select('id')
        .maybeSingle()

      if (updateError || !updated) {
        setSaving(false)
        setError(
          'No se pudo actualizar: es posible que la tienda ya haya atendido esta lista.',
        )
        setEditingId(null)
        await loadOrders()
        return
      }

      const { error: deleteError } = await supabase
        .from('detalle_pedido')
        .delete()
        .eq('order_id', editingId)

      if (deleteError) {
        setSaving(false)
        setError(deleteError.message)
        return
      }

      const { error: itemsError } = await supabase
        .from('detalle_pedido')
        .insert(rows(editingId))

      if (itemsError) {
        setSaving(false)
        setError(
          `No se pudo guardar tu lista: ${itemsError.message}. Vuelve a intentarlo.`,
        )
        await loadOrders()
        return
      }

      setSaving(false)
      setItems([])
      setEditingId(null)
      setMessage('Tu lista pendiente se actualizó.')
      await loadOrders()
      return
    }

    // ---- Enviar lista nueva ----
    const { data: order, error: orderError } = await supabase
      .from('pedidos')
      .insert({
        customer_id: customerId,
        total: draftTotal,
        status: 'pendiente',
      })
      .select('id')
      .single()

    if (orderError || !order) {
      setSaving(false)
      setError(orderError?.message || 'No se pudo enviar la lista.')
      return
    }

    const { error: itemsError } = await supabase
      .from('detalle_pedido')
      .insert(rows(order.id))

    if (itemsError) {
      await supabase.from('pedidos').delete().eq('id', order.id)
      setSaving(false)
      setError(
        `No se pudo enviar tu lista: ${itemsError.message}. Vuelve a intentarlo.`,
      )
      return
    }

    setSaving(false)
    setItems([])
    setMessage('¡Lista enviada! La tienda la verá como pendiente.')
    await loadOrders()
  }

  const logout = async () => {
    await supabase.auth.signOut()
    navigate('/')
  }

  if (checking) {
    return <main className="client-loading">Verificando acceso...</main>
  }

  return (
    <main className="client-page">
      <header className="client-header">
        <Link to="/" className="client-logo">
          2M.
        </Link>

        <nav>
          <Link to="/">Inicio</Link>
          <Link to="/cliente">Mi lista</Link>

          <button onClick={logout}>Cerrar sesión</button>
        </nav>
      </header>

      <section className="client-content">
        <p className="client-eyebrow">MI CUENTA</p>

        <h1>Hola, {name}</h1>

        <p className="client-email">{email}</p>

        <div className="client-layout">
          {/* ---------- Armar lista ---------- */}
          <div className="client-panel">
            <div className="client-panel-head">
              <div>
                <h2>{editingId ? 'Editar lista pendiente' : 'Nueva lista de compras'}</h2>
                <p>Busca un producto y agrégalo a tu lista.</p>
              </div>
            </div>

            {error && <div className="client-alert error">{error}</div>}
            {message && <div className="client-alert success">{message}</div>}

            <div className="client-search-box">
              <label htmlFor="client-search">Buscar producto</label>

              <input
                id="client-search"
                className="client-search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Escribe el nombre del producto..."
                autoComplete="off"
              />

              {query.trim() !== '' && (
                <div className="client-suggestions">
                  {filteredProducts.length ? (
                    filteredProducts.slice(0, 8).map((product) => (
                      <button
                        type="button"
                        key={product.id}
                        className="client-suggestion"
                        onClick={() => addProduct(product)}
                      >
                        <span>
                          <strong>{product.name}</strong>
                          <small>
                            {product.category} · {product.unit}
                          </small>
                        </span>

                        <span className="client-suggestion-side">
                          {product.price != null && money(Number(product.price))}
                          <b>+ Agregar</b>
                        </span>
                      </button>
                    ))
                  ) : (
                    <p className="client-empty">
                      No encontramos productos con esa búsqueda.
                    </p>
                  )}
                </div>
              )}
            </div>

            {items.length === 0 ? (
              <p className="client-empty">
                Todavía no agregaste productos a tu lista.
              </p>
            ) : (
              <>
                <div className="client-list">
                  {items.map((item, index) => {
                    const product = productById(item.product_id)

                    return (
                      <div
                        className="client-list-row"
                        key={item.product_id ?? `${item.product_name}-${index}`}
                      >
                        <span>
                          <strong>{item.product_name}</strong>
                          {product && (
                            <small>
                              {product.category} · {product.unit}
                            </small>
                          )}
                        </span>

                        <input
                          type="number"
                          min={1}
                          step={1}
                          value={item.quantity}
                          aria-label={`Cantidad de ${item.product_name}`}
                          onChange={(event) =>
                            changeQty(index, Number(event.target.value))
                          }
                        />

                        <button
                          type="button"
                          className="client-remove"
                          onClick={() => removeItem(index)}
                        >
                          Quitar
                        </button>
                      </div>
                    )
                  })}
                </div>

                {draftTotal > 0 && (
                  <p className="client-estimate">
                    Total estimado: <b>{money(draftTotal)}</b>
                    <small> · La tienda confirma el precio final.</small>
                  </p>
                )}
              </>
            )}

            <div className="client-actions">
              <button
                type="button"
                className="client-save"
                onClick={submitList}
                disabled={saving || items.length === 0}
              >
                {saving
                  ? 'Guardando...'
                  : editingId
                    ? 'Guardar cambios'
                    : 'Enviar lista'}
              </button>

              {(editingId || items.length > 0) && (
                <button
                  type="button"
                  className="client-cancel"
                  onClick={cancelEditing}
                  disabled={saving}
                >
                  {editingId ? 'Cancelar edición' : 'Vaciar lista'}
                </button>
              )}
            </div>
          </div>

          {/* ---------- Historial ---------- */}
          <div className="client-panel">
            <p className="client-eyebrow">LISTA</p>
            <h2 className="client-history-title">Historial de compras</h2>

            {orders.length === 0 ? (
              <p className="client-empty">
                Cuando envíes tu primera lista aparecerá aquí.
              </p>
            ) : (
              <div className="client-history">
                {orders.map((order) => {
                  const open = expanded === order.id
                  const pending = order.status === 'pendiente'

                  return (
                    <div className="client-order" key={order.id}>
                      <button
                        type="button"
                        className="client-order-head"
                        onClick={() => setExpanded(open ? null : order.id)}
                      >
                        <span>
                          <strong>{dateTime(order.created_at)}</strong>
                          <small>
                            {order.detalle_pedido.length} producto(s)
                            {Number(order.total) > 0 && ` · ${money(Number(order.total))}`}
                          </small>
                        </span>

                        <span className={`client-status ${pending ? 'pending' : 'done'}`}>
                          {statusLabel(order.status)}
                        </span>
                      </button>

                      {open && (
                        <div className="client-order-detail">
                          {order.detalle_pedido.map((item) => (
                            <div key={item.id}>
                              <span>
                                {item.product_name} × {item.quantity}
                              </span>
                              {Number(item.line_total) > 0 && (
                                <strong>{money(Number(item.line_total))}</strong>
                              )}
                            </div>
                          ))}

                          {pending ? (
                            <button
                              type="button"
                              className="client-edit"
                              onClick={() => editOrder(order)}
                            >
                              Editar esta lista
                            </button>
                          ) : (
                            <p className="client-empty">
                              Esta lista ya fue atendida y no se puede editar.
                            </p>
                          )}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      </section>
    </main>
  )
}
