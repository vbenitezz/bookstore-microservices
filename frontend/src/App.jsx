import { Routes, Route, Navigate } from 'react-router-dom'
import { useState, useEffect } from 'react'
import Navbar from './components/Navbar'
import Login    from './pages/Login'
import Register from './pages/Register'
import Catalog  from './pages/Catalog'
import Search   from './pages/Search'
import Cart     from './pages/Cart'
import Orders   from './pages/Orders'
import Reports  from './pages/Reports'
import { cartService } from './services/api'
import { useAuth } from './hooks/useAuth'

export default function App() {
  const [cartCount, setCartCount] = useState(0)
  const { user } = useAuth()

  useEffect(() => {
    if (!user) { setCartCount(0); return }
    cartService.getCart()
      .then(r => {
        const items = r.data?.items || []
        setCartCount(items.reduce((s, i) => s + i.quantity, 0))
      })
      .catch(() => setCartCount(0))
  }, [user])

  return (
    <>
      <Navbar cartCount={cartCount} />
      <Routes>
        <Route path="/"         element={<Navigate to="/catalog" replace />} />
        <Route path="/login"    element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/catalog"  element={<Catalog />} />
        <Route path="/search"   element={<Search />} />
        <Route path="/cart"     element={<Cart />} />
        <Route path="/orders"   element={<Orders />} />
        <Route path="/reports"  element={<Reports />} />
        <Route path="*"         element={<Navigate to="/catalog" replace />} />
      </Routes>
    </>
  )
}