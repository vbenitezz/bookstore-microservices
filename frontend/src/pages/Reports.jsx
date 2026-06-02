import { useState, useEffect } from 'react'
import { lambdaService } from '../services/api'
import './Reports.css'

export default function Reports() {
  const [data, setData]     = useState(null)
  const [loading, setLoading] = useState(true)
  const [days, setDays]     = useState(30)
  const [error, setError]   = useState('')

  const loadReport = (d) => {
    setLoading(true)
    setError('')
    lambdaService.orderSummary({ days: d })
      .then(r => setData(r.data))
      .catch(err => setError(err.response?.data?.error || 'Error al cargar el reporte'))
      .finally(() => setLoading(false))
  }

  useEffect(() => { loadReport(days) }, [days])

  return (
    <div className="reports-page">
      <div className="container">
        <div className="reports-header">
          <div>
            <div className="lambda-badge">⚡ Powered by AWS Lambda</div>
            <h1 className="page-title">Reportes de Órdenes</h1>
            <p className="page-sub">Dashboard ejecutivo serverless</p>
          </div>
          <select value={days} onChange={e => setDays(Number(e.target.value))} style={{width:'180px'}}>
            <option value={7}>Últimos 7 días</option>
            <option value={30}>Últimos 30 días</option>
            <option value={90}>Últimos 90 días</option>
          </select>
        </div>

        {error && <div className="alert alert-error">{error}</div>}
        {loading && <div className="spinner" />}

        {!loading && data && (
          <>
            {/* KPIs */}
            <div className="kpi-grid">
              <div className="kpi-card card">
                <p className="kpi-label">Total Órdenes</p>
                <p className="kpi-value">{data.summary?.total_orders ?? 0}</p>
              </div>
              <div className="kpi-card card">
                <p className="kpi-label">Ingresos Totales</p>
                <p className="kpi-value">${parseFloat(data.summary?.total_revenue || 0).toFixed(2)}</p>
              </div>
              <div className="kpi-card card">
                <p className="kpi-label">Valor Promedio</p>
                <p className="kpi-value">${parseFloat(data.summary?.avg_order_value || 0).toFixed(2)}</p>
              </div>
              <div className="kpi-card card">
                <p className="kpi-label">Período</p>
                <p className="kpi-value">{days} días</p>
              </div>
            </div>

            <div className="reports-grid">
              {/* Órdenes por estado */}
              <div className="card">
                <h3 className="section-title">Por Estado</h3>
                {data.by_status?.length > 0 ? (
                  <div className="status-list">
                    {data.by_status.map(s => (
                      <div key={s.status} className="status-row">
                        <div className="status-bar-wrap">
                          <span className="status-name">{s.status}</span>
                          <div className="status-bar">
                            <div
                              className="status-fill"
                              style={{width: `${Math.min(100, (s.count / data.summary.total_orders) * 100)}%`}}
                            />
                          </div>
                        </div>
                        <div className="status-meta">
                          <span>{s.count}</span>
                          <span className="muted">${parseFloat(s.revenue).toFixed(0)}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p style={{color:'var(--muted)', fontSize:'14px'}}>Sin datos en este período</p>
                )}
              </div>

              {/* Ingresos diarios */}
              <div className="card">
                <h3 className="section-title">Últimos 7 días</h3>
                {data.daily_revenue?.length > 0 ? (
                  <div className="daily-list">
                    {data.daily_revenue.map(d => (
                      <div key={d.day} className="daily-row">
                        <span className="daily-date">{d.day}</span>
                        <span className="daily-orders">{d.orders} órdenes</span>
                        <span className="daily-revenue">${parseFloat(d.revenue).toFixed(2)}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p style={{color:'var(--muted)', fontSize:'14px'}}>Sin datos en este período</p>
                )}
              </div>
            </div>

            {/* Órdenes recientes */}
            {data.recent_orders?.length > 0 && (
              <div className="card" style={{marginTop:'24px'}}>
                <h3 className="section-title">Órdenes Recientes</h3>
                <table className="orders-table">
                  <thead>
                    <tr>
                      <th>ID</th>
                      <th>Cliente</th>
                      <th>Estado</th>
                      <th>Total</th>
                      <th>Fecha</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.recent_orders.map(o => (
                      <tr key={o.id}>
                        <td className="mono">{o.id?.slice(0,8)}...</td>
                        <td>{o.shipping_name}</td>
                        <td><span className="badge badge-gold">{o.status}</span></td>
                        <td>${parseFloat(o.total).toFixed(2)}</td>
                        <td className="muted">{o.created_at?.slice(0,10)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}