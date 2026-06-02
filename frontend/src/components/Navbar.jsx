import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import './Navbar.css'

export default function Navbar({ cartCount = 0 }) {
  const { user, logout } = useAuth()
  const navigate = useNavigate()

  const handleLogout = () => { logout(); navigate('/login') }

  return (
    <nav className="navbar">
      <div className="container navbar-inner">
        <Link to="/" className="navbar-brand">
          <span className="brand-icon">📚</span>
          <span className="brand-name">BookStore</span>
        </Link>

        <div className="navbar-links">
          <Link to="/catalog" className="nav-link">Catálogo</Link>
          <Link to="/search" className="nav-link">Búsqueda ✦</Link>
          {user?.role === 'admin' && (
            <Link to="/reports" className="nav-link">Reportes ✦</Link>
          )}
        </div>

        <div className="navbar-actions">
          {user ? (
            <>
              <Link to="/cart" className="nav-link cart-link">
                🛒 {cartCount > 0 && <span className="cart-badge">{cartCount}</span>}
              </Link>
              <Link to="/orders" className="nav-link">Mis Órdenes</Link>
              <span className="nav-user">{user.first_name}</span>
              <button onClick={handleLogout} className="btn btn-outline btn-sm">Salir</button>
            </>
          ) : (
            <>
              <Link to="/login" className="btn btn-outline btn-sm">Iniciar sesión</Link>
              <Link to="/register" className="btn btn-primary btn-sm">Registrarse</Link>
            </>
          )}
        </div>
      </div>
    </nav>
  )
}