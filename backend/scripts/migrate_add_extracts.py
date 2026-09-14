"""Migrasi sekali-jalan: tabel `recording_extracts` (ADR 0013).

`create_all` MEMBUAT tabel yang belum ada, jadi tabel ini lahir sendiri saat
backend menyala. Skrip ini disediakan supaya DB yang sedang tidak dijalankan
servernya tetap bisa dimigrasikan dengan satu perintah, dan supaya indeks
uniknya dijamin ada (pola `migrate_add_translations.py`). Aman dijalankan
berulang.

Jalankan dari folder `backend/`:
    .venv\\Scripts\\python.exe scripts/migrate_add_extracts.py
"""
import sqlite3
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from app.config import settings  # noqa: E402

TABLE = """
CREATE TABLE IF NOT EXISTS recording_extracts (
    id INTEGER NOT NULL PRIMARY KEY,
    recording_id INTEGER NOT NULL REFERENCES recordings(id),
    lang VARCHAR(16) NOT NULL,
    data TEXT NOT NULL,
    provider VARCHAR(32) NOT NULL,
    model VARCHAR(64) NOT NULL,
    created_at DATETIME NOT NULL
)
"""

INDEX = """
CREATE UNIQUE INDEX IF NOT EXISTS uq_extract_recording_lang
ON recording_extracts(recording_id, lang)
"""


def main() -> None:
    db = settings.data_dir / "transkrip.db"
    if not db.exists():
        print(f"DB belum ada di {db} — tidak perlu migrasi.")
        return
    con = sqlite3.connect(db)
    con.execute(TABLE)
    con.execute(INDEX)
    con.commit()
    con.close()
    print(f"+ recording_extracts + indeks uniknya: siap ({db})")


main()
