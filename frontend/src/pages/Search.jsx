import { useState } from 'react'
import BookCard from '../components/BookCard'
import { lambdaService, cartService } from '../services/api'
import { useAuth } from '../hooks/useAuth'
import './Search.css'

export default function Search() {
  const [query, setQuery]     = useState('')
  const [results, setResults] = useState([])
  const [loading, setLoading] = useState(false)
  const [searched, setSearched] = useState(false)
  const [msg, setMsg]         = useState('')
  const [filters, setFilters] = useState({ min_price: '', max_price: '' })
  const { user } = useAuth()

  const handleSearch = async e => {
    e.preventDefault()
    setLoading(true)
    setSearched(true)
    try {
      const params = { q: query }
      if (filters.min_price) params.min_price = filters.min_price
      if (filters.max_price) params.max_price = filters.max_price
      const r = await lambdaService.searchBooks(params)
      setResults(r.data.results || [])
    } catch (err) {
      setResults([])
      setMsg('Error al conectar con el servicio de búsqueda')
    } finally {
      setLoading(false)
    }
  }

  const addToCart = async book => {
    if (!user) { setMsg('Inicia sesión para agregar al carrito'); return }
    try {
      await cartService.addItem({ book_id: book.id, quantity: 1 })
      setMsg(`"${book.title}" agregado`)
      setTimeout(() => setMsg(''), 3000)
    } catch { setMsg('Error al agregar') }
  }

  return (
    <div className="search-page">
      <div className="container">
        <div className="search-hero">
          <div className="lambda-badge">⚡ Powered by AWS Lambda</div>
          <h1 className="page-title">Búsqueda Inteligente</h1>
          <p className="page-sub">Búsqueda serverless en tiempo real sobre el catálogo</p>
        </div>

        <form onSubmit={handleSearch} className="search-form">
          <div className="search-bar">
            <input
              type="text"
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Buscar por título, autor..."
              className="search-input"
            />
            <button type="submit" className="btn btn-primary" disabled={loading}>
              {loading ? '...' : '🔍 Buscar'}
            </button>
          </div>
          <div className="search-filters">
            <input
              type="number"
              placeholder="Precio mínimo"
              value={filters.min_price}
              onChange={e => setFilters({...filters, min_price: e.target.value})}
            />
            <input
              type="number"
              placeholder="Precio máximo"
              value={filters.max_price}
              onChange={e => setFilters({...filters, max_price: e.target.value})}
            />
          </div>
        </form>

        {msg && <div className="alert alert-success">{msg}</div>}

        {loading && <div className="spinner" />}

        {!loading && searched && (
          <div className="search-results">
            <p className="results-count">
              {results.length} resultado{results.length !== 1 ? 's' : ''}
              {query && ` para "${query}"`}
            </p>
            {results.length > 0 ? (
              <div className="grid-4">
                {results.map(book => (
                  <BookCard key={book.id} book={book} onAddToCart={addToCart} />
                ))}
              </div>
            ) : (
              <div className="empty-state">
                <p>No se encontraron libros con esos criterios.</p>
              </div>
            )}
          </div>
        )}

        {!searched && (
          <div className="search-hint">
            <div className="hint-card card">
              <h3>¿Cómo funciona?</h3>
              <p>Esta búsqueda utiliza <strong>AWS Lambda</strong> — una función serverless que consulta directamente la base de datos sin pasar por los microservicios. Permite búsquedas avanzadas con filtros de precio y categoría.</p>
              <div className="arch-pills">
                <span className="badge badge-gold">API Gateway</span>
                <span>→</span>
                <span className="badge badge-purple">Lambda</span>
                <span>→</span>
                <span className="badge badge-gold">RDS PostgreSQL</span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}