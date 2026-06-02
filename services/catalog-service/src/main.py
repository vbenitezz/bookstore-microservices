"""
main.py — Punto de entrada del Catalog Service

Arranca dos servidores en paralelo:
  1. FastAPI (uvicorn) — REST en puerto 3002
  2. gRPC server       — en puerto 50052

FastAPI usa asyncio (event loop).
gRPC usa un ThreadPoolExecutor (hilos del sistema).
Ambos conviven sin problema porque gRPC corre en su propio pool de hilos.
"""

import os
import threading
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware

from src.config.settings import settings
from src.config.logger import log
from src.config.database import check_connection, close_connection
from src.routers.books import router as books_router
from src.routers.categories import router as categories_router
from src.grpc.server import start_grpc_server


# =============================================================================
# Migraciones con Alembic
# =============================================================================

def run_migrations():
    """
    Ejecuta las migraciones de Alembic al arrancar el servicio.
    Esto garantiza que las tablas y datos iniciales siempre existen,
    sin importar si el contenedor es nuevo o ya existía.
    """
    from alembic.config import Config
    from alembic import command

    alembic_cfg = Config(os.path.join("/app", "alembic.ini"))
    alembic_cfg.set_main_option("script_location", "/app/alembic")

    try:
        command.upgrade(alembic_cfg, "head")
        log.info("[STARTUP] Migraciones Alembic aplicadas correctamente")
    except Exception as e:
        log.error(f"[STARTUP] Error al aplicar migraciones: {e}")
        raise


# =============================================================================
# Ciclo de vida
# =============================================================================

@asynccontextmanager
async def lifespan(app: FastAPI):
    # --- STARTUP ---
    log.info(f"[STARTUP] Iniciando {settings.service_name}...")

    # 1. Verificar conexión a DB
    await check_connection()

    # 2. Ejecutar migraciones (crea tablas + inserta categorías iniciales)
    run_migrations()

    # 3. Arrancar servidor gRPC en hilo separado
    grpc_server = start_grpc_server(settings.grpc_port)
    grpc_thread = threading.Thread(
        target=grpc_server.wait_for_termination,
        daemon=True,
        name="grpc-server",
    )
    grpc_thread.start()
    log.info(f"[STARTUP] gRPC server corriendo en :{settings.grpc_port}")
    log.info(f"[STARTUP] {settings.service_name} listo")

    yield

    # --- SHUTDOWN ---
    log.info("[SHUTDOWN] Apagando...")
    grpc_server.stop(grace=5)
    await close_connection()
    log.info("[SHUTDOWN] Cerrado correctamente")


# =============================================================================
# Aplicación FastAPI
# =============================================================================

app = FastAPI(
    title="BookStore — Catalog Service",
    description="Gestión del catálogo de libros. Expone REST y gRPC.",
    version="1.0.0",
    lifespan=lifespan,
    docs_url="/docs" if settings.node_env == "development" else None,
    redoc_url="/redoc" if settings.node_env == "development" else None,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.middleware("http")
async def correlation_id_middleware(request: Request, call_next):
    correlation_id = request.headers.get("x-request-id", "no-id")
    response = await call_next(request)
    response.headers["X-Request-ID"] = correlation_id
    return response

@app.middleware("http")
async def logging_middleware(request: Request, call_next):
    import time
    start = time.time()
    response = await call_next(request)
    duration = round((time.time() - start) * 1000, 2)
    log.info(f"{request.method} {request.url.path} → {response.status_code} ({duration}ms)")
    return response

@app.get("/health", tags=["health"])
async def health():
    return {
        "status": "ok",
        "service": settings.service_name,
        "grpc_port": settings.grpc_port,
    }

app.include_router(books_router)
app.include_router(categories_router)

@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    log.error(f"[ERROR] Unhandled exception: {exc}", exc_info=True)
    return JSONResponse(
        status_code=500,
        content={
            "error": "internal_error",
            "message": "Error interno del servidor" if settings.node_env == "production" else str(exc),
        },
    )