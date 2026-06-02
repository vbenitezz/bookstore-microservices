"""
schemas/book.py — Schemas Pydantic del Catalog Service

Pydantic cumple dos roles aquí:
  1. Validar y sanitizar los datos que entran (requests)
  2. Serializar los datos que salen (responses)

Separamos en tres grupos:
  - BookBase      → campos comunes
  - BookCreate    → para POST (crear)
  - BookUpdate    → para PUT/PATCH (actualizar, todos opcionales)
  - BookResponse  → lo que retorna la API al cliente
  - BookListResponse → respuesta paginada
"""

from __future__ import annotations
from uuid import UUID
from decimal import Decimal
from datetime import datetime
from typing import Optional, List
from pydantic import BaseModel, Field, field_validator, ConfigDict, condecimal


# =============================================================================
# CATEGORY SCHEMAS
# =============================================================================

class CategoryBase(BaseModel):
    name:        str = Field(..., min_length=1, max_length=100)
    slug:        str = Field(..., min_length=1, max_length=120,
                             pattern=r'^[a-z0-9]+(?:-[a-z0-9]+)*$')
    description: Optional[str] = None


class CategoryCreate(CategoryBase):
    pass


class CategoryResponse(CategoryBase):
    model_config = ConfigDict(from_attributes=True)

    id:         UUID
    is_active:  bool
    created_at: datetime


# =============================================================================
# BOOK SCHEMAS
# =============================================================================

class BookBase(BaseModel):
    title:        str     = Field(..., min_length=1, max_length=300,
                                  description="Título del libro")
    author:       str     = Field(..., min_length=1, max_length=200)
    isbn:         str     = Field(..., min_length=10, max_length=20,
                                  description="ISBN-10 o ISBN-13")
    description:  Optional[str]     = None
    price: condecimal(gt=0, decimal_places=2) = Field(..., description="Precio en USD, mayor que 0")
    stock:        int     = Field(..., ge=0, description="Unidades disponibles")
    cover_url:    Optional[str]     = Field(None, max_length=500)
    pages:        Optional[int]     = Field(None, gt=0)
    language:     str               = Field("Español", max_length=50)
    published_at: Optional[datetime] = None
    category_id:  Optional[UUID]    = None

    @field_validator("isbn")
    @classmethod
    def validate_isbn(cls, v: str) -> str:
        # Eliminar guiones y espacios
        clean = v.replace("-", "").replace(" ", "")
        if len(clean) not in (10, 13):
            raise ValueError("ISBN debe tener 10 o 13 dígitos")
        if not clean.isdigit() and not (len(clean) == 10 and clean[:-1].isdigit()):
            raise ValueError("ISBN contiene caracteres inválidos")
        return clean

    @field_validator("price", mode="before")
    @classmethod
    def validate_price(cls, v):
        if v is not None and float(v) <= 0:
            raise ValueError("El precio debe ser mayor que 0")
        return v


class BookCreate(BookBase):
    """Schema para crear un libro (POST /books). Todos los campos de BookBase son requeridos."""
    pass


class BookUpdate(BaseModel):
    """
    Schema para actualizar un libro (PUT /books/{id}).
    Todos los campos son opcionales — solo se actualizan los que se envíen.
    """
    title:        Optional[str]      = Field(None, min_length=1, max_length=300)
    author:       Optional[str]      = Field(None, min_length=1, max_length=200)
    description:  Optional[str]      = None
    price:        Optional[condecimal(gt=0, decimal_places=2)] = Field(None)
    stock:        Optional[int]      = Field(None, ge=0)
    cover_url:    Optional[str]      = Field(None, max_length=500)
    pages:        Optional[int]      = Field(None, gt=0)
    language:     Optional[str]      = Field(None, max_length=50)
    published_at: Optional[datetime] = None
    category_id:  Optional[UUID]     = None
    is_active:    Optional[bool]     = None


class BookResponse(BookBase):
    """
    Schema de respuesta. from_attributes=True permite crear desde un objeto ORM.
    """
    model_config = ConfigDict(from_attributes=True)

    id:          UUID
    is_active:   bool
    created_at:  datetime
    updated_at:  datetime
    category:    Optional[CategoryResponse] = None


class BookListResponse(BaseModel):
    """Respuesta paginada para GET /books."""
    items:      List[BookResponse]
    total:      int   = Field(..., description="Total de libros que coinciden con el filtro")
    page:       int   = Field(..., description="Página actual (desde 1)")
    page_size:  int   = Field(..., description="Libros por página")
    pages:      int   = Field(..., description="Total de páginas")


# =============================================================================
# SCHEMAS INTERNOS (para gRPC y operaciones internas)
# =============================================================================

class StockCheckResult(BaseModel):
    """Resultado de verificar stock de un libro."""
    book_id:       UUID
    available:     bool
    current_stock: int


class StockDeductItem(BaseModel):
    """Item para descontar stock."""
    book_id:  UUID
    quantity: int = Field(..., gt=0)


class StockDeductRequest(BaseModel):
    """Request para descontar stock de múltiples libros."""
    order_id: UUID
    items:    List[StockDeductItem]