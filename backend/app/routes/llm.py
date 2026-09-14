"""Setelan mesin AI (ringkasan/chat): katalog, pilih provider, tes koneksi.

Nilai kunci API tidak pernah dikirim balik ke klien — hanya flag `key_set`.
"""
from fastapi import APIRouter, HTTPException

import analysis
from app import runtime
from app.schemas import LlmIn
from analysis.openai_compat import LLMError, OpenAICompatProvider
from constants import LLM_PROVIDER_IDS, LLM_PROVIDERS, LLM_TEST_TIMEOUT_S

router = APIRouter()


@router.get("/llm")
async def llm_config() -> dict:
    return _payload()


@router.patch("/llm")
async def update_llm(body: LlmIn) -> dict:
    _reject_unknown(body.provider)
    _require_custom_url(body)
    runtime.set_llm(body.provider, body.model.strip(), (body.api_key or "").strip(),
                    (body.base_url or "").strip())
    return _payload()


@router.post("/llm/test")
async def test_llm(body: LlmIn) -> dict:
    """Panggil provider sungguhan. Gagal = 200 dengan ok:false, bukan error HTTP."""
    _reject_unknown(body.provider)
    _require_custom_url(body)
    provider = _provider_for(body)
    if analysis.catalog_of(body.provider)["needs_key"] and not provider.api_key:
        return {"ok": False, "detail": "kunci API belum diisi untuk provider ini"}
    try:
        await provider.ping()
    except LLMError as exc:
        return {"ok": False, "detail": str(exc)}
    return {"ok": True, "detail": f"{provider.model} merespons"}


@router.delete("/llm/{provider}/key", status_code=204)
async def forget_key(provider: str) -> None:
    _reject_unknown(provider)
    runtime.forget_llm_key(provider)


@router.post("/llm/models")
async def list_models(body: LlmIn) -> dict:
    """Daftar model dari provider (isian form dipakai apa adanya, tidak disimpan).

    Gagal = 200 dengan ok:false — dropdown menampilkan pesan, bukan error HTTP,
    supaya popup tetap bisa dipakai untuk mengetik model secara manual.
    """
    _reject_unknown(body.provider)
    if body.provider == "custom" and not (body.base_url or "").strip():
        return {"ok": False, "detail": "isi base URL dulu untuk memuat daftar model"}
    provider = _provider_for(body)
    try:
        models = await provider.list_models()
    except LLMError as exc:
        return {"ok": False, "detail": str(exc)}
    if not models:
        return {"ok": False, "detail": "provider tidak mengembalikan daftar model"}
    return {"ok": True, "models": models}


def _reject_unknown(provider: str) -> None:
    if provider not in LLM_PROVIDER_IDS:
        raise HTTPException(422, "provider LLM tidak dikenal")


def _require_custom_url(body: LlmIn) -> None:
    """Custom tanpa URL = tak bisa dipanggil; tolak lebih awal dengan pesan jelas.

    Saat menyimpan, URL lama yang tersimpan boleh dipakai (field kosong = tidak
    mengubah). Saat MENGUJI, URL harus benar-benar ada — tes tanpa URL hanya
    akan gagal di httpx dengan pesan yang membingungkan.
    """
    if body.provider != "custom":
        return
    url = (body.base_url or "").strip() or runtime.custom_base_url()
    if not url:
        raise HTTPException(422, "base URL wajib diisi untuk provider Custom URL")


def _provider_for(body: LlmIn) -> OpenAICompatProvider:
    """Tes memakai isian form; kunci kosong = pakai yang sudah tersimpan."""
    cfg = analysis.resolve(body.provider, body.model.strip())
    key = (body.api_key or "").strip() or cfg["api_key"]
    base_url = cfg["base_url"]
    if body.provider == "custom" and (body.base_url or "").strip():
        base_url = body.base_url.strip().rstrip("/")  # isian form menang untuk tes
    return OpenAICompatProvider(base_url, cfg["model"], key, LLM_TEST_TIMEOUT_S)


def _payload() -> dict:
    active = analysis.resolve()
    owned = runtime.providers_with_key()
    return {
        "provider": active["provider"],
        "model": active["model"],
        "base_url": active["base_url"],
        "providers": [{**p, "key_set": p["id"] in owned} for p in LLM_PROVIDERS],
    }
