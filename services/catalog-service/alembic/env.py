"""
alembic/env.py — Configuración del entorno de migraciones

Este archivo conecta Alembic con los modelos SQLAlchemy del servicio
y con la URL de base de datos de los settings.
"""

import sys
import os
from logging.config import fileConfig
from sqlalchemy import engine_from_config, pool, text, event
from alembic import context

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

from src.config.settings import settings
from src.config.database import Base
from src.models.book import Book, Category  # noqa: F401

config = context.config
config.set_main_option("sqlalchemy.url", settings.database_url_sync)

if config.config_file_name is not None:
    fileConfig(config.config_file_name)

target_metadata = Base.metadata
SCHEMA = settings.db_schema


def run_migrations_offline() -> None:
    url = config.get_main_option("sqlalchemy.url")
    context.configure(
        url=url,
        target_metadata=target_metadata,
        literal_binds=True,
        include_schemas=True,
        version_table="alembic_version",
        version_table_schema=SCHEMA,
    )
    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online() -> None:
    # Crear el engine con search_path en las opciones de conexión
    # Esta es la forma correcta — sin COMMIT manual que rompe transacciones
    connect_args = {
        "options": f"-c search_path={SCHEMA},public"
    }

    connectable = engine_from_config(
        config.get_section(config.config_ini_section, {}),
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
        connect_args=connect_args,
    )

    with connectable.connect() as connection:
        context.configure(
            connection=connection,
            target_metadata=target_metadata,
            include_schemas=True,
            version_table="alembic_version",
            version_table_schema=SCHEMA,
        )

        with context.begin_transaction():
            context.run_migrations()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()