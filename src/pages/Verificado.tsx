import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import './Acceso.css'

export default function Verificado() {
  const [loading, setLoading] = useState(true)
  const [verified, setVerified] = useState(false)

  useEffect(() => {
    async function verifySession() {
      const {
        data: { session },
      } = await supabase.auth.getSession()

      setVerified(Boolean(session))
      setLoading(false)
    }

    void verifySession()
  }, [])

  if (loading) {
    return <div className="auth-loading">Verificando tu cuenta...</div>
  }

  return (
    <main className="auth-page">
      <section className="auth-card">
        <div className="auth-brand">
          <span>2M.</span>
          <small>ABARROTES</small>
        </div>

        {verified ? (
          <>
            <h1>¡Correo confirmado!</h1>
            <p className="auth-description">
              Tu cuenta de 2M. ABARROTES ya está verificada.
            </p>
            <div className="auth-message success">Puedes ingresar a tu cuenta.</div>
            <Link className="auth-button" to="/cliente" style={{ display: 'grid', placeItems: 'center' }}>
              Entrar a mi cuenta
            </Link>
          </>
        ) : (
          <>
            <h1>Cuenta confirmada</h1>
            <p className="auth-description">
              La confirmación terminó. Ahora puedes iniciar sesión.
            </p>
            <Link className="auth-button" to="/acceso" style={{ display: 'grid', placeItems: 'center' }}>
              Iniciar sesión
            </Link>
          </>
        )}

        <div className="auth-links">
          <Link to="/">Volver a la tienda</Link>
        </div>
      </section>
    </main>
  )
}
