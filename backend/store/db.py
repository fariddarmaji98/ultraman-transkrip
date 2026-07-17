"""Engine & session async. `create_all` cukup untuk MVP SQLite; Alembic saat pindah Postgres."""
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

from app.config import settings
from store.models import Base

engine = create_async_engine(settings.database_url)
SessionLocal = async_sessionmaker(engine, expire_on_commit=False)


async def init_db() -> None:
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
