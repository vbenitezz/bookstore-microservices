"""
routers/books.py — Endpoints REST del Catalog Service

Rutas:
  GET    /books          → listar libros con filtros y paginación
  GET    /books/{id}     → detalle de un libro
  POST   /books          → crear libro (solo admin, validado por token en gateway)
  PUT    /books/{id}     → actualizar libro (solo admin)
  DELETE /books/{id}     → desactivar libro, no eliminar (soft delete)

Nota sobre autenticación:
  Este servicio NO valida JWTs directamente. El API Gateway (Nginx) ya
  verificó el token antes de que el request llegue aquí.
  Para rutas de admin, el gateway adjunta el header X-User-Role.
  En Fase 4 (observabilidad) añadiremos validación gRPC contra Auth Service.
"""

from uuid import UUID
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status, Request
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, or_, update, and_
from sqlalchemy.orm import selectinload
from datetime import datetime, timezone

from src.config.database import get_db
from src.config.logger import log
from src.models.book import Book, Category
from src.schemas.book import (
    BookCreate, BookUpdate, BookResponse, BookListResponse
)

router = APIRouter(prefix="/books", tags=["books"])


# =============================================================================
# GET /books — Listar con filtros y paginación
# =============================================================================

@router.get("", response_model=BookListResponse)
async def list_books(
    # Filtros opcionales
    q:           Optional[str]  = Query(None, description="Búsqueda en título y autor"),
    category_id: Optional[UUID] = Query(None, description="Filtrar por categoría"),
    min_price:   Optional[float]= Query(None, ge=0, description="Precio mínimo"),
    max_price:   Optional[float]= Query(None, ge=0, description="Precio máximo"),
    in_stock:    Optional[bool] = Query(None, description="Solo libros con stock > 0"),
    language:    Optional[str]  = Query(None, description="Filtrar por idioma"),
    # Paginación
    page:      int = Query(1,  ge=1,   description="Página (desde 1)"),
    page_size: int = Query(20, ge=1, le=100, description="Libros por página"),
    # Ordenamiento
    order_by: str = Query("created_at", description="Campo de ordenamiento"),
    order:    str = Query("desc", pattern="^(asc|desc)$"),
    # DB
    db: AsyncSession = Depends(get_db),
):
    # Construir query base (solo libros activos)
    query = select(Book).where(Book.is_active == True)

    # Aplicar filtros dinámicamente
    if q:
        # Búsqueda de texto en título y autor (usando ILIKE para case-insensitive)
        search_term = f"%{q}%"
        query = query.where(
            or_(
                Book.title.ilike(search_term),
                Book.author.ilike(search_term),
            )
        )

    if category_id:
        query = query.where(Book.category_id == category_id)

    if min_price is not None:
        query = query.where(Book.price >= min_price)

    if max_price is not None:
        query = query.where(Book.price <= max_price)

    if in_stock is True:
        query = query.where(Book.stock > 0)

    if language:
        query = query.where(Book.language.ilike(f"%{language}%"))

    # Contar total antes de paginar
    count_query = select(func.count()).select_from(query.subquery())
    total = await db.scalar(count_query)

    # Ordenamiento
    allowed_order_fields = {"title", "price", "created_at", "author", "stock"}
    if order_by not in allowed_order_fields:
        order_by = "created_at"

    order_column = getattr(Book, order_by)
    if order == "desc":
        order_column = order_column.desc()

    # Paginación
    offset = (page - 1) * page_size
    query = (
        query
        .options(selectinload(Book.category))  # Eager load de categoría
        .order_by(order_column)
        .offset(offset)
        .limit(page_size)
    )

    result = await db.execute(query)
    books  = result.scalars().all()

    pages = (total + page_size - 1) // page_size if total > 0 else 0

    return BookListResponse(
        items=books,
        total=total,
        page=page,
        page_size=page_size,
        pages=pages,
    )


# =============================================================================
# GET /books/{id} — Detalle de un libro
# =============================================================================

@router.get("/{book_id}", response_model=BookResponse)
async def get_book(
    book_id: UUID,
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Book)
        .options(selectinload(Book.category))
        .where(and_(Book.id == book_id, Book.is_active == True))
    )
    book = result.scalar_one_or_none()

    if not book:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"error": "book_not_found", "message": "Libro no encontrado"},
        )

    return book


# =============================================================================
# POST /books — Crear libro
# =============================================================================

@router.post("", response_model=BookResponse, status_code=status.HTTP_201_CREATED)
async def create_book(
    payload: BookCreate,
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    # Verificar rol de admin (el gateway adjunta X-User-Role)
    user_role = request.headers.get("x-user-role", "")
    if user_role != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail={"error": "forbidden", "message": "Solo administradores pueden crear libros"},
        )

    # Verificar ISBN duplicado
    existing = await db.execute(
        select(Book).where(Book.isbn == payload.isbn)
    )
    if existing.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail={"error": "isbn_taken", "message": f"Ya existe un libro con ISBN {payload.isbn}"},
        )

    # Verificar que la categoría existe (si se proporcionó)
    if payload.category_id:
        cat = await db.execute(
            select(Category).where(Category.id == payload.category_id)
        )
        if not cat.scalar_one_or_none():
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail={"error": "category_not_found", "message": "Categoría no encontrada"},
            )

    book = Book(**payload.model_dump())
    db.add(book)
    await db.flush()   # Para obtener el ID antes del commit

    # Recargar con relaciones
    await db.refresh(book, ["category"])

    log.info(f"[CATALOG] Libro creado: {book.id} — {book.title}")
    return book


# =============================================================================
# PUT /books/{id} — Actualizar libro
# =============================================================================

@router.put("/{book_id}", response_model=BookResponse)
async def update_book(
    book_id: UUID,
    payload: BookUpdate,
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    user_role = request.headers.get("x-user-role", "")
    if user_role != "admin":
        raise HTTPException(status_code=403, detail={"error": "forbidden"})

    result = await db.execute(select(Book).where(Book.id == book_id))
    book   = result.scalar_one_or_none()

    if not book:
        raise HTTPException(status_code=404, detail={"error": "book_not_found"})

    # Actualizar solo los campos enviados (excluir None)
    update_data = payload.model_dump(exclude_none=True)
    update_data["updated_at"] = datetime.now(timezone.utc)

    for field, value in update_data.items():
        setattr(book, field, value)

    await db.flush()
    await db.refresh(book, ["category"])

    log.info(f"[CATALOG] Libro actualizado: {book_id}")
    return book


# =============================================================================
# DELETE /books/{id} — Soft delete (desactivar)
# =============================================================================

@router.delete("/{book_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_book(
    book_id: UUID,
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    user_role = request.headers.get("x-user-role", "")
    if user_role != "admin":
        raise HTTPException(status_code=403, detail={"error": "forbidden"})

    result = await db.execute(select(Book).where(Book.id == book_id))
    book   = result.scalar_one_or_none()

    if not book:
        raise HTTPException(status_code=404, detail={"error": "book_not_found"})

    # Soft delete: no eliminar de la DB, solo desactivar
    book.is_active  = False
    book.updated_at = datetime.now(timezone.utc)

    log.info(f"[CATALOG] Libro desactivado: {book_id}")