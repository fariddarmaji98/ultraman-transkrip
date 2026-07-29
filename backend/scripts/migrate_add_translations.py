"""Migrasi sekali-jalan: tabel `segment_translations` + kolom `jobs.lang`.

`create_all` MEMBUAT tabel yang belum ada, jadi `segment_translations` sebenarnya
lahir sendiri saat backend menyala. Yang tidak bisa dilakukannya adalah mengubah
tabel lama — karena itu `jobs.lang` tetap perlu ALTER manual di sini.

Tabelnya ikut dibuat di skrip ini supaya satu perintah cukup untuk DB yang
sedang tidak dijalankan servernya. Aman dijalankan berulang.

Jalankan dari folder `backend/`:
    .venv\\Scripts\\python.exe scripts/migrate_add_translations.py
"""
import sqlite3
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from app.config import settings  # noqa: E402

TABLE = """
CREATE TABLE IF NOT EXISTS segment_translations (
    id INTEGER NOT NULL PRIMARY KEY,
    recording_id INTEGER NOT NULL REFERENCES recordings(id),
    lang VARCHAR(16) NOT NULL,
    idx INTEGER NOT NULL,
    text TEXT NOT NULL
)
"""
INDEX = """
CREATE UNIQUE INDEX IF NOT EXISTS uq_segtrans_rec_lang_idx
ON segment_translations(recording_id, lang, idx)
"""


def has_column(con: sqlite3.Connection, table: str, name: str) -> bool:
    return any(row[1] == name for row in con.execute(f"PRAGMA table_info({table})"))


def add_job_lang(con: sqlite3.Connection) -> None:
    if has_column(con, "jobs", "lang"):
        print("- jobs.lang: sudah ada, dilewati")
        return
    # Dibiarkan NULL: job lama semuanya fetch/transcribe yang memang tidak punya
    # bahasa tujuan. Mengisinya dengan apa pun akan mengarang fakta.
    con.execute("ALTER TABLE jobs ADD COLUMN lang TEXT")
    print("+ jobs.lang: ditambahkan (NULL untuk job lama — mereka bukan job terjemahan)")


def main() -> None:
    db = settings.data_dir / "transkrip.db"
    if not db.exists():
        print(f"DB belum ada di {db} — tidak perlu migrasi.")
        return
    con = sqlite3.connect(db)
    con.execute(TABLE)
    con.execute(INDEX)
    print("+ segment_translations + indeks uniknya: siap")
    add_job_lang(con)
    con.commit()
    con.close()
    print(f"Selesai: {db}")


main()
