import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import './Auth.css'

export default function Register() {
  const [form, setForm]   = useState({ email:'', password:'', first_name:'', last_name:'' })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const { register } = useAuth()
  const navigate = useNavigate()

  const handleSubmit = async e => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      await register(form)
      navigate('/catalog')
    } catch (err) {
      setError(err.response?.data?.message || 'Error al registrarse')
    } finally {
      setLoading(false)
    }
  }

  const f = (k, v) => setForm({...form, [k]: v})

  return (
    <div className="auth-page">
      <div className="auth-card card">
        <h1 className="auth-title">Crear cuenta</h1>
        <p className="auth-sub">Únete a BookStore hoy</p>

        {error && <div className="alert alert-error">{error}</div>}

        <form onSubmit={handleSubmit} className="auth-form">
          <div className="grid-2">
            <div className="field">
              <label>Nombre</label>
              <input value={form.first_name} onChange={e=>f('first_name',e.target.value)} placeholder="Juan" required />
            </div>
            <div className="field">
              <label>Apellido</label>
              <input value={form.last_name} onChange={e=>f('last_name',e.target.value)} placeholder="Pérez" required />
            </div>
          </div>
          <div className="field">
            <label>Email</label>
            <input type="email" value={form.email} onChange={e=>f('email',e.target.value)} placeholder="tu@email.com" required />
          </div>
          <div className="field">
            <label>Contraseña</label>
            <input type="password" value={form.password} onChange={e=>f('password',e.target.value)} placeholder="Mínimo 8 caracteres" required minLength={8} />
          </div>
          <button type="submit" className="btn btn-primary" disabled={loading} style={{width:'100%',justifyContent:'center'}}>
            {loading ? 'Creando cuenta...' : 'Crear cuenta'}
          </button>
        </form>

        <p className="auth-footer">
          ¿Ya tienes cuenta? <Link to="/login">Inicia sesión</Link>
        </p>
      </div>
    </div>
  )
}