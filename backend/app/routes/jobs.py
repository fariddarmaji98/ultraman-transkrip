"""Status job untuk polling dari FE."""
from fastapi import APIRouter, HTTPException

from app.deps import DbDep
from app.schemas import JobOut
from store import models

router = APIRouter()


@router.get("/jobs/{job_id}", response_model=JobOut)
async def get_job(job_id: int, db: DbDep) -> models.Job:
    job = await db.get(models.Job, job_id)
    if job is None:
        raise HTTPException(404, "job tidak ditemukan")
    return job
