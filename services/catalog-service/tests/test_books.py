"""
tests/test_books.py — Tests del Catalog Service

Usa httpx como cliente HTTP async para testear los endpoints de FastAPI
sin levantar un servidor real (TestClient de FastAPI).
"""

import pytest
from httpx import AsyncClient, ASGITransport
from unittest.mock import AsyncMock, patch, MagicMock
import uuid

# Importar la app de FastAPI
import sys
import os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'src'))


@pytest.fixture
def sample_book_payload():
    """Payload válido para crear un libro."""
    return {
        "title":       "Clean Code",
        "author":      "Robert C. Martin",
        "isbn":        "9780132350884",
        "description": "A handbook of agile software craftsmanship",
        "price":       29.99,
        "stock":       50,
        "language":    "Inglés",
    }


# =============================================================================
# Tests de schemas (sin DB, sin servidor)
# =============================================================================

class TestBookSchemas:
    """Tests de validación de schemas Pydantic."""

    def test_valid_book_create(self, sample_book_payload):
        from schemas.book import BookCreate
        book = BookCreate(**sample_book_payload)
        assert book.title == "Clean Code"
        assert float(book.price) == 29.99
        # ISBN debe quedar limpio (sin guiones)
        assert book.isbn == "9780132350884"

    def test_invalid_price(self, sample_book_payload):
        from schemas.book import BookCreate
        from pydantic import ValidationError
        sample_book_payload["price"] = -5
        with pytest.raises(ValidationError):
            BookCreate(**sample_book_payload)

    def test_invalid_isbn_length(self, sample_book_payload):
        from schemas.book import BookCreate
        from pydantic import ValidationError
        sample_book_payload["isbn"] = "123"
        with pytest.raises(ValidationError):
            BookCreate(**sample_book_payload)

    def test_negative_stock(self, sample_book_payload):
        from schemas.book import BookCreate
        from pydantic import ValidationError
        sample_book_payload["stock"] = -1
        with pytest.raises(ValidationError):
            BookCreate(**sample_book_payload)

    def test_book_update_all_optional(self):
        from schemas.book import BookUpdate
        # BookUpdate no requiere ningún campo
        update = BookUpdate()
        assert update.title is None
        assert update.price is None

    def test_book_update_partial(self):
        from schemas.book import BookUpdate
        update = BookUpdate(price=19.99)
        assert float(update.price) == 19.99
        assert update.title is None


# =============================================================================
# Tests de endpoints (integración con DB mockeada)
# =============================================================================

class TestHealthEndpoint:
    """Test del health check (no necesita DB)."""

    @pytest.mark.asyncio
    async def test_health_returns_ok(self):
        # Mockear la DB para que no intente conectarse en tests
        with patch("config.database.check_connection", new_callable=AsyncMock), \
             patch("config.database.engine") as mock_engine, \
             patch("grpc.server.start_grpc_server", return_value=MagicMock()):

            mock_engine.begin.return_value.__aenter__ = AsyncMock()
            mock_engine.begin.return_value.__aexit__ = AsyncMock(return_value=False)

            from main import app
            async with AsyncClient(
                transport=ASGITransport(app=app),
                base_url="http://test"
            ) as client:
                response = await client.get("/health")

            assert response.status_code == 200
            data = response.json()
            assert data["status"] == "ok"
            assert data["service"] == "catalog-service"