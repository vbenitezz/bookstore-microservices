import axios from 'axios'

// =============================================================================
// api.js — Clientes HTTP centralizados
//
// API_URL     → microservicios en EKS (auth, catalog, cart, orders)
// LAMBDA_URL  → funciones Lambda serverless (search, reports)
// =============================================================================

const API_URL    = import.meta.env.VITE_API_URL    || 'http://localhost'
const LAMBDA_URL = import.meta.env.VITE_LAMBDA_API_URL || ''

// Cliente para microservicios
const api = axios.create({ baseURL: API_URL })

// Interceptor: adjuntar JWT automáticamente
api.interceptors.request.use(config => {
  const token = localStorage.getItem('token')
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

// Cliente para Lambdas
const lambdaApi = axios.create({ baseURL: LAMBDA_URL })

// =============================================================================
// Auth Service
// =============================================================================
export const authService = {
  register: (data)  => api.post('/api/auth/register', data),
  login:    (data)  => api.post('/api/auth/login', data),
  me:       ()      => api.get('/api/auth/me'),
  logout:   ()      => api.post('/api/auth/logout'),
}

// =============================================================================
// Catalog Service
// =============================================================================
export const catalogService = {
  getBooks:     (params) => api.get('/api/catalog/books', { params }),
  getBook:      (id)     => api.get(`/api/catalog/books/${id}`),
  getCategories:()       => api.get('/api/catalog/categories'),
  createBook:   (data)   => api.post('/api/catalog/books', data, {
    headers: { 'X-User-Role': 'admin' }
  }),
}

// =============================================================================
// Cart Service
// =============================================================================
export const cartService = {
  getCart:    ()           => api.get('/api/cart/cart'),
  addItem:    (data)       => api.post('/api/cart/cart/items', data),
  updateItem: (bookId, qty)=> api.put(`/api/cart/cart/items/${bookId}`, { quantity: qty }),
  removeItem: (bookId)     => api.delete(`/api/cart/cart/items/${bookId}`),
  clearCart:  ()           => api.delete('/api/cart/cart'),
}

// =============================================================================
// Order Service
// =============================================================================
export const orderService = {
  createOrder: (data) => api.post('/api/orders/orders', data),
  getOrders:   ()     => api.get('/api/orders/orders'),
  getOrder:    (id)   => api.get(`/api/orders/orders/${id}`),
  cancelOrder: (id)   => api.delete(`/api/orders/orders/${id}`),
}

// =============================================================================
// Lambda — Serverless
// =============================================================================
export const lambdaService = {
  searchBooks:  (params) => lambdaApi.get('/search', { params }),
  orderSummary: (params) => lambdaApi.get('/reports/orders', { params }),
}