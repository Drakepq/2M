import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import './Tienda.css'

type Prod = { id: string; name: string; category: string; unit: string; price: number | null; image_url: string | null; marca: string | null }
type Promo = { id: string; product_id: string | null; precio_promo: number; fecha_fin: string | null }

const money = (n: number) => `S/ ${Number(n).toFixed(2)}`
const norm = (v: string) => v.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim()

// Fotografías predeterminadas con una búsqueda visual distinta y un lock único por producto.
// Las fotos personalizadas guardadas en Supabase (image_url) siempre tienen prioridad.
// El catálogo inicial ya viene con sus fotos asignadas: no hay que cargarlas manualmente.
const FOTOS_POR_NOMBRE: Record<string, string> = {
  'arroz': 'https://loremflickr.com/600/600/rice,food?lock=201',
  'aceite': 'https://loremflickr.com/600/600/olive-oil,bottle?lock=202',
  'aceite vegetal': 'https://loremflickr.com/600/600/cooking-oil,bottle?lock=203',
  'azucar': 'https://loremflickr.com/600/600/sugar,food?lock=204',
  'atun en conserva': 'https://loremflickr.com/600/600/canned-fish,food?lock=205',
  'conserva de durazno': 'https://loremflickr.com/600/600/canned-peaches,fruit?lock=206',
  'leche evaporada': 'https://loremflickr.com/600/600/milk,carton?lock=207',
  'leche fresca': 'https://loremflickr.com/600/600/milk,bottle?lock=208',
  'fideos': 'https://loremflickr.com/600/600/spaghetti,pasta?lock=209',
  'harina': 'https://loremflickr.com/600/600/flour,baking?lock=210',
  'avena': 'https://loremflickr.com/600/600/oatmeal,food?lock=211',
  'lentejas': 'https://loremflickr.com/600/600/lentils,beans?lock=212',
  'frijol': 'https://loremflickr.com/600/600/beans,food?lock=213',
  'arveja partida': 'https://loremflickr.com/600/600/peas,food?lock=214',
  'sal': 'https://loremflickr.com/600/600/salt,food?lock=215',
  'cafe': 'https://loremflickr.com/600/600/coffee,beans?lock=216',
  'te': 'https://loremflickr.com/600/600/tea,cup?lock=217',
  'chocolate en polvo': 'https://loremflickr.com/600/600/cocoa,powder?lock=218',
  'galletas': 'https://loremflickr.com/600/600/cookies,biscuits?lock=219',
  'pan de molde': 'https://loremflickr.com/600/600/sliced,bread?lock=220',
  'mantequilla': 'https://loremflickr.com/600/600/butter,food?lock=221',
  'margarina': 'https://loremflickr.com/600/600/margarine,food?lock=222',
  'queso': 'https://loremflickr.com/600/600/cheese,food?lock=223',
  'huevos': 'https://loremflickr.com/600/600/eggs,carton?lock=224',
  'mayonesa': 'https://loremflickr.com/600/600/mayonnaise,jar?lock=225',
  'ketchup': 'https://loremflickr.com/600/600/ketchup,tomato?lock=226',
  'mostaza': 'https://loremflickr.com/600/600/mustard,jar?lock=227',
  'vinagre': 'https://loremflickr.com/600/600/vinegar,bottle?lock=228',
  'sillao': 'https://loremflickr.com/600/600/soy-sauce,bottle?lock=229',
  'caldo en cubos': 'https://loremflickr.com/600/600/bouillon,cubes?lock=230',
  'sopa instantanea': 'https://loremflickr.com/600/600/instant-noodles?lock=231',
  'mermelada': 'https://loremflickr.com/600/600/jam,jar?lock=232',
  'gelatina': 'https://loremflickr.com/600/600/jelly,dessert?lock=233',
  'jabon de lavar': 'https://loremflickr.com/600/600/laundry-soap?lock=234',
  'detergente': 'https://loremflickr.com/600/600/laundry-detergent?lock=235',
  'lejia': 'https://loremflickr.com/600/600/bleach,cleaning?lock=236',
  'poett': 'https://loremflickr.com/600/600/cleaning-spray?lock=237',
  'lavavajilla': 'https://loremflickr.com/600/600/dish-soap?lock=238',
  'esponja': 'https://loremflickr.com/600/600/cleaning-sponge?lock=239',
  'papel higienico': 'https://loremflickr.com/600/600/toilet-paper?lock=240',
  'papel toalla': 'https://loremflickr.com/600/600/paper-towels?lock=241',
  'jabon de tocador': 'https://loremflickr.com/600/600/bar-soap?lock=242',
  'shampoo': 'https://loremflickr.com/600/600/shampoo,bottle?lock=243',
  'pasta dental': 'https://loremflickr.com/600/600/toothpaste?lock=244',
  'cepillo dental': 'https://loremflickr.com/600/600/toothbrush?lock=245',
  'desodorante': 'https://loremflickr.com/600/600/deodorant?lock=246',
  'toallas higienicas': 'https://loremflickr.com/600/600/sanitary-pads?lock=247',
  'panales': 'https://loremflickr.com/600/600/diapers?lock=248',
  'bolsas de basura': 'https://loremflickr.com/600/600/trash-bags?lock=249',
  'fosforos': 'https://loremflickr.com/600/600/matches,box?lock=250',
  'velas': 'https://loremflickr.com/600/600/candles?lock=251',
  'agua mineral': 'https://loremflickr.com/600/600/water-bottle?lock=252',
  'gaseosa': 'https://loremflickr.com/600/600/soda,bottle?lock=253',
  'jugo en caja': 'https://loremflickr.com/600/600/juice,carton?lock=254',
  'caramelos': 'https://loremflickr.com/600/600/candy,sweets?lock=255',
  'comida para mascotas': 'https://loremflickr.com/600/600/pet-food?lock=256',
}
const FOTOS_POR_CATEGORIA: Record<string, string> = {
  'abarrotes': 'https://loremflickr.com/600/600/grocery,food?lock=901',
  'conservas': 'https://loremflickr.com/600/600/canned,food?lock=902',
  'lacteos': 'https://loremflickr.com/600/600/dairy,milk?lock=903',
  'bebidas': 'https://loremflickr.com/600/600/drinks,bottle?lock=904',
  'limpieza': 'https://loremflickr.com/600/600/cleaning,products?lock=905',
  'higiene': 'https://loremflickr.com/600/600/personal-care,products?lock=906',
  'dulces': 'https://loremflickr.com/600/600/candy,sweets?lock=907',
  'hogar': 'https://loremflickr.com/600/600/household,products?lock=908',
  'otros': 'https://loremflickr.com/600/600/grocery,store?lock=909',
}
function Foto({ p }: { p: Prod }) {
  const [bad, setBad] = useState(false)
  const key = norm(p.name)
  const fallback = FOTOS_POR_NOMBRE[key] || FOTOS_POR_CATEGORIA[norm(p.category)] || `https://loremflickr.com/600/600/grocery,product?lock=${encodeURIComponent(p.id)}`
  const src = p.image_url || fallback
  return (
    <div className="tc-img">
      {bad ? <span className="tc-ph">{p.marca && <b>{p.marca}</b>}{p.name}</span>
        : <img src={src} alt={`${p.marca ?? ''} ${p.name}`.trim()} loading="lazy" onError={() => setBad(true)} />}
    </div>
  )
}

