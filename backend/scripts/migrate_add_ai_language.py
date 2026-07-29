"""Migrasi sekali-jalan: kolom `lang` di `summaries` & `chat_messages`.

Baris lama diisi `DEFAULT_AI_LANGUAGE`, BUKAN `detected_language`. Rencana awal
menyebut yang kedua, tapi itu mustahil: `detected_language` baru lahir dan NULL
untuk semua rekaman lama. Yang benar justru lebih sederhana — prompt lama memaksa
bahasa Indonesia, jadi ringkasan dan chat yang tersimpan MEMANG berbahasa itu.

Indeks unik dibuat setelah backfill, dan hanya bila tidak ada duplikat: SQLite
tidak bisa ADD CONSTRAINT, jadi keunikan ditegakkan lewat CREATE UNIQUE INDEX.

Aman dijalankan berulang. Jalankan dari folder `backend/`:
    .venv\\Scripts\\python.exe scripts/migrate_add_ai_language.py
"""
import sqlite3
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from app.config import settings  # noqa: E402
from constants import DEFAULT_AI_LANGUAGE  # noqa: E402

TABLES = ("summaries", "chat_messages")
INDEX = "uq_summary_recording_lang"


def has_column(con: sqlite3.Connection, table: str, name: str) -> bool:
    return any(row[1] == name for row in con.execute(f"PRAGMA table_info({table})"))


def add_lang(con: sqlite3.Connection, table: str) -> None:
    if has_column(con, table, "lang"):
        print(f"- {table}.lang: sudah ada, dilewati")
        return
    con.execute(f"ALTER TABLE {table} ADD COLUMN lang TEXT")
    n = con.execute(
        f"UPDATE {table} SET lang = ? WHERE lang IS NULL", (DEFAULT_AI_LANGUAGE,)
    ).rowcount
    print(f"+ {table}.lang: ditambahkan, {n} baris lama diisi '{DEFAULT_AI_LANGUAGE}'")


def add_unique_index(con: sqlite3.Connection) -> None:
    dup = con.execute(
        "SELECT recording_id, lang, COUNT(*) c FROM summaries "
        "GROUP BY recording_id, lang HAVING c > 1"
    ).fetchall()
    if dup:
        # Berhenti dan katakan: membuat indeks unik akan gagal, dan memilih
        # sendiri baris mana yang dibuang bukan keputusan skrip migrasi.
        print(f"! ada {len(dup)} pasangan ganda di summaries — indeks unik dilewati")
        return
    con.execute(f"CREATE UNIQUE INDEX IF NOT EXISTS {INDEX} ON summaries(recording_id, lang)")
    print(f"+ indeks unik {INDEX}: siap")


def main() -> None:
    db = settings.data_dir / "transkrip.db"
    if not db.exists():
        print(f"DB belum ada di {db} — tidak perlu migrasi.")
        return
    con = sqlite3.connect(db)
    for table in TABLES:
        add_lang(con, table)
    add_unique_index(con)
    con.commit()
    con.close()
    print(f"Selesai: {db}")


main()
