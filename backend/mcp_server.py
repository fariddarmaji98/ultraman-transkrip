"""MCP server: expose pipeline transkrip sebagai tool untuk AI agent (ADR 0015).

Project ini adalah *context provider*; project AI agent adalah *context consumer*.
Keduanya bicara lewat MCP (Model Context Protocol) — agent kirim URL video,
transkrip mengerjakan semuanya (unduh → transkrip → ringkasan → context), hasil
tersimpan di arsip seperti alur manual, dan context terstruktur dikembalikan.

Kontrak tool (async — transkripsi berlangsung menit):
- transcribe_url(url)          → recording_id + job_id (balik seketika)
- get_job(job_id)              → status pipeline (poll sampai done)
- get_context(recording_id)    → extract 4 kategori + sitasi + ringkasan
- list_recordings(label?)      → arsip, bisa difilter label (Fase 2b)
- label_recording(id, labels)  → label manual (Fase 2b)

Server ini memanggil fungsi internal yang SAMA dengan REST (tidak ada logika
duplikat): enqueue worker, query store, analysis. Kunci desain (ADR 0015):
read-only kecuali ingest + label; pola tarik (pull), bukan dorong.

Menjalankan (streamable HTTP, dipakai `hermes mcp` / klien MCP modern):
    .venv/Scripts/python -m mcp_server            # default :8100
    TRANSKRIP_MCP_PORT=9000 python -m mcp_server
"""
import asyncio
import json
import os
from pathlib import Path

from loguru import logger
from mcp.server.mcpserver import MCPServer
from sqlalchemy import select

from analysis import get_llm
from analysis.extract import extract as run_extract
from analysis.summarize import summarize
from constants import (
    DEFAULT_AI_LANGUAGE,
    EXTRACT_CATEGORIES,
    JOB_DONE,
    LANGUAGE_AUTO,
    SOURCE_URL,
)
from store import models
from store.db import SessionLocal
from worker.queue import enqueue
from worker.pipeline import run_fetch

_server = MCPServer(
    name="ultraman-transkrip",
    title="Ultraman Transkrip — Context Provider",
    description=(
        "Kirim URL video (YouTube/TikTok/X/dll.), dapat transkrip, ringkasan, dan "
        "context terstruktur (keputusan, kebutuhan, batasan, pertanyaan terbuka) "
        "bersitasi menit. Hasil tersimpan di arsip dan bisa dicari ulang."
    ),
)


# --- tool: ingest -----------------------------------------------------------

@_server.tool(
    name="transcribe_url",
    description=(
        "Unduh video dari URL, transkrip, lalu siapkan context. ASYNC: balik "
        "seketika dengan recording_id — poll get_job(job_id) sampai status "
        "'done' sebelum memanggil get_context."
    ),
)
async def transcribe_url(url: str, language: str = LANGUAGE_AUTO) -> dict:
    """Cermin POST /recordings/from-url + transcribe: probe → recording → fetch
    → transcribe, dua job berantai lewat antrean worker."""
    from capture import get_source

    try:
        source = get_source(url)
        info = await asyncio.to_thread(source.probe, url)
    except Exception as exc:
        return {"ok": False, "detail": f"URL tidak bisa diprobe: {exc}"[:300]}

    async with SessionLocal() as db:
        rec = models.Recording(
            title=info.title[:250] if info.title else url[:250],
            source_filename=info.title or "unduhan",
            source_kind=SOURCE_URL,
            source_url=url,
            upload_path=str(Path("data/uploads") / f"mcp-{info.title or url[-40:]}"),
            language=language,
        )
        db.add(rec)
        await db.commit()
        await db.refresh(rec)
        fetch_job = models.Job(recording_id=rec.id, kind="fetch")
        db.add(fetch_job)
        await db.commit()
        await db.refresh(fetch_job)

    await enqueue(rec.id, "fetch")
    # fetch selesai = status `downloaded`; transkrip harus dipicu terpisah
    # (pola ADR 0008: unduh dan transkrip dua langkah). Karena antrean
    # in-process, kita antre transkrip langsung — worker concurrency=1
    # menjamin fetch selesai lebih dulu.
    await enqueue(rec.id, "transcribe")
    return {
        "ok": True,
        "recording_id": rec.id,
        "job_id": fetch_job.id,
        "title": rec.title,
        "duration_ms": info.duration_ms,
        "status": rec.status,
    }


