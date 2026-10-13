"""Pause flag in-memory: pipeline cek dari thread tanpa query DB."""
_paused: set[int] = set()

def request_pause(recording_id: int) -> None:
    _paused.add(recording_id)

def is_paused(recording_id: int) -> bool:
    return recording_id in _paused

def clear_pause(recording_id: int) -> None:
    _paused.discard(recording_id)
