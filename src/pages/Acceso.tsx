import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase, isSupabaseConfigured } from '../lib/supabase'
import { checkAdminRole } from '../lib/auth'
import './Acceso.css'

export default function Acceso({ onLogin }: { onLogin: () => Promise<void> }) {
  const navigate = useNavigate()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const login = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    setError('')

    if (!isSupabaseConfigured) {
      setError('Configura las variables de Supabase en el archivo .env.')
      return
    }

    setLoading(true)

    const { data, error: loginError } =
      await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      })

    if (loginError || !data.user) {
      setLoading(false)
      setError(
        'No se pudo iniciar sesión. Verifica tu correo, contraseña y que hayas confirmado tu correo electrónico.',
      )
      return
    }

    // Administrador y cliente van a páginas distintas.
    let isAdmin = false
    try {
      isAdmin = await checkAdminRole(data.user.id)
    } catch (err) {
      console.error('No se pudo comprobar el rol:', err)
    }

    try {
      await onLogin()
    } catch (err) {
      console.error('No se pudo actualizar la sesión:', err)
    }

    setLoading(false)
    navigate(isAdmin ? '/admin' : '/cliente', { replace: true })
  }

  return (
    <main className="auth-page">
      <section className="auth-card">
        <div className="auth-brand">
          <span>2M.</span>
          <small>ABARROTES</small>
        </div>

        <h1>Bienvenido</h1>

        <p className="auth-description">
          Ingresa a tu cuenta para consultar y guardar tus listas de compra.
        </p>

        {error && (
          <div className="auth-message error">
            {error}
          </div>
        )}

        <form onSubmit={login} className="auth-form">
          <label>
            Correo electrónico

            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="tucorreo@email.com"
              autoComplete="email"
              required
            />
          </label>

          <label>
            Contraseña

            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="Tu contraseña"
              autoComplete="current-password"
              required
            />
          </label>

          <button
            type="submit"
            className="auth-button"
            disabled={loading}
          >
            {loading ? 'Ingresando...' : 'Iniciar sesión'}
          </button>
        </form>

        <div className="auth-links">
          <Link to="/registro">
            Crear una cuenta
          </Link>

          <Link to="/">
            Volver a la tienda
          </Link>
        </div>
      </section>
    </main>
  )
}