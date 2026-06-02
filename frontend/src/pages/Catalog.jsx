import { useState, useEffect } from 'react'
import BookCard from '../components/BookCard'
import { catalogService, cartService } from '../services/api'
import { useAuth } from '../hooks/useAuth'
import './Catalog.css'

export default function Catalog() {
  const [books, setBooks]         = useState([])
  const [categories, setCategories] = useState([])
  const [category, setCategory]   = useState('')
  const [loading, setLoading]     = useState(true)
  const [msg, setMsg]             = useState('')
  const { user } = useAuth()

  useEffect(() => {
    catalogService.getCategories()
      .then(r => setCategories(r.data.categories || r.data || []))
      .catch(() => {})
  }, [])

  useEffect(() => {
    setLoading(true)
    catalogService.getBooks(category ? { category } : {})
      .then(r => setBooks(r.data.books || r.data || []))
      .catch(() => setBooks([]))
      .finally(() => setLoading(false))
  }, [category])

  const addToCart = async book => {
    if (!user) { setMsg('Inicia sesión para agregar al carrito'); return }
    try {
      await cartService.addItem({ book_id: book.id, quantity: 1 })
      setMsg(`"${book.title}" agregado al carrito`)
      setTimeout(() => setMsg(''), 3000)
    } catch {
      setMsg('Error al agregar al carrito')
    }
  }

  return (
    <div className="catalog-page">
      <div className="container">
        <div className="catalog-header">
          <div>
            <h1 className="page-title">Catálogo</h1>
            <p className="page-sub">{books.length} libros disponibles</p>
          </div>
          <div className="catalog-filters">
            <select value={category} onChange={e => setCategory(e.target.value)}>
              <option value="">Todas las categorías</option>
              {categories.map(c => (
                <option key={c.id} value={c.slug}>{c.name}</option>
              ))}
            </select>
          </div>
        </div>

        {msg && <div className="alert alert-success">{msg}</div>}

        {loading ? (
          <div className="spinner" />
        ) : books.length === 0 ? (
          <div className="empty-state">
            <p>No hay libros disponibles en este momento.</p>
          </div>
        ) : (
          <div className="grid-4">
            {books.map(book => (
              <BookCard key={book.id} book={book} onAddToCart={addToCart} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}