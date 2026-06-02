"""
config/logger.py — Logger centralizado con Loguru

Loguru es la alternativa moderna a logging en Python.
Formato JSON en producción, formato legible en desarrollo.
"""

import sys
from loguru import logger
from src.config.settings import settings


def setup_logger():
    # Eliminar el handler por defecto de Loguru
    logger.remove()

    is_production = settings.node_env == "production"

    if is_production:
        # Formato JSON estructurado para producción
        logger.add(
            sys.stdout,
            format="{time:YYYY-MM-DDTHH:mm:ss.SSSZ} | {level} | {extra[service]} | {message} | {extra}",
            level=settings.log_level.upper(),
            serialize=True,   # Output JSON
        )
    else:
        # Formato legible para desarrollo
        logger.add(
            sys.stdout,
            format="<green>{time:YYYY-MM-DD HH:mm:ss}</green> | <level>{level: <8}</level> | <cyan>[{extra[service]}]</cyan> | <white>{message}</white>",
            level=settings.log_level.upper(),
            colorize=True,
        )

    # Retorna un logger con el contexto del servicio pre-adjunto
    return logger.bind(service=settings.service_name)


# Logger global para importar en cualquier módulo
log = setup_logger()