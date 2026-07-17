"""App factory + lifespan (init DB, start worker in-process)."""
import asyncio
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from app.routes import health, jobs, recordings
from store.db import init_db
from worker.queue import worker_loop


@asynccontextmanager
async def lifespan(app: FastAPI):
    settings.ensure_dirs()
    await init_db()
    task = asyncio.create_task(worker_loop())
    yield
    task.cancel()


def create_app() -> FastAPI:
    app = FastAPI(title="Ultraman Transkrip", lifespan=lifespan)
    app.add_middleware(
        CORSMiddleware, allow_origins=["*"],
        allow_methods=["*"], allow_headers=["*"],
    )
    for module in (health, recordings, jobs):
        app.include_router(module.router, prefix="/api")
    return app


app = create_app()