@_server.tool(
    name="get_job",
    description=(
        "Status job ingest/recording: status (queued/downloading/transcribing/"
        "done/failed), progress 0-100, dan error bila gagal. Poll tiap beberapa "
        "detik sampai 'done'."
    ),
)
async def get_job(job_id: int) -> dict:
    async with SessionLocal() as db:
        job = await db.get(models.Job, job_id)
        if job is None:
            return {"ok": False, "detail": f"job {job_id} tidak ditemukan"}
        rec = await db.get(models.Recording, job.recording_id)
        return {
            "ok": True,
            "job_id": job.id,
            "recording_id": job.recording_id,
            "status": rec.status if rec else "unknown",
            "progress": rec.progress if rec else job.progress,
            "error": job.error,
            "title": rec.title if rec else None,
        }


# --- tool: context ----------------------------------------------------------

@_server.tool(
    name="get_context",
    description=(
        "Context terstruktur satu rekaman: 4 kategori (decisions, requirements, "
        "constraints, open_questions) bersitasi at_ms + ringkasan. Panggil "
        "setelah get_job 'done'. Bila context belum diekstrak, ekstraksi "
        "dijalankan otomatis (butuh beberapa detik)."
    ),
)
async def get_context(recording_id: int, lang: str = DEFAULT_AI_LANGUAGE) -> dict:
    async with SessionLocal() as db:
        rec = await db.get(models.Recording, recording_id)
        if rec is None:
            return {"ok": False, "detail": f"rekaman {recording_id} tidak ditemukan"}
        if rec.status != JOB_DONE:
            return {"ok": False, "detail": f"transkrip belum selesai (status: {rec.status}) — poll get_job dulu"}
        segments = (await db.execute(
            select(models.Segment)
            .where(models.Segment.recording_id == recording_id)
            .order_by(models.Segment.idx)
        )).scalars().all()
        if not segments:
            return {"ok": False, "detail": "tidak ada segmen transkrip"}

        row = (await db.execute(
            select(models.RecordingExtract)
            .where(models.RecordingExtract.recording_id == recording_id,
                   models.RecordingExtract.lang == lang)
            .order_by(models.RecordingExtract.id.desc())
        )).scalars().first()

    # Extract belum ada → jalankan sekarang (agent tidak perlu tahu dua langkah).
    if row is None:
        try:
            data, _truncated = await run_extract(segments, get_llm(), lang)
            payload = data.model_dump()
            async with SessionLocal() as db:
                row = models.RecordingExtract(
                    recording_id=recording_id, lang=lang,
                    data=json.dumps(payload, ensure_ascii=False),
                    provider="mcp", model="auto",
                )
                db.add(row)
                await db.commit()
        except Exception as exc:
            return {"ok": False, "detail": f"ekstraksi gagal: {exc}"[:300]}
    else:
        payload = json.loads(row.data)

    # Ringkasan ikut disertakan: PRD butuh narasi + struktur.
    async with SessionLocal() as db:
        srow = (await db.execute(
            select(models.Summary)
            .where(models.Summary.recording_id == recording_id,
                   models.Summary.lang == lang)
            .order_by(models.Summary.id.desc())
        )).scalars().first()
        summary = srow.text if srow else None
        brief_url = f"/api/recordings/{recording_id}/export?fmt=brief&lang={lang}"

    return {
        "ok": True,
        "recording_id": recording_id,
        "title": rec.title,
        "lang": lang,
        "summary": summary,
        "context": {c: payload.get(c, []) for c in EXTRACT_CATEGORIES},
        "brief_url": brief_url,
        "note": "brief_url relatif ke server transkrip (base http://<host>:8000)",
    }


# --- tool: arsip ------------------------------------------------------------

@_server.tool(
    name="list_recordings",
    description=(
        "Daftar rekaman tersimpan di arsip (hasil ingest manual maupun agent), "
        "terbaru dulu. Filter opsional per label (Fase 2b) atau status."
    ),
)
async def list_recordings(status: str | None = None, limit: int = 20) -> dict:
    q = select(models.Recording).order_by(models.Recording.created_at.desc()).limit(min(limit, 100))
    if status:
        q = q.where(models.Recording.status == status)
    async with SessionLocal() as db:
        rows = (await db.execute(q)).scalars().all()
    return {
        "ok": True,
        "count": len(rows),
        "recordings": [
            {"id": r.id, "title": r.title, "status": r.status,
             "created_at": r.created_at.isoformat(), "source_url": r.source_url}
            for r in rows
        ],
    }


# --- entrypoint -------------------------------------------------------------

def main() -> None:
    port = int(os.environ.get("TRANSKRIP_MCP_PORT", "8100"))
    logger.info("MCP server ultraman-transkrip di :{} (streamable HTTP)", port)
    asyncio.run(
        _server.run_streamable_http_async(host="127.0.0.1", port=port)
    )


if __name__ == "__main__":
    main()
