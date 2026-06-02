"""
config/database.py — Conexión async a PostgreSQL con SQLAlchemy

Usa asyncpg como driver para operaciones no bloqueantes.
El engine fuerza el schema 'catalog' en cada conexión,
garantizando que catalog_user nunca acceda a otros schemas.
"""

from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from sqlalchemy.orm import DeclarativeBase
from sqlalchemy import text, event
from src.config.settings import settings
from src.config.logger import log
import os
import ssl as ssl_lib

# Configurar SSL para RDS
ssl_context = None
if os.getenv("DB_SSL") == "true":
    ssl_context = ssl_lib.create_default_context()
    ssl_context.check_hostname = False
    ssl_context.verify_mode = ssl_lib.CERT_NONE

engine = create_async_engine(
    settings.database_url,
    echo=(settings.node_env == "development"),
    pool_size=10,
    max_overflow=20,
    pool_pre_ping=True,
    connect_args={
        "server_settings": {
            "search_path": f"{settings.db_schema},public"
        },
        # SSL para RDS en producción
        **( {"ssl": ssl_context} if ssl_context else {} )
    },
)

# Factory de sesiones async
AsyncSessionLocal = async_sessionmaker(
    bind=engine,
    class_=AsyncSession,
    expire_on_commit=False,  # Evita lazy loading tras commit
    autocommit=False,
    autoflush=False,
)


# =============================================================================
# Base para los modelos ORM
# Todos los modelos de Catalog heredan de esta clase
# =============================================================================

class Base(DeclarativeBase):
    pass


# =============================================================================
# Dependencia de FastAPI
# Uso: async def endpoint(db: AsyncSession = Depends(get_db))
# =============================================================================

async def get_db() -> AsyncSession:
    """
    Generador de sesiones para inyección de dependencias en FastAPI.
    Garantiza que la sesión se cierra aunque ocurra una excepción.
    """
    async with AsyncSessionLocal() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise
        finally:
            await session.close()


# =============================================================================
# Utilidades de ciclo de vida
# =============================================================================

async def check_connection():
    """Verifica que la conexión a la DB funciona. Usado en startup."""
    async with engine.connect() as conn:
        result = await conn.execute(text("SELECT current_schema(), current_user"))
        row = result.fetchone()
        log.info(f"[DB] Conectado — schema: {row[0]}, usuario: {row[1]}")


async def close_connection():
    """Cierra el pool de conexiones. Usado en shutdown."""
    await engine.dispose()
    log.info("[DB] Pool de conexiones cerrado")