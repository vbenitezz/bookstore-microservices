"""
models/book.py — Modelos ORM del Catalog Service

Define las tablas del schema 'catalog':
  - categories  → categorías de libros
  - books       → catálogo principal
  - book_authors → autores (relación muchos a muchos con books)

Nota sobre __table_args__:
  schema=settings.db_schema fuerza que SQLAlchemy cree y consulte
  las tablas dentro del schema 'catalog', no en 'public'.
"""

import uuid
from datetime import datetime, timezone
from sqlalchemy import (
    Column, String, Text, Numeric, Integer,
    Boolean, DateTime, ForeignKey, Index,
    CheckConstraint, UniqueConstraint
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from src.config.database import Base
from src.config.settings import settings

SCHEMA = settings.db_schema


class Category(Base):
    __tablename__ = "categories"
    __table_args__ = (
        UniqueConstraint("slug", name="uq_categories_slug"),
        {"schema": SCHEMA},
    )

    id          = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name        = Column(String(100), nullable=False)
    slug        = Column(String(120), nullable=False)  # ej: "ciencia-ficcion"
    description = Column(Text, nullable=True)
    is_active   = Column(Boolean, nullable=False, default=True)
    created_at  = Column(DateTime(timezone=True), nullable=False, default=lambda: datetime.now(timezone.utc))

    # Relación: una categoría tiene muchos libros
    books = relationship("Book", back_populates="category", lazy="select")

    def __repr__(self):
        return f"<Category {self.name}>"


class Book(Base):
    __tablename__ = "books"
    __table_args__ = (
        UniqueConstraint("isbn", name="uq_books_isbn"),
        CheckConstraint("price > 0", name="ck_books_price_positive"),
        CheckConstraint("stock >= 0", name="ck_books_stock_non_negative"),
        # Índice para búsqueda de texto en título y autor
        Index("idx_books_title_trgm", "title", postgresql_using="gin",
              postgresql_ops={"title": "gin_trgm_ops"}),
        {"schema": SCHEMA},
    )

    id           = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    title        = Column(String(300), nullable=False)
    author       = Column(String(200), nullable=False)
    isbn         = Column(String(20),  nullable=False)
    description  = Column(Text,        nullable=True)
    price        = Column(Numeric(10, 2), nullable=False)
    stock        = Column(Integer,     nullable=False, default=0)
    cover_url    = Column(String(500), nullable=True)
    pages        = Column(Integer,     nullable=True)
    language     = Column(String(50),  nullable=False, default="Español")
    published_at = Column(DateTime(timezone=True), nullable=True)
    is_active    = Column(Boolean,     nullable=False, default=True)
    created_at   = Column(DateTime(timezone=True), nullable=False, default=lambda: datetime.now(timezone.utc))
    updated_at   = Column(DateTime(timezone=True), nullable=False, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))

    # Clave foránea a categories (mismo schema)
    category_id  = Column(
        UUID(as_uuid=True),
        ForeignKey(f"{SCHEMA}.categories.id", ondelete="SET NULL"),
        nullable=True
    )

    # Relación: un libro pertenece a una categoría
    category = relationship("Category", back_populates="books")

    def __repr__(self):
        return f"<Book {self.title} by {self.author}>"