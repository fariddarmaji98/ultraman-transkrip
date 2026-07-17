"""Render transkrip ke TXT / SRT / JSON. Input = list ORM Segment (punya start_ms dst)."""
import json


def render_export(segments, fmt: str) -> tuple[str, str]:
    if fmt == "srt":
        return _srt(segments), "application/x-subrip"
    if fmt == "json":
        return _json(segments), "application/json"
    return _txt(segments), "text/plain; charset=utf-8"


def _txt(segments) -> str:
    return "\n".join(s.text for s in segments)


def _json(segments) -> str:
    rows = [
        {"idx": s.idx, "start_ms": s.start_ms, "end_ms": s.end_ms, "text": s.text}
        for s in segments
    ]
    return json.dumps(rows, ensure_ascii=False, indent=2)


def _srt(segments) -> str:
    return "\n".join(_srt_block(n, s) for n, s in enumerate(segments, start=1))


def _srt_block(n: int, s) -> str:
    return f"{n}\n{_ts(s.start_ms)} --> {_ts(s.end_ms)}\n{s.text}\n"


def _ts(ms: int) -> str:
    hours, ms = divmod(ms, 3_600_000)
    minutes, ms = divmod(ms, 60_000)
    seconds, ms = divmod(ms, 1000)
    return f"{hours:02d}:{minutes:02d}:{seconds:02d},{ms:03d}"
