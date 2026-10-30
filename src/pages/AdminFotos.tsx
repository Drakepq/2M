import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'
import './AdminFotos.css'

type P = { id: string; name: string; category: string; unit: string; image_url: string | null; marca: string | null }
type Fit = 'contain' | 'cover'
const norm = (v: string) => v.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim()
const FRAME_W = 900
const FRAME_H = 760

export default function AdminFotos() {
  const [rows, setRows] = useState<P[]>([])
  const [q, setQ] = useState('')
  const [busy, setBusy] = useState('')
  const [msg, setMsg] = useState('')
  const [editing, setEditing] = useState<P | null>(null)
  const [file, setFile] = useState<File | null>(null)
  const [previewUrl, setPreviewUrl] = useState('')
  const [fit, setFit] = useState<Fit>('cover')
  const [zoom, setZoom] = useState(1)
  // Desplazamiento en coordenadas del lienzo final (900 × 760).
  const [x, setX] = useState(0)
  const [y, setY] = useState(0)
  const dragRef = useRef<{ pointerId: number; startX: number; startY: number; originX: number; originY: number } | null>(null)

  const load = useCallback(async () => {
    const { data, error } = await supabase.from('productos').select('id,name,category,unit,image_url,marca').order('name')
    if (error) setMsg(error.message + ' (¿ejecutaste supabase_imagenes.sql?)')
    setRows((data || []) as P[])
  }, [])
  useEffect(() => { void load() }, [load])
  useEffect(() => () => { if (previewUrl) URL.revokeObjectURL(previewUrl) }, [previewUrl])

  const lista = useMemo(() => rows.filter(p => norm(`${p.name} ${p.marca ?? ''}`).includes(norm(q))), [rows, q])

  function abrirEditor(p: P, selected: File) {
    if (!selected.type.startsWith('image/')) { setMsg('Selecciona un archivo de imagen válido.'); return }
    if (selected.size > 12 * 1024 * 1024) { setMsg('La imagen supera 12 MB. Reduce su tamaño antes de subirla.'); return }
    setMsg('')
    setEditing(p)
    setFile(selected)
    setPreviewUrl(URL.createObjectURL(selected))
    setFit('cover')
    setZoom(1)
    setX(0)
    setY(0)
  }

  function cerrarEditor() {
    setEditing(null)
    setFile(null)
    setPreviewUrl('')
    dragRef.current = null
    setZoom(1); setX(0); setY(0); setFit('cover')
  }

  async function guardarImagen() {
    if (!editing || !file || !previewUrl) return
    setBusy(editing.id); setMsg('')
    try {
      const image = new Image()
      image.src = previewUrl
      await new Promise<void>((resolve, reject) => { image.onload = () => resolve(); image.onerror = () => reject(new Error('No se pudo leer la imagen.')) })

      const canvas = document.createElement('canvas')
      canvas.width = FRAME_W; canvas.height = FRAME_H
      const ctx = canvas.getContext('2d')
      if (!ctx) throw new Error('No se pudo preparar la imagen.')
      ctx.fillStyle = '#f4f1ea'
      ctx.fillRect(0, 0, FRAME_W, FRAME_H)
      const base = fit === 'contain'
        ? Math.min(FRAME_W / image.naturalWidth, FRAME_H / image.naturalHeight)
        : Math.max(FRAME_W / image.naturalWidth, FRAME_H / image.naturalHeight)
      const scale = base * zoom
      const w = image.naturalWidth * scale
      const h = image.naturalHeight * scale
      const dx = (FRAME_W - w) / 2 + x
      const dy = (FRAME_H - h) / 2 + y
      ctx.drawImage(image, dx, dy, w, h)

      const blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob(b => b ? resolve(b) : reject(new Error('No se pudo exportar la imagen.')), 'image/webp', 0.92))
      const path = `${editing.id}-${Date.now()}.webp`
      const up = await supabase.storage.from('productos').upload(path, blob, { contentType: 'image/webp', upsert: true })
      if (up.error) throw up.error
      const url = supabase.storage.from('productos').getPublicUrl(path).data.publicUrl
      const { error } = await supabase.from('productos').update({ image_url: url }).eq('id', editing.id)
      if (error) throw error
      cerrarEditor()
      await load()
      setMsg(`Imagen de “${editing.name}” guardada correctamente.`)
    } catch (e) {
      setMsg(e instanceof Error ? e.message : 'Ocurrió un error al guardar la imagen.')
    } finally { setBusy('') }
  }

  async function guardarMarca(p: P, marca: string) {
    const value = marca.trim() || null
    const { error } = await supabase.from('productos').update({ marca: value }).eq('id', p.id)
    if (error) setMsg(error.message)
    else setRows(old => old.map(r => r.id === p.id ? { ...r, marca: value } : r))
  }

  return (
    <section className="admin-panel fotos-admin">
      <div className="fotos-heading">
        <div><h2>Fotos y marcas de productos</h2><p className="admin-muted">Sube una foto y ajústala visualmente antes de guardarla. La vista previa tiene la misma proporción que la foto de la tienda.</p></div>
        <span className="fotos-size">Recomendado: 1000 × 1000 px</span>
      </div>
      {msg && <div className={`admin-alert ${msg.includes('correctamente') ? 'success' : 'error'}`}>{msg}</div>}
      <input className="search-input" placeholder="Buscar producto..." value={q} onChange={e => setQ(e.target.value)} />
      <div className="fotos-list">
        {lista.map(p => (
          <div className="fotos-row" key={p.id}>
            {p.image_url ? <img className="fotos-thumb" src={p.image_url} alt={`Foto de ${p.name}`} /> : <div className="fotos-thumb fotos-empty">Sin foto</div>}
            <div className="fotos-product"><strong>{p.name}</strong><small>{p.category} · por {p.unit}</small></div>
            <label className="fotos-brand">Marca<input defaultValue={p.marca ?? ''} placeholder="Ej. Primor" onBlur={e => e.target.value !== (p.marca ?? '') && guardarMarca(p, e.target.value)} /></label>
            <label className="admin-button secondary fotos-upload">
              {p.image_url ? 'Cambiar / editar foto' : 'Subir y editar foto'}
              <input type="file" accept="image/*" hidden onChange={e => { const selected = e.target.files?.[0]; if (selected) abrirEditor(p, selected); e.currentTarget.value = '' }} />
            </label>
          </div>
        ))}
      </div>

      {editing && previewUrl && (
        <div className="foto-editor-backdrop" role="presentation" onMouseDown={e => { if (e.target === e.currentTarget) cerrarEditor() }}>
          <section className="foto-editor" role="dialog" aria-modal="true" aria-labelledby="foto-editor-title">
            <div className="foto-editor-head"><div><h3 id="foto-editor-title">Editar imagen</h3><p>{editing.name}</p></div><button className="foto-close" onClick={cerrarEditor} aria-label="Cerrar">×</button></div>
            <div className="foto-editor-body">
              <div className="foto-preview-column">
                <span className="foto-label">Así se verá en la tienda</span>
                <div
                  className={`foto-live-preview ${dragRef.current ? 'is-dragging' : ''}`}
                  onPointerDown={e => {
                    e.preventDefault()
                    const rect = e.currentTarget.getBoundingClientRect()
                    e.currentTarget.setPointerCapture(e.pointerId)
                    dragRef.current = { pointerId: e.pointerId, startX: e.clientX, startY: e.clientY, originX: x, originY: y }
                    e.currentTarget.dataset.frameW = String(rect.width)
                    e.currentTarget.dataset.frameH = String(rect.height)
                    e.currentTarget.classList.add('is-dragging')
                  }}
                  onPointerMove={e => {
                    const drag = dragRef.current
                    if (!drag || drag.pointerId !== e.pointerId) return
                    const rect = e.currentTarget.getBoundingClientRect()
                    setX(drag.originX + (e.clientX - drag.startX) * (FRAME_W / rect.width))
                    setY(drag.originY + (e.clientY - drag.startY) * (FRAME_H / rect.height))
                  }}
                  onPointerUp={e => { if (dragRef.current?.pointerId === e.pointerId) dragRef.current = null; e.currentTarget.classList.remove('is-dragging') }}
                  onPointerCancel={e => { dragRef.current = null; e.currentTarget.classList.remove('is-dragging') }}
                  onLostPointerCapture={() => { dragRef.current = null }}
                  title="Arrastra la imagen para elegir qué parte se verá"
                  onWheel={e => { e.preventDefault(); setZoom(current => Math.min(3, Math.max(1, Number((current + (e.deltaY < 0 ? 0.1 : -0.1)).toFixed(2))))) }}
                >
                  <img src={previewUrl} alt="Vista previa recortable del producto" style={{ objectFit: fit, objectFit: fit, transform: `translate(${(x / FRAME_W) * 100}%, ${(y / FRAME_H) * 100}%) scale(${zoom})` }} draggable={false} />
                  <span className="foto-crop-hint">Arrastra para encuadrar</span>
                </div>
                <small className="foto-preview-note">El marco muestra exactamente el recorte que se guardará en la tienda.</small>
              </div>
              <div className="foto-controls">
                <label className="foto-label">Ajuste de imagen</label>
                <div className="foto-fit-options">
                  <button type="button" className={fit === 'cover' ? 'active' : ''} onClick={() => { setFit('cover'); setX(0); setY(0); setZoom(1) }}><b>Recortar</b><small>Llena el marco; arrastra para encuadrar</small></button>
                  <button type="button" className={fit === 'contain' ? 'active' : ''} onClick={() => { setFit('contain'); setX(0); setY(0); setZoom(1) }}><b>Imagen completa</b><small>Muestra todo el producto</small></button>
                </div>
                <label className="foto-range">Zoom <strong>{zoom.toFixed(1)}×</strong><input type="range" min="1" max="2.5" step="0.05" value={zoom} onChange={e => setZoom(Number(e.target.value))} /></label>
                <div className="foto-position-readout">Posición: horizontal {Math.round(x)} · vertical {Math.round(y)}</div>
                <button type="button" className="foto-reset" onClick={() => { setFit('cover'); setZoom(1); setX(0); setY(0) }}>Restablecer recorte</button>
                <p className="foto-help">Arrastra la foto dentro del marco para elegir el encuadre. Usa la rueda de zoom para acercar o alejar; también puedes usar el control de zoom.</p>
              </div>
            </div>
            <div className="foto-editor-footer"><button type="button" className="foto-cancel" onClick={cerrarEditor}>Cancelar</button><button type="button" className="foto-save" onClick={() => void guardarImagen()} disabled={busy === editing.id}>{busy === editing.id ? 'Guardando…' : 'Guardar imagen ajustada'}</button></div>
          </section>
        </div>
      )}
    </section>
  )
}
