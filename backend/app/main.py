"""App factory + lifespan (init DB, start worker in-process)."""
import asyncio
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app import runtime
from app.config import settings
from app.routes import health, jobs, recordings
from protection import install_protection
from store.db import init_db
from worker.queue import requeue_pending, worker_loop


@asynccontextmanager
async def lifespan(app: FastAPI):
    settings.ensure_dirs()
    runtime.load()  # pilihan model dari UI (kalau ada) menimpa default
    await init_db()
    task = asyncio.create_task(worker_loop())
    await requeue_pending()  # lanjutkan job yang belum selesai setelah restart
    yield
    task.cancel()


def create_app() -> FastAPI:
    app = FastAPI(title="Ultraman Transkrip", lifespan=lifespan)
    install_protection(app)  # gerbang tol (lapisan dalam, sebelum router)
    app.add_middleware(  # CORS (lapisan luar; header tetap ada di respons 429)
        CORSMiddleware, allow_origins=["*"],
        allow_methods=["*"], allow_headers=["*"],
    )
    for module in (health, recordings, jobs):
        app.include_router(module.router, prefix="/api")
    return app


app = create_app()
