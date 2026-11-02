import { Link } from 'react-router-dom'
import './Tienda.css'

// Página de inicio: solo la portada. El catálogo está dentro de "Mi cuenta".
export default function Tienda({ email, isAdmin }: { email: string | null; isAdmin: boolean }) {
  const destino = !email ? '/acceso' : isAdmin ? '/admin' : '/cliente'

  return (
    <main className="tienda">
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
            <Link className="primary" to={destino}>{!email ? 'Iniciar sesión ↗' : isAdmin ? 'Ir al dashboard ↗' : 'Ver productos ↗'}</Link>
            {!email && <Link className="outline" to="/registro">Crear cuenta</Link>}
          </div>
          <div className="hero-note">Precios de mercado · Promociones semanales · Listas guardadas</div>
        </section>
      </div>

      <footer>TIENDA DE ABARROTES <span>·</span> MERCADO 2 DE MAYO, CHIMBOTE</footer>
    </main>
  )
}
