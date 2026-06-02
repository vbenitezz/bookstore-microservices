"""
routers/categories.py — Endpoints REST de categorías
"""

from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException, status, Request
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from src.config.database import get_db
from src.config.logger import log
from src.models.book import Category
from src.schemas.book import CategoryCreate, CategoryResponse

router = APIRouter(prefix="/categories", tags=["categories"])


@router.get("", response_model=list[CategoryResponse])
async def list_categories(db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(Category).where(Category.is_active == True).order_by(Category.name)
    )
    return result.scalars().all()


@router.get("/{category_id}", response_model=CategoryResponse)
async def get_category(category_id: UUID, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(Category).where(Category.id == category_id)
    )
    category = result.scalar_one_or_none()
    if not category:
        raise HTTPException(status_code=404, detail={"error": "category_not_found"})
    return category


@router.post("", response_model=CategoryResponse, status_code=status.HTTP_201_CREATED)
async def create_category(
    payload: CategoryCreate,
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    user_role = request.headers.get("x-user-role", "")
    if user_role != "admin":
        raise HTTPException(status_code=403, detail={"error": "forbidden"})

    # Verificar slug duplicado
    existing = await db.execute(
        select(Category).where(Category.slug == payload.slug)
    )
    if existing.scalar_one_or_none():
        raise HTTPException(
            status_code=409,
            detail={"error": "slug_taken", "message": f"Ya existe una categoría con slug '{payload.slug}'"},
        )

    category = Category(**payload.model_dump())
    db.add(category)
    await db.flush()
    await db.refresh(category)

    log.info(f"[CATALOG] Categoría creada: {category.id} — {category.name}")
    return category