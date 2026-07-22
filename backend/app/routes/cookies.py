"""Kelola cookies per-platform. Isinya tidak pernah dikirim balik — hanya flag `stored`."""
from fastapi import APIRouter, HTTPException, UploadFile

from capture import cookies
from capture.cookies import CookieError
from constants import COOKIE_MAX_BYTES, COOKIE_PLATFORM_IDS, COOKIE_PLATFORMS

router = APIRouter()


@router.get("/cookies")
async def list_cookies() -> dict:
    owned = cookies.stored()
    return {
        "platforms": [{**p, "stored": p["id"] in owned} for p in COOKIE_PLATFORMS],
        "max_kb": COOKIE_MAX_BYTES // 1024,
    }


@router.post("/cookies/{platform}", status_code=201)
async def upload_cookies(platform: str, file: UploadFile) -> dict:
    _reject_unknown(platform)
    raw = await file.read(COOKIE_MAX_BYTES + 1)
    if len(raw) > COOKIE_MAX_BYTES:
        raise HTTPException(413, f"berkas melebihi {COOKIE_MAX_BYTES // 1024} KB")
    try:
        cookies.save(platform, raw)
    except CookieError as exc:
        raise HTTPException(422, str(exc)) from exc
    return await list_cookies()


@router.delete("/cookies/{platform}", status_code=204)
async def delete_cookies(platform: str) -> None:
    _reject_unknown(platform)
    cookies.forget(platform)


def _reject_unknown(platform: str) -> None:
    if platform not in COOKIE_PLATFORM_IDS:
        raise HTTPException(422, "platform tidak dikenal")
