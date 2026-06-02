import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { cartService, orderService } from '../services/api'
import { useAuth } from '../hooks/useAuth'
import './Cart.css'

export default function Cart() {
  const [cart, setCart]     = useState(null)
  const [loading, setLoading] = useState(true)
  const [ordering, setOrdering] = useState(false)
  const [msg, setMsg]       = useState('')
  const { user } = useAuth()
  const navigate = useNavigate()

  const loadCart = () => {
    cartService.getCart()
      .then(r => setCart(r.data))
      .catch(() => setCart({ items: [], total: 0 }))
      .finally(() => setLoading(false))
  }

  useEffect(() => { if (user) loadCart() }, [user])

  const updateQty = async (bookId, qty) => {
    if (qty < 1) return removeItem(bookId)
    await cartService.updateItem(bookId, qty)
    loadCart()
  }

  const removeItem = async bookId => {
    await cartService.removeItem(bookId)
    loadCart()
  }

  const placeOrder = async () => {
    setOrdering(true)
    try {
      await orderService.createOrder({
        shipping_name:    `${user.first_name} ${user.last_name}`,
        shipping_email:   user.email,
        shipping_address: 'Dirección de envío',
        shipping_city:    'Ciudad',
        shipping_country: 'Colombia',
      })
      await cartService.clearCart()
      navigate('/orders')
    } catch (err) {
      setMsg(err.response?.data?.message || 'Error al crear la orden')
    } finally {
      setOrdering(false)
    }
  }

  if (!user) return (
    <div className="container" style={{padding:'80px 0', textAlign:'center'}}>
      <p style={{color:'var(--muted)', marginBottom:'16px'}}>Inicia sesión para ver tu carrito</p>
      <Link to="/login" className="btn btn-primary">Iniciar sesión</Link>
    </div>
  )

  if (loading) return <div className="spinner" />

  const items = cart?.items || []
  const total = cart?.total || items.reduce((s, i) => s + i.price * i.quantity, 0)

  return (
    <div className="cart-page">
      <div className="container">
        <h1 className="page-title">Mi Carrito</h1>

        {msg && <div className="alert alert-error">{msg}</div>}

        {items.length === 0 ? (
          <div className="empty-cart">
            <p>🛒 Tu carrito está vacío</p>
            <Link to="/catalog" className="btn btn-primary" style={{marginTop:'16px'}}>
              Explorar catálogo
            </Link>
          </div>
        ) : (
          <div className="cart-layout">
            <div className="cart-items">
              {items.map(item => (
                <div key={item.book_id} className="cart-item card">
                  <div className="item-info">
                    <p className="item-title">{item.title}</p>
                    <p className="item-author">{item.author}</p>
                  </div>
                  <div className="item-controls">
                    <div className="qty-ctrl">
                      <button onClick={() => updateQty(item.book_id, item.quantity - 1)}>−</button>
                      <span>{item.quantity}</span>
                      <button onClick={() => updateQty(item.book_id, item.quantity + 1)}>+</button>
                    </div>
                    <span className="item-price">${(item.price * item.quantity).toFixed(2)}</span>
                    <button className="btn btn-danger btn-sm" onClick={() => removeItem(item.book_id)}>✕</button>
                  </div>
                </div>
              ))}
            </div>

            <div className="cart-summary card">
              <h3>Resumen</h3>
              <div className="summary-row">
                <span>Subtotal ({items.length} items)</span>
                <span>${parseFloat(total).toFixed(2)}</span>
              </div>
              <div className="summary-row summary-total">
                <span>Total</span>
                <span>${parseFloat(total).toFixed(2)}</span>
              </div>
              <button
                className="btn btn-primary"
                onClick={placeOrder}
                disabled={ordering}
                style={{width:'100%', justifyContent:'center', marginTop:'16px'}}
              >
                {ordering ? 'Procesando...' : 'Confirmar orden'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}