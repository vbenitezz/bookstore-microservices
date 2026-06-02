"""
config/settings.py — Configuración centralizada del Catalog Service

Pydantic Settings lee automáticamente desde variables de entorno.
Si una variable no existe, usa el valor por defecto definido aquí.
"""

from pydantic_settings import BaseSettings
from functools import lru_cache


class Settings(BaseSettings):
    # Servicio
    service_name: str = "catalog-service"
    port: int = 3002
    grpc_port: int = 50052
    node_env: str = "development"
    log_level: str = "DEBUG"

    # Base de datos
    db_host: str = "localhost"
    db_port: int = 5432
    db_user: str = "catalog_user"
    db_password: str = ""
    db_name: str = "bookstore_main"
    db_schema: str = "catalog"

    # Construye la URL de conexión async (asyncpg)
    @property
    def database_url(self) -> str:
        return (
            f"postgresql+asyncpg://{self.db_user}:{self.db_password}"
            f"@{self.db_host}:{self.db_port}/{self.db_name}"
        )

    # URL sync para Alembic (psycopg2)
    @property
    def database_url_sync(self) -> str:
        import os
        ssl_suffix = "?sslmode=require" if os.getenv("DB_SSL") == "true" else ""
        return (
            f"postgresql+psycopg2://{self.db_user}:{self.db_password}"
            f"@{self.db_host}:{self.db_port}/{self.db_name}{ssl_suffix}"
        )

    class Config:
        env_file = ".env"
        case_sensitive = False  # DB_HOST y db_host son equivalentes


@lru_cache()
def get_settings() -> Settings:
    """
    Retorna la instancia de settings (singleton con caché).
    Usar como dependencia en FastAPI: settings = Depends(get_settings)
    O directamente: from config.settings import settings
    """
    return Settings()


# Instancia global para importar directamente
settings = get_settings()