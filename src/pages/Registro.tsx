import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase, isSupabaseConfigured } from '../lib/supabase'
import './Acceso.css'

export default function Registro({ onLogin }: { onLogin: () => Promise<void> }) {
  const navigate = useNavigate()

  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')

  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  const register = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    setError('')
    setMessage('')

    if (!name.trim()) {
      setError('Escribe tu nombre.')
      return
    }

    if (!email.trim()) {
      setError('Escribe tu correo electrónico.')
      return
    }

    if (password.length < 6) {
      setError('La contraseña debe tener al menos 6 caracteres.')
      return
    }

    if (password !== confirmPassword) {
      setError('Las contraseñas no coinciden.')
      return
    }

    if (!isSupabaseConfigured) {
      setError('Configura las variables de Supabase en el archivo .env.')
      return
    }

    setLoading(true)

    const { data, error: signUpError } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: {
        emailRedirectTo: `${window.location.origin}/cliente/verificado`,
        data: {
          name: name.trim(),
        },
      },
    })

    setLoading(false)

    if (signUpError) {
      setError(signUpError.message)
      return
    }

    if (data.session) {
      // Una cuenta nueva se dirige a la zona del cliente.
      try {
        await onLogin()
      } catch (err) {
        console.error('No se pudo actualizar la sesión:', err)
      }
      navigate('/cliente', { replace: true })
      return
    }

    setMessage(
      'Cuenta creada. Revisa tu correo electrónico y confirma tu cuenta antes de iniciar sesión.',
    )

    setPassword('')
    setConfirmPassword('')
  }

  return (
    <main className="auth-page">
      <section className="auth-card">
        <div className="auth-brand">
          <span>2M.</span>
          <small>ABARROTES</small>
        </div>

        <h1>Crear cuenta</h1>

        <p className="auth-description">
          Crea tu cuenta para guardar tus listas de compra y volver a pedir
          tus productos fácilmente.
        </p>

        {error && (
          <div className="auth-message error">
            {error}
          </div>
        )}

        {message && (
          <div className="auth-message success">
            {message}
          </div>
        )}

        <form onSubmit={register} className="auth-form">
          <label>
            Nombre

            <input
              type="text"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Tu nombre"
              autoComplete="name"
              required
            />
          </label>

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
              placeholder="Mínimo 6 caracteres"
              autoComplete="new-password"
              required
            />
          </label>

          <label>
            Repetir contraseña

            <input
              type="password"
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
              placeholder="Repite tu contraseña"
              autoComplete="new-password"
              required
            />
          </label>

          <button
            type="submit"
            className="auth-button"
            disabled={loading}
          >
            {loading ? 'Creando cuenta...' : 'Crear mi cuenta'}
          </button>
        </form>

        <p className="auth-footer">
          ¿Ya tienes una cuenta?{' '}
          <Link to="/acceso">
            Iniciar sesión
          </Link>
        </p>
      </section>
    </main>
  )
}