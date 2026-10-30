import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { supabase } from '../lib/supabase'

type Prod = { id: string; name: string; unit: string; price: number | null }
type Promo = { id: string; titulo: string; descripcion: string | null; product_id: string | null; precio_promo: number; activa: boolean; fecha_fin: string | null }

export default function AdminPromos() {
  const [prods, setProds] = useState<Prod[]>([])
  const [promos, setPromos] = useState<Promo[]>([])
  const [f, setF] = useState({ titulo: '', descripcion: '', product_id: '', precio_promo: '', fecha_fin: '' })
  const [msg, setMsg] = useState('')

  const load = useCallback(async () => {
    const [a, b] = await Promise.all([
      supabase.from('productos').select('id,name,unit,price').order('name'),
      supabase.from('promociones').select('*').order('created_at', { ascending: false }),
    ])
    setProds((a.data || []) as Prod[]); setPromos((b.data || []) as Promo[])
    if (a.error || b.error) setMsg((a.error || b.error)!.message)
  }, [])
  useEffect(() => { void load() }, [load])

  async function add(e: FormEvent) {
    e.preventDefault(); setMsg('')
    const { error } = await supabase.from('promociones').insert({
      titulo: f.titulo.trim(), descripcion: f.descripcion.trim() || null, product_id: f.product_id,
      precio_promo: Number(f.precio_promo), fecha_fin: f.fecha_fin || null,
    })
    if (error) return setMsg(error.message)
    setF({ titulo: '', descripcion: '', product_id: '', precio_promo: '', fecha_fin: '' }); void load()
  }
  async function toggle(p: Promo) { await supabase.from('promociones').update({ activa: !p.activa }).eq('id', p.id); void load() }
  async function del(p: Promo) { if (confirm('¿Eliminar esta promoción?')) { await supabase.from('promociones').delete().eq('id', p.id); void load() } }

  return (
    <section className="admin-panel">
      <h2>Promociones</h2>
      <p className="admin-muted">Las promociones activas aparecen en la página de inicio y se aplican al armar la lista del cliente.</p>
      {msg && <div className="admin-alert error">{msg}</div>}
      <form className="admin-form" onSubmit={add}>
        <label>Título<input required value={f.titulo} onChange={e => setF({ ...f, titulo: e.target.value })} placeholder="Ej: Arroz de la semana" /></label>
        <label>Producto<select required value={f.product_id} onChange={e => setF({ ...f, product_id: e.target.value })}>
          <option value="">Elige un producto</option>{prods.map(p => <option key={p.id} value={p.id}>{p.name} ({p.unit}){p.price != null ? ` · S/ ${Number(p.price).toFixed(2)}` : ''}</option>)}
        </select></label>
        <label>Precio promoción (S/)<input required type="number" min="0" step="0.10" value={f.precio_promo} onChange={e => setF({ ...f, precio_promo: e.target.value })} /></label>
        <label>Válida hasta (opcional)<input type="date" value={f.fecha_fin} onChange={e => setF({ ...f, fecha_fin: e.target.value })} /></label>
        <label style={{ gridColumn: '1/-1' }}>Descripción corta<input value={f.descripcion} onChange={e => setF({ ...f, descripcion: e.target.value })} /></label>
        <div className="admin-form-actions"><button className="admin-button">Crear promoción</button></div>
      </form>
      <h3>Promociones creadas</h3>
      <div className="customer-list">
        {promos.length === 0 && <p className="admin-muted">Todavía no hay promociones.</p>}
        {promos.map(p => {
          const pr = prods.find(x => x.id === p.product_id)
          return (
            <div className="customer-row" key={p.id} style={{ cursor: 'default' }}>
              <span><strong>{p.titulo}</strong><small>{pr?.name} · S/ {Number(p.precio_promo).toFixed(2)}{pr?.price != null && ` (antes S/ ${Number(pr.price).toFixed(2)})`}{p.fecha_fin && ` · hasta ${p.fecha_fin}`}</small></span>
              <span style={{ display: 'flex', gap: 8 }}>
                <button className="admin-button secondary" onClick={() => toggle(p)}>{p.activa ? 'Desactivar' : 'Activar'}</button>
                <button className="admin-button secondary" onClick={() => del(p)}>Eliminar</button>
              </span>
            </div>
          )
        })}
      </div>
    </section>
  )
}
