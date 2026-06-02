"""
Migración inicial — Crear tablas categories y books en schema catalog

Revision ID: 001_initial
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = '001_initial'
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Crear extensiones necesarias (si no existen)
    op.execute("CREATE EXTENSION IF NOT EXISTS \"uuid-ossp\"")
    op.execute("CREATE EXTENSION IF NOT EXISTS pg_trgm")

    # --- Tabla categories ---
    op.create_table(
        'categories',
        sa.Column('id',          postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text('uuid_generate_v4()')),
        sa.Column('name',        sa.String(100),  nullable=False),
        sa.Column('slug',        sa.String(120),  nullable=False),
        sa.Column('description', sa.Text(),        nullable=True),
        sa.Column('is_active',   sa.Boolean(),    nullable=False, server_default='true'),
        sa.Column('created_at',  sa.DateTime(timezone=True), nullable=False, server_default=sa.text('NOW()')),
        sa.UniqueConstraint('slug', name='uq_categories_slug'),
        schema='catalog',
    )

    # --- Tabla books ---
    op.create_table(
        'books',
        sa.Column('id',           postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text('uuid_generate_v4()')),
        sa.Column('title',        sa.String(300),  nullable=False),
        sa.Column('author',       sa.String(200),  nullable=False),
        sa.Column('isbn',         sa.String(20),   nullable=False),
        sa.Column('description',  sa.Text(),        nullable=True),
        sa.Column('price',        sa.Numeric(10, 2), nullable=False),
        sa.Column('stock',        sa.Integer(),    nullable=False, server_default='0'),
        sa.Column('cover_url',    sa.String(500),  nullable=True),
        sa.Column('pages',        sa.Integer(),    nullable=True),
        sa.Column('language',     sa.String(50),   nullable=False, server_default="'Español'"),
        sa.Column('published_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('is_active',    sa.Boolean(),    nullable=False, server_default='true'),
        sa.Column('created_at',   sa.DateTime(timezone=True), nullable=False, server_default=sa.text('NOW()')),
        sa.Column('updated_at',   sa.DateTime(timezone=True), nullable=False, server_default=sa.text('NOW()')),
        sa.Column('category_id',  postgresql.UUID(as_uuid=True),
                  sa.ForeignKey('catalog.categories.id', ondelete='SET NULL'), nullable=True),
        sa.UniqueConstraint('isbn', name='uq_books_isbn'),
        sa.CheckConstraint('price > 0', name='ck_books_price_positive'),
        sa.CheckConstraint('stock >= 0', name='ck_books_stock_non_negative'),
        schema='catalog',
    )

    # --- Índices ---
    op.create_index('idx_books_category', 'books', ['category_id'], schema='catalog')
    op.create_index('idx_books_is_active', 'books', ['is_active'], schema='catalog')
    op.create_index('idx_books_price', 'books', ['price'], schema='catalog')

    # Índice GIN para búsqueda de texto (requiere pg_trgm)
    op.execute("""
        CREATE INDEX idx_books_title_trgm
        ON catalog.books USING GIN (title gin_trgm_ops)
    """)

    # Datos iniciales de categorías
    op.execute("""
        INSERT INTO catalog.categories (name, slug, description) VALUES
        ('Ficción',           'ficcion',           'Novelas y cuentos de ficción'),
        ('Ciencia Ficción',   'ciencia-ficcion',   'Exploración del futuro y la tecnología'),
        ('Historia',          'historia',           'Libros históricos y biográficos'),
        ('Tecnología',        'tecnologia',         'Programación, ciencia de datos e innovación'),
        ('Desarrollo Personal','desarrollo-personal','Libros de crecimiento y productividad'),
        ('Infantil',          'infantil',           'Libros para niños y jóvenes')
    """)


def downgrade() -> None:
    op.drop_table('books',      schema='catalog')
    op.drop_table('categories', schema='catalog')