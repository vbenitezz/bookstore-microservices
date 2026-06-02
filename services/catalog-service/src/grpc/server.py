"""
grpc/server.py — Servidor gRPC del Catalog Service

Implementa los métodos definidos en /proto/catalog.proto:
  - GetBook      → retorna datos de un libro por su ID
  - CheckStock   → verifica si hay stock suficiente
  - DeductStock  → descuenta unidades del stock (al crear orden)
  - RestoreStock → restaura stock si el pago falla (compensación)

Este servidor corre en un hilo separado junto con FastAPI.
Puerto: 50052 (nunca expuesto al exterior, solo en la red Docker interna)
"""

import grpc
import asyncio
from concurrent import futures
from uuid import UUID
from sqlalchemy import select, update, and_
from sqlalchemy.orm import Session

# Estos imports usan los archivos generados por compile_proto.py
# Si aún no existen, ejecuta: python src/grpc/compile_proto.py

# from src.grpc.grpc_generated import catalog_pb2
# from src.grpc.grpc_generated import catalog_pb2_grpc

import sys, os
sys.path.insert(0, os.path.dirname(__file__))
import catalog_pb2
import catalog_pb2_grpc

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from src.config.settings import settings
from src.config.logger import log
from src.models.book import Book


# =============================================================================
# Sesión sync para gRPC
# gRPC usa hilos (ThreadPoolExecutor), no asyncio, por eso necesitamos
# una sesión síncrona de SQLAlchemy, diferente a la async que usa FastAPI.
# =============================================================================

sync_engine = create_engine(
    settings.database_url_sync,
    pool_size=5,
    max_overflow=10,
    connect_args={"options": f"-c search_path={settings.db_schema},public"},
)

SyncSession = sessionmaker(bind=sync_engine, autocommit=False, autoflush=False)


def get_sync_db():
    """Contexto de sesión sync para usar en handlers gRPC."""
    session = SyncSession()
    try:
        yield session
        session.commit()
    except Exception:
        session.rollback()
        raise
    finally:
        session.close()


# =============================================================================
# Implementación de los handlers gRPC
# =============================================================================

class CatalogServicer(catalog_pb2_grpc.CatalogServiceServicer):

    def GetBook(self, request, context):
        """Retorna datos de un libro por su ID."""
        with SyncSession() as db:
            try:
                book = db.execute(
                    select(Book).where(
                        and_(Book.id == UUID(request.book_id), Book.is_active == True)
                    )
                ).scalar_one_or_none()

                if not book:
                    return catalog_pb2.GetBookResponse(
                        found=False,
                        error=f"Libro {request.book_id} no encontrado",
                    )

                return catalog_pb2.GetBookResponse(
                    found=True,
                    book_id=str(book.id),
                    title=book.title,
                    author=book.author,
                    isbn=book.isbn,
                    price=float(book.price),
                    stock=book.stock,
                    cover_url=book.cover_url or "",
                )

            except Exception as e:
                log.error(f"[gRPC] GetBook error: {e}")
                context.set_code(grpc.StatusCode.INTERNAL)
                context.set_details("Error interno al obtener libro")
                return catalog_pb2.GetBookResponse(found=False, error=str(e))

    def CheckStock(self, request, context):
        """Verifica si hay stock suficiente para una cantidad dada."""
        with SyncSession() as db:
            try:
                book = db.execute(
                    select(Book.id, Book.stock).where(
                        and_(Book.id == UUID(request.book_id), Book.is_active == True)
                    )
                ).first()

                if not book:
                    return catalog_pb2.CheckStockResponse(
                        available=False,
                        current_stock=0,
                        book_id=request.book_id,
                        error="Libro no encontrado",
                    )

                available = book.stock >= request.quantity

                return catalog_pb2.CheckStockResponse(
                    available=available,
                    current_stock=book.stock,
                    book_id=request.book_id,
                )

            except Exception as e:
                log.error(f"[gRPC] CheckStock error: {e}")
                context.set_code(grpc.StatusCode.INTERNAL)
                return catalog_pb2.CheckStockResponse(available=False, error=str(e))

    def DeductStock(self, request, context):
        """
        Descuenta stock al confirmar una orden.
        Usa el order_id para idempotencia: si ya se procesó esta orden,
        no descuenta de nuevo. (La tabla de órdenes procesadas se implementa
        en Fase 2 con las migraciones completas.)
        """
        with SyncSession() as db:
            try:
                for item in request.items:
                    book = db.execute(
                        select(Book).where(
                            and_(Book.id == UUID(item.book_id), Book.is_active == True)
                        )
                    ).scalar_one_or_none()

                    if not book:
                        db.rollback()
                        return catalog_pb2.DeductStockResponse(
                            success=False,
                            error=f"Libro {item.book_id} no encontrado",
                        )

                    if book.stock < item.quantity:
                        db.rollback()
                        return catalog_pb2.DeductStockResponse(
                            success=False,
                            error=f"Stock insuficiente para libro {item.book_id}. Disponible: {book.stock}, solicitado: {item.quantity}",
                        )

                    book.stock -= item.quantity

                db.commit()
                log.info(f"[gRPC] Stock descontado para orden {request.order_id}")
                return catalog_pb2.DeductStockResponse(success=True)

            except Exception as e:
                db.rollback()
                log.error(f"[gRPC] DeductStock error: {e}")
                context.set_code(grpc.StatusCode.INTERNAL)
                return catalog_pb2.DeductStockResponse(success=False, error=str(e))

    def RestoreStock(self, request, context):
        """Restaura stock si el pago falla (patrón de compensación Saga)."""
        with SyncSession() as db:
            try:
                for item in request.items:
                    book = db.execute(
                        select(Book).where(Book.id == UUID(item.book_id))
                    ).scalar_one_or_none()

                    if book:
                        book.stock += item.quantity

                db.commit()
                log.info(f"[gRPC] Stock restaurado para orden {request.order_id}")
                return catalog_pb2.RestoreStockResponse(success=True)

            except Exception as e:
                db.rollback()
                log.error(f"[gRPC] RestoreStock error: {e}")
                context.set_code(grpc.StatusCode.INTERNAL)
                return catalog_pb2.RestoreStockResponse(success=False, error=str(e))


# =============================================================================
# Arranque del servidor gRPC
# =============================================================================

def start_grpc_server(port: int):
    """
    Arranca el servidor gRPC en un ThreadPoolExecutor.
    Se llama desde main.py en un hilo separado para no bloquear FastAPI.
    """
    server = grpc.server(futures.ThreadPoolExecutor(max_workers=10))
    catalog_pb2_grpc.add_CatalogServiceServicer_to_server(CatalogServicer(), server)

    address = f"0.0.0.0:{port}"
    server.add_insecure_port(address)
    server.start()

    log.info(f"[gRPC] Catalog Service servidor en {address}")
    return server