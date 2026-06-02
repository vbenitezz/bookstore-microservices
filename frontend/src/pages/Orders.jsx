import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { orderService } from '../services/api'
import { useAuth } from '../hooks/useAuth'
import './Orders.css'

const STATUS_LABELS = {
  pending:    { label: 'Pendiente',  class: 'badge-gold' },
  confirmed:  { label: 'Confirmada', class: 'badge-purple' },
  processing: { label: 'Procesando', class: 'badge-purple' },
  shipped:    { label: 'Enviada',    class: 'badge-gold' },
  delivered:  { label: 'Entregada',  class: 'badge-success' },
  cancelled:  { label: 'Cancelada',  class: 'badge-danger' },
}

export default function Orders() {
  const [orders, setOrders] = useState([])
  const [loading, setLoading] = useState(true)
  const { user } = useAuth()

  useEffect(() => {
    if (!user) return
    orderService.getOrders()
      .then(r => setOrders(r.data.orders || r.data || []))
      .catch(() => setOrders([]))
      .finally(() => setLoading(false))
  }, [user])

  if (!user) return (
    <div className="container" style={{padding:'80px 0', textAlign:'center'}}>
      <p style={{color:'var(--muted)', marginBottom:'16px'}}>Inicia sesión para ver tus órdenes</p>
      <Link to="/login" className="btn btn-primary">Iniciar sesión</Link>
    </div>
  )

  if (loading) return <div className="spinner" />

  return (
    <div className="orders-page">
      <div className="container">
        <h1 className="page-title">Mis Órdenes</h1>

        {orders.length === 0 ? (
          <div style={{textAlign:'center', padding:'80px 0', color:'var(--muted)'}}>
            <p>No tienes órdenes todavía.</p>
            <Link to="/catalog" className="btn btn-primary" style={{marginTop:'16px'}}>
              Explorar catálogo
            </Link>
          </div>
        ) : (
          <div className="orders-list">
            {orders.map(order => {
              const status = STATUS_LABELS[order.status] || { label: order.status, class: 'badge-gold' }
              return (
                <div key={order.id} className="order-card card">
                  <div className="order-header">
                    <div>
                      <p className="order-id">Orden #{order.id?.slice(0,8)}...</p>
                      <p className="order-date">{new Date(order.created_at).toLocaleDateString('es-CO', { year:'numeric', month:'long', day:'numeric' })}</p>
                    </div>
                    <div style={{textAlign:'right'}}>
                      <span className={`badge ${status.class}`}>{status.label}</span>
                      <p className="order-total">${parseFloat(order.total).toFixed(2)}</p>
                    </div>
                  </div>
                  {order.items && order.items.length > 0 && (
                    <div className="order-items">
                      {order.items.map((item, i) => (
                        <div key={i} className="order-item">
                          <span>{item.title}</span>
                          <span>x{item.quantity}</span>
                          <span>${parseFloat(item.unit_price || item.price).toFixed(2)}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}