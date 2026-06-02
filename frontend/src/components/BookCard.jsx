import './BookCard.css'

export default function BookCard({ book, onAddToCart }) {
  return (
    <div className="book-card">
      <div className="book-cover">
        {book.cover_url
          ? <img src={book.cover_url} alt={book.title} />
          : <div className="book-cover-placeholder">📖</div>
        }
        {book.stock === 0 && <span className="out-of-stock">Sin stock</span>}
      </div>
      <div className="book-info">
        <p className="book-category">{book.category_name || book.category_slug || 'General'}</p>
        <h3 className="book-title">{book.title}</h3>
        <p className="book-author">{book.author}</p>
        <div className="book-footer">
          <span className="book-price">${parseFloat(book.price).toFixed(2)}</span>
          {onAddToCart && book.stock > 0 && (
            <button
              className="btn btn-primary btn-sm"
              onClick={() => onAddToCart(book)}
            >
              + Carrito
            </button>
          )}
        </div>
      </div>
    </div>
  )
}