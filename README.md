# BookStore — Microservices Architecture

Aplicación de e-commerce de libros construida con arquitectura de microservicios.

## Stack tecnológico

| Servicio        | Lenguaje       | Puerto REST | Puerto gRPC |
|-----------------|----------------|-------------|-------------|
| Auth Service    | Node.js        | 3001        | 50051       |
| Catalog Service | Python/FastAPI | 3002        | 50052       |
| Cart Service    | Node.js        | 3003        | 50053       |
| Order Service   | Node.js        | 3004        | 50054       |
| Payment Service | Node.js        | 3005        | —           |
| Email Service   | Node.js        | 3006        | —           |
| API Gateway     | Nginx          | 80          | —           |
| Frontend        | React/Vite     | 5173        | —           |

## Infraestructura local

- **PostgreSQL** — una instancia, 4 schemas aislados (`auth`, `catalog`, `orders`, `payments`)
- **Redis** — sesiones y carrito (Cart Service)
- **RabbitMQ** — mensajería asíncrona (Order → Payment → Email)

## Inicio rápido

### Prerrequisitos
- Docker Desktop >= 24.x
- Node.js >= 20.x (para desarrollo local sin Docker)
- Python >= 3.11 (para Catalog Service)

### Levantar el entorno completo

```bash
# 1. Copiar variables de entorno
cp .env.example .env

# 2. Levantar todos los servicios
docker-compose up --build

# 3. Verificar que todos los servicios están saludables
docker-compose ps
```

### Health checks

```bash
curl http://localhost/health           # API Gateway
curl http://localhost/api/auth/health  # Auth Service
curl http://localhost/api/catalog/health # Catalog Service
```

## Estructura del proyecto

```
bookstore/
├── frontend/                  # React + Vite
├── services/
│   ├── api-gateway/           # Nginx
│   ├── auth-service/          # Node.js + Express + gRPC server
│   ├── catalog-service/       # Python + FastAPI + gRPC server
│   ├── cart-service/          # Node.js + Express + gRPC client
│   ├── order-service/         # Node.js + Express + gRPC client
│   ├── payment-service/       # Node.js + Express
│   └── email-service/         # Node.js (consumer RabbitMQ)
├── proto/                     # Contratos gRPC compartidos (.proto)
├── infrastructure/
│   ├── docker/                # Dockerfiles
│   ├── k8s/                   # Manifiestos Kubernetes (EKS)
│   └── terraform/             # IaC AWS
├── docker-compose.yml
└── .env.example
```

## Comunicación entre servicios

- **REST/HTTPS** — Frontend → API Gateway → Servicios (comunicación externa)
- **gRPC** — Comunicación síncrona interna entre servicios
- **RabbitMQ Events** — Comunicación asíncrona (Order → Payment → Email)

## Patrones aplicados

- **Schema-per-Service** — Un schema PostgreSQL por servicio, usuario DB con permisos limitados
- **Database per Service (lógico)** — Ningún servicio accede al schema de otro
- **API Gateway** — Punto de entrada único, enruta al servicio correcto
- **Event-Driven** — Desacoplamiento via mensajes para flujos no síncronos














# BookStore

## postgres
bookstore-postgres
1. Entrar al contenedor PostgreSQL
```
docker exec -it bookstore-postgres bash
```
2. Abrir psql como administrador
```
psql -U bookstore_admin -d bookstore_main
```
3. Ver todas las bases de datos
```
\l
```
Una sola base de datos `bookstore_main` con los 4 schemas adentro. Patrón Schema-per-Service

4. Ver todos los schemas
```
\dn
```
Los 4 schemas aislados creados por postgres-init.sh
* auth → para Auth Service
* catalog → para Catalog Service
* orders → para Order Service
* payments → para Payment Service
5. Conectarte a una base específica
```
\c bookstore_main
```
6. Ver todas las tablas del schema
```
\dt catalog.*
```
Las 3 tablas del Catalog Service:
* categories → categorías de libros
* books → catálogo de libros
* alembic_version → registro de migraciones aplicadas

## auth-service
Dos tablas dentro del schema:
* refresh_tokens
* users


## catalog-service
bookstore-catalog    
Python, FastAPI    
1. Documentación
```
http://localhost:3002/docs
```
2. Health check
```
curl http://localhost:3002/health
{"status": "ok", "service": "catalog-service", "grpc_port": 50052}
```
3. Crear una categoría    
Requiere admin
```
curl -X POST http://localhost:3002/categories \
  -H "Content-Type: application/json" \
  -H "X-User-Role: admin" \
  -d '{
    "name": "Tecnología",
    "slug": "tecnologia",
    "description": "Libros de programación e innovación"
  }'
```
4. Listar categorías
```
curl http://localhost:3002/categories
```
5. Crear un libro    
Requiere admin
```
curl -X POST http://localhost:3002/books \
  -H "Content-Type: application/json" \
  -H "X-User-Role: admin" \
  -d '{
    "title": "Clean Code",
    "author": "Robert C. Martin",
    "isbn": "9780132350884",
    "description": "Un libro esencial sobre buenas prácticas de programación",
    "price": 29.99,
    "stock": 50,
    "language": "Inglés",
    "pages": 464
  }'
```
6. Listar libros con paginación
```
curl "http://localhost:3002/books?page=1&page_size=10"
```
7. Buscar por texto
```
curl "http://localhost:3002/books?q=clean"
```
8. Filtrar por precio
```
curl "http://localhost:3002/books?min_price=10&max_price=50"
```
9. Filtrar solo libros con stock
```
curl "http://localhost:3002/books?in_stock=true"
```
10. Varios filtros combinados
```
curl "http://localhost:3002/books?q=robert&in_stock=true&order_by=price&order=asc"
```
11. Obtener un libro por ID (reemplaza el UUID)
```
curl http://localhost:3002/books/550e8400-e29b-41d4-a716-446655440000
```
12. Actualizar un libro    
Requiere admin
```
curl -X PUT http://localhost:3002/books/550e8400-e29b-41d4-a716-446655440000 \
  -H "Content-Type: application/json" \
  -H "X-User-Role: admin" \
  -d '{
    "price": 24.99,
    "stock": 100
  }'
```
13. Desactivar un libro    
Requiere admin    
**Soft delete:** Retorna 204 No Content. El libro no se elimina de la DB, solo is_active pasa a false.
```
curl -X DELETE http://localhost:3002/books/550e8400-e29b-41d4-a716-446655440000 \
  -H "X-User-Role: admin"
```

## cart-service
Este servicio es diferente a los anteriores en tres aspectos
* Usa Redis en lugar de PostgreSQL.
* Actúa como cliente gRPC (no servidor).
* Valida token y stock llamando a Auth y Catalog antes de cualquier operación.
