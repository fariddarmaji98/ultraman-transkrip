"""Wrapper ffmpeg/ffprobe via subprocess (asyncio). Ekstrak 16 kHz mono untuk Whisper."""
import asyncio
import json
from pathlib import Path

from constants import ASR_CHANNELS, ASR_SAMPLE_RATE


class MediaError(Exception):
    """File bukan media valid / ffmpeg gagal."""


async def probe_duration_ms(path: Path) -> int:
    out = await _run([
        "ffprobe", "-v", "error", "-show_entries", "format=duration",
        "-of", "json", str(path),
    ])
    try:
        return int(float(json.loads(out)["format"]["duration"]) * 1000)
    except (KeyError, ValueError, TypeError) as exc:
        raise MediaError("durasi media tidak terbaca") from exc


async def remux(src: Path, dst: Path) -> None:
    """Tulis ulang container tanpa encode ulang (`-c copy`) — cepat, tanpa rugi mutu.

    Wajib untuk hasil `MediaRecorder`: ia menulis WebM mode *live* yang **tidak
    punya durasi di header** (ffprobe mengembalikan format kosong) dan tanpa
    indeks pencarian, sehingga player pun tak bisa melompat ke menit tertentu.
    Remux memasang keduanya.
    """
    await _run(["ffmpeg", "-y", "-i", str(src), "-c", "copy", str(dst)])


async def extract_audio(src: Path, dst: Path) -> None:
    await _run([
        "ffmpeg", "-y", "-i", str(src), "-vn",
        "-ac", str(ASR_CHANNELS), "-ar", str(ASR_SAMPLE_RATE),
        "-c:a", "pcm_s16le", str(dst),
    ])


async def _run(args: list[str]) -> str:
    proc = await asyncio.create_subprocess_exec(
        *args, stdout=asyncio.subprocess.PIPE, stderr=asyncio.subprocess.PIPE
    )
    stdout, stderr = await proc.communicate()
    if proc.returncode != 0:
        raise MediaError(stderr.decode(errors="replace")[-500:])
    return stdout.decode(errors="replace")
