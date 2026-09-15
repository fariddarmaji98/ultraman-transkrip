"""Migrasi sekali-jalan: labeling (ADR 0018, Fase 2b).

1. `recording_extracts.auto_tags` (TEXT default '[]') — topik dari LLM.
2. Tabel `recording_labels` — label manual user, unik per (recording_id, label).

`create_all` membuat tabel baru untuk DB baru; ALTER kolom harus manual di sini.
Aman dijalankan berulang. Jalankan dari folder `backend/`:
    .venv\\Scripts\\python.exe scripts/migrate_add_labels.py
"""
import json
import sqlite3
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from app.config import settings  # noqa: E402

LABELS_TABLE = """
CREATE TABLE IF NOT EXISTS recording_labels (
    id INTEGER NOT NULL PRIMARY KEY,
    recording_id INTEGER NOT NULL REFERENCES recordings(id),
    label VARCHAR(64) NOT NULL,
    created_at DATETIME NOT NULL
)
"""
LABELS_INDEX = """
CREATE UNIQUE INDEX IF NOT EXISTS uq_reclabel_rec_label
ON recording_labels(recording_id, label)
"""


def has_column(con: sqlite3.Connection, table: str, name: str) -> bool:
    return any(row[1] == name for row in con.execute(f"PRAGMA table_info({table})"))


def main() -> None:
    db = settings.data_dir / "transkrip.db"
    if not db.exists():
        print(f"DB belum ada di {db} — tidak perlu migrasi.")
        return
    con = sqlite3.connect(db)
    if has_column(con, "recording_extracts", "auto_tags"):
        print("- auto_tags: sudah ada, dilewati")
    else:
        con.execute("ALTER TABLE recording_extracts ADD COLUMN auto_tags TEXT NOT NULL DEFAULT '[]'")
        print("+ recording_extracts.auto_tags: ditambahkan (extract lama = '[]')")
    con.execute(LABELS_TABLE)
    con.execute(LABELS_INDEX)
    print("+ recording_labels + indeks uniknya: siap")
    con.commit()
    con.close()
    print(f"Selesai: {db}")


main()
