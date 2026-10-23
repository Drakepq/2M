import { useEffect, useState } from 'react'
import { Link, Navigate, Route, Routes } from 'react-router-dom'
import { supabase } from './lib/supabase'
import { checkAdminRole } from './lib/auth'
import Acceso from './pages/Acceso'
import Registro from './pages/Registro'
import Cliente from './pages/Cliente'
import Verificado from './pages/Verificado'
import Admin from './pages/Admin'
import './store.css'

function Home({ email, isAdmin }: { email: string | null; isAdmin: boolean }) {
  const destino = !email ? '/acceso' : isAdmin ? '/admin' : '/cliente'
  return <main className="landing"><nav className="topnav"><Link className="brand" to="/">2M<span>.</span> ABARROTES</Link>
    <div style={{display:'flex',gap:10}}>
      {!email && <Link className="outline" to="/registro">Crear cuenta</Link>}
      <Link className="primary" to={destino}>{!email ? 'Iniciar sesión' : isAdmin ? 'Ir al dashboard' : 'Mi cuenta'}</Link>
    </div></nav>
    <section className="landing-hero"><p className="eyebrow">MERCADO 2 DE MAYO · CHIMBOTE</p><h1>La cuenta de siempre,<br/><em>ahora más fácil.</em></h1><p>Un espacio para organizar las compras de tus clientes, guardar sus listas y consultar sus cuentas sin depender del cuaderno físico.</p><div style={{display:'flex',gap:12,flexWrap:'wrap'}}><Link className="primary" to={destino}>{!email ? 'Iniciar sesión ↗' : isAdmin ? 'Ir al dashboard ↗' : 'Mi cuenta ↗'}</Link>{!email && <Link className="outline" to="/registro">Crear cuenta</Link>}</div><div className="hero-note">Registro de clientes · Listas de productos · Cuentas guardadas</div></section>
    <footer>TIENDA DE ABARROTES <span>·</span> MERCADO 2 DE MAYO, CHIMBOTE</footer>
  </main>
}

function AdminDenied() {
  return <main className="auth-page"><section className="auth-card">
    <div className="auth-brand"><span>2M.</span><small>ABARROTES</small></div>
    <h1>Acceso restringido</h1>
    <p className="auth-description">Tu cuenta no tiene permisos de administrador para acceder a esta sección.</p>
    <div className="auth-links"><Link to="/cliente">Ir a mi cuenta</Link><Link to="/">Volver al inicio</Link></div>
  </section></main>
}

export default function App() {
  const [sessionReady, setSessionReady] = useState(false)
  const [userId, setUserId] = useState<string | null>(null)
  const [email, setEmail] = useState<string | null>(null)
  const [isAdmin, setIsAdmin] = useState(false)
  const [roleReady, setRoleReady] = useState(false)

  // Lee la sesión actual y el rol. Los formularios de acceso/registro la
  // llaman al terminar para que la navegación ya conozca el rol.
  async function refreshSession() {
    const { data, error } = await supabase.auth.getSession()
    if (error) throw error

    const session = data.session
    const currentUserId = session?.user.id ?? null
    setUserId(currentUserId)
    setEmail(session?.user.email ?? null)

    if (!currentUserId) {
      setIsAdmin(false)
      setRoleReady(true)
      return
    }

    setRoleReady(false)
    try {
      setIsAdmin(await checkAdminRole(currentUserId))
    } catch (err) {
      console.error('No se pudo comprobar el rol:', err)
      setIsAdmin(false)
    } finally {
      setRoleReady(true)
    }
  }

  useEffect(() => {
    let active = true

    // Sesión restaurada, inicio y cierre de sesión (también en otras pestañas).
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setUserId(session?.user.id ?? null)
      setEmail(session?.user.email ?? null)

      if (!session) {
        setIsAdmin(false)
        setRoleReady(true)
        setSessionReady(true)
        return
      }

      setRoleReady(false)
      // Fuera del callback para no bloquear el cliente de Supabase.
      setTimeout(() => {
        checkAdminRole(session.user.id)
          .then((admin) => { if (active) setIsAdmin(admin) })
          .catch((err) => {
            console.error('Error al comprobar el rol:', err)
            if (active) setIsAdmin(false)
          })
          .finally(() => {
            if (active) { setRoleReady(true); setSessionReady(true) }
          })
      }, 0)
    })

    supabase.auth.getSession().then(({ data }) => {
      if (active && !data.session) { setRoleReady(true); setSessionReady(true) }
    })

    return () => {
      active = false
      listener.subscription.unsubscribe()
    }
  }, [])

  if (!sessionReady) return <div className="auth-loading">2M<span>.</span></div>

  const home = userId && roleReady ? (isAdmin ? '/admin' : '/cliente') : null

  return (
    <Routes>
      <Route path="/" element={<Home email={email} isAdmin={isAdmin} />} />

      <Route path="/acceso" element={home ? <Navigate to={home} replace /> : <Acceso onLogin={refreshSession} />} />
      <Route path="/registro" element={home ? <Navigate to={home} replace /> : <Registro onLogin={refreshSession} />} />

      {/* Destino del enlace de confirmación del correo */}
      <Route path="/cliente/verificado" element={<Verificado />} />

      <Route path="/cliente" element={
        !userId ? <Navigate to="/acceso" replace />
        : !roleReady ? <div className="auth-loading">Verificando cuenta…</div>
        : isAdmin ? <Navigate to="/admin" replace />
        : <Cliente />
      } />

      <Route path="/admin" element={
        !userId ? <Navigate to="/acceso" replace />
        : !roleReady ? <div className="auth-loading">Verificando permisos…</div>
        : isAdmin ? <Admin />
        : <AdminDenied />
      } />

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