export default function Tienda({ email, isAdmin }: { email: string | null; isAdmin: boolean }) {
  const navigate = useNavigate()
  const [prods, setProds] = useState<Prod[]>([])
  const [promos, setPromos] = useState<Promo[]>([])
  const [cat, setCat] = useState('Todos')
  const [q, setQ] = useState('')
  const destino = !email ? '/acceso' : isAdmin ? '/admin' : '/cliente'

  useEffect(() => {
    void Promise.all([
      supabase.from('productos').select('id,name,category,unit,price,image_url,marca').order('name'),
      supabase.from('promociones').select('id,product_id,precio_promo,fecha_fin').order('created_at', { ascending: false }),
    ]).then(async ([a, b]) => {
      let data = a.data
      if (a.error) data = (await supabase.from('productos').select('id,name,category,unit,price').order('name')).data // aún sin supabase_imagenes.sql
      setProds(((data || []) as Partial<Prod>[]).map(p => ({ image_url: null, marca: null, ...p })) as Prod[])
      const hoy = new Date().toISOString().slice(0, 10)
      setPromos(((b.data || []) as Promo[]).filter(p => !p.fecha_fin || p.fecha_fin >= hoy))
    })
  }, [])

  const cats = ['Todos', ...Array.from(new Set(prods.map(p => p.category)))]
  const promoOf = (id: string) => promos.find(p => p.product_id === id)
  const lista = prods.filter(p => (cat === 'Todos' || p.category === cat) && norm(`${p.name} ${p.marca ?? ''} ${p.category}`).includes(norm(q)))
  const grupos = cat === 'Todos' && !q ? cats.slice(1).map(c => [c, lista.filter(p => p.category === c)] as const) : [[q ? 'Resultados' : cat, lista] as const]

  function Card({ p }: { p: Prod }) {
    const pr = promoOf(p.id)
    const desc = pr && p.price ? Math.round((1 - pr.precio_promo / Number(p.price)) * 100) : 0
    return (
      <article className="tc">
        {pr && desc > 0 && <span className="tc-badge">-{desc}%</span>}
        <Foto p={p} />
        <small>{p.marca || p.category}</small>
        <h3>{p.name}</h3>
        <p className="tc-unit">por {p.unit}</p>
        <div className="tc-price">
          {p.price == null ? <span className="tc-none">Consultar</span> : pr ? <><b>{money(pr.precio_promo)}</b><s>{money(Number(p.price))}</s></> : <b>{money(Number(p.price))}</b>}
        </div>
        <button onClick={() => navigate(destino)}>+ Agregar a mi lista</button>
      </article>
    )
  }

  return (
    <main className="tienda">
      {/* Portada: misma que la versión original */}
      <div className="landing">
        <nav className="topnav"><Link className="brand" to="/">2M<span>.</span> ABARROTES</Link>
          <div style={{ display: 'flex', gap: 10 }}>
            {!email && <Link className="outline" to="/registro">Crear cuenta</Link>}
            <Link className="primary" to={destino}>{!email ? 'Iniciar sesión' : isAdmin ? 'Ir al dashboard' : 'Mi cuenta'}</Link>
          </div></nav>
        <section className="landing-hero">
          <p className="eyebrow">MERCADO 2 DE MAYO · CHIMBOTE</p>
          <h1>Todo para tu hogar,<br /><em>al mejor precio.</em></h1>
          <p>Abarrotes, limpieza y productos de primera necesidad en el Mercado 2 de Mayo. Arma tu lista de compras, aprovecha las promociones y recógela sin colas.</p>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            <a className="primary" href="#catalogo">Ver productos ↓</a>
            {!email && <Link className="outline" to="/registro">Crear cuenta</Link>}
          </div>
          <div className="hero-note">Precios de mercado · Promociones semanales · Listas guardadas</div>
        </section>
      </div>

      <div className="t-bar" id="catalogo">
        <input className="t-search" value={q} onChange={e => setQ(e.target.value)} placeholder="¿Qué estás buscando? Arroz, aceite, detergente..." />
        <nav className="t-cats">{cats.map(c => <button key={c} className={c === cat ? 'on' : ''} onClick={() => { setCat(c); setQ('') }}>{c}</button>)}</nav>
      </div>

      {promos.length > 0 && !q && cat === 'Todos' && (
        <section className="t-sec" id="promociones">
          <div className="t-sec-head"><h2>Promociones</h2><span>Precios especiales por tiempo limitado</span></div>
          <div className="t-grid">{promos.map(pr => { const p = prods.find(x => x.id === pr.product_id); return p ? <Card key={pr.id} p={p} /> : null })}</div>
        </section>
      )}

      <section className="t-sec">
        {prods.length === 0 && <p className="muted">Cargando productos…</p>}
        {grupos.map(([nombre, items]) => items.length > 0 && (
          <div key={nombre} style={{ marginBottom: 38 }}>
            <div className="t-sec-head"><h2>{nombre}</h2><span>{items.length} productos</span></div>
            <div className="t-grid">{items.map(p => <Card key={p.id} p={p} />)}</div>
          </div>
        ))}
        {prods.length > 0 && lista.length === 0 && <p className="muted">No encontramos productos con esa búsqueda.</p>}
      </section>

      <footer>TIENDA DE ABARROTES <span>·</span> MERCADO 2 DE MAYO, CHIMBOTE</footer>
    </main>
  )
}
