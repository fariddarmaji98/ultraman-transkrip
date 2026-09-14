"""Skema data: recordings, jobs, segments. `speaker` nullable (diisi saat diarization M4)."""
from datetime import datetime, timezone

from sqlalchemy import ForeignKey, String, Text, UniqueConstraint
from sqlalchemy.orm import (
    DeclarativeBase,
    Mapped,
    mapped_column,
    relationship,
)

from constants import DEFAULT_AI_LANGUAGE, JOB_QUEUED, LANGUAGE_AUTO, SOURCE_UPLOAD


def _now() -> datetime:
    return datetime.now(timezone.utc)


class Base(DeclarativeBase):
    pass


class Recording(Base):
    __tablename__ = "recordings"

    id: Mapped[int] = mapped_column(primary_key=True)
    title: Mapped[str] = mapped_column(String(255))
    source_filename: Mapped[str] = mapped_column(String(255))
    source_kind: Mapped[str] = mapped_column(String(8), default=SOURCE_UPLOAD)
    source_url: Mapped[str | None] = mapped_column(String(1024), default=None)
    meeting_platform: Mapped[str | None] = mapped_column(String(16), default=None)
    # Kapabilitas satu sesi rekaman, bukan auth: dipegang ekstensi supaya
    # tidak sembarang pemanggil bisa menyuntik potongan ke sesi orang.
    # Disimpan di DB (bukan memori) agar sesi selamat saat backend restart.
    upload_token: Mapped[str | None] = mapped_column(String(64), default=None)
    upload_path: Mapped[str] = mapped_column(String(512))
    media_path: Mapped[str | None] = mapped_column(String(512), default=None)
    duration_ms: Mapped[int | None] = mapped_column(default=None)
    language: Mapped[str] = mapped_column(String(16), default=LANGUAGE_AUTO)
    # `language` = yang DIMINTA; ini yang benar-benar TERDENGAR, diisi saat
    # transkrip selesai dan hanya pada permintaan "auto". Nullable karena
    # rekaman lama, yang belum ditranskrip, dan yang bahasanya dipilih manual
    # memang tidak punya hasil deteksi — jangan ditebak.
    detected_language: Mapped[str | None] = mapped_column(String(16), default=None)
    status: Mapped[str] = mapped_column(String(16), default=JOB_QUEUED)
    created_at: Mapped[datetime] = mapped_column(default=_now)

    segments: Mapped[list["Segment"]] = relationship(
        back_populates="recording", cascade="all, delete-orphan"
    )
    jobs: Mapped[list["Job"]] = relationship(
        back_populates="recording", cascade="all, delete-orphan"
    )
    summaries: Mapped[list["Summary"]] = relationship(
        back_populates="recording", cascade="all, delete-orphan"
    )
    chat: Mapped[list["ChatMessage"]] = relationship(
        back_populates="recording", cascade="all, delete-orphan"
    )
    translations: Mapped[list["SegmentTranslation"]] = relationship(
        back_populates="recording", cascade="all, delete-orphan"
    )
    extracts: Mapped[list["RecordingExtract"]] = relationship(
        back_populates="recording", cascade="all, delete-orphan"
    )


class Job(Base):
    __tablename__ = "jobs"

    id: Mapped[int] = mapped_column(primary_key=True)
    recording_id: Mapped[int] = mapped_column(ForeignKey("recordings.id"))
    kind: Mapped[str] = mapped_column(String(16), default="transcribe")
    # Bahasa tujuan, hanya terisi pada job `translate`. Disimpan di DB, bukan
    # dititipkan ke antrean, supaya job yang di-requeue setelah restart tahu
    # bahasa mana yang sedang dikerjakannya.
    lang: Mapped[str | None] = mapped_column(String(16), default=None)
    status: Mapped[str] = mapped_column(String(16), default=JOB_QUEUED)
    progress: Mapped[int] = mapped_column(default=0)
    error: Mapped[str | None] = mapped_column(Text, default=None)
    created_at: Mapped[datetime] = mapped_column(default=_now)

    recording: Mapped["Recording"] = relationship(back_populates="jobs")


class Summary(Base):
    """Ringkasan AI. Satu per recording PER BAHASA — dibuat ulang = baris lama diganti.

    Provider & model ikut dicatat: hasil dari mesin berbeda tidak sebanding,
    dan tanpa jejak ini tidak ada cara tahu ringkasan lama dibuat oleh apa.

    `lang` = bahasa TULISAN ringkasannya, bukan bahasa rekamannya. Ringkasan
    berbahasa Jepang atas rekaman Indonesia lahir langsung dari transkrip asli
    dalam satu panggilan, jadi kolom ini tidak pernah berarti "hasil terjemahan".
    """

    __tablename__ = "summaries"
    # Unik supaya "buat ulang" punya satu baris jelas untuk diganti. Tanpa ini,
    # dua klik beruntun menumpuk dua ringkasan untuk bahasa yang sama dan yang
    # tampil jadi bergantung urutan baris.
    __table_args__ = (
        UniqueConstraint("recording_id", "lang", name="uq_summary_recording_lang"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    recording_id: Mapped[int] = mapped_column(ForeignKey("recordings.id"))
    lang: Mapped[str] = mapped_column(String(16), default=DEFAULT_AI_LANGUAGE)
    text: Mapped[str] = mapped_column(Text)
    provider: Mapped[str] = mapped_column(String(32))
    model: Mapped[str] = mapped_column(String(64))
    created_at: Mapped[datetime] = mapped_column(default=_now)

    recording: Mapped["Recording"] = relationship(back_populates="summaries")


class ChatMessage(Base):
    """Satu pesan dalam percakapan tentang satu rekaman.

    Disimpan supaya percakapan tidak hilang saat pindah rekaman atau reload —
    ini bagian dari "second brain", bukan sesi sekali pakai. `provider`/`model`
    hanya terisi pada balasan asisten (jejak mesin yang menjawab).
    """

    __tablename__ = "chat_messages"

    id: Mapped[int] = mapped_column(primary_key=True)
    recording_id: Mapped[int] = mapped_column(ForeignKey("recordings.id"))
    # Utas percakapan dipisah per bahasa: pertanyaan Jepang dan jawabannya tidak
    # bermakna sebagai riwayat bagi percakapan berbahasa Indonesia. Ikut terisi
    # pada baris `user` supaya satu utas bisa diambil dengan satu WHERE.
    lang: Mapped[str] = mapped_column(String(16), default=DEFAULT_AI_LANGUAGE)
    role: Mapped[str] = mapped_column(String(16))  # user | assistant
    text: Mapped[str] = mapped_column(Text)
    provider: Mapped[str | None] = mapped_column(String(32), default=None)
    model: Mapped[str | None] = mapped_column(String(64), default=None)
    created_at: Mapped[datetime] = mapped_column(default=_now)

    recording: Mapped["Recording"] = relationship(back_populates="chat")


class RecordingExtract(Base):
    """Ekstraksi terstruktur transkrip (ADR 0013): context untuk membangun project.

    `data` = JSON tervalidasi dengan empat kategori (`decisions`, `requirements`,
    `constraints`, `open_questions`), tiap item `{text, at_ms}`. Disimpan sebagai
    Teks, bukan tabel anak, karena item tidak pernah di-query terpisah dari
    rekamannya — normalisasi hanya menambah migrasi & join tanpa pemakai.

    `lang` = bahasa TULISAN hasil ekstraksi (pola `summaries`), unik per
    `(recording_id, lang)` supaya "buat ulang" menimpa baris yang jelas.
    """

    __tablename__ = "recording_extracts"
    __table_args__ = (
        UniqueConstraint("recording_id", "lang", name="uq_extract_recording_lang"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    recording_id: Mapped[int] = mapped_column(ForeignKey("recordings.id"))
    lang: Mapped[str] = mapped_column(String(16), default=DEFAULT_AI_LANGUAGE)
    data: Mapped[str] = mapped_column(Text)
    provider: Mapped[str] = mapped_column(String(32))
    model: Mapped[str] = mapped_column(String(64))
    created_at: Mapped[datetime] = mapped_column(default=_now)

    recording: Mapped["Recording"] = relationship(back_populates="extracts")


class SegmentTranslation(Base):
    """Terjemahan satu segmen. Tabel terpisah, bukan kolom di `segments`.

    Alasannya: jumlah bahasanya terbuka, dan `segments` dihapus-lalu-ditulis-ulang
    setiap transkrip ulang. Menaruh terjemahan di sana berarti kehilangan
    semuanya tiap kali model ASR diganti.

    `idx` menunjuk `Segment.idx` pada rekaman yang sama — timestamp tidak
    disalin, supaya tidak ada dua sumber kebenaran untuk waktu yang sama.
    """

    __tablename__ = "segment_translations"
    __table_args__ = (
        UniqueConstraint("recording_id", "lang", "idx", name="uq_segtrans_rec_lang_idx"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    recording_id: Mapped[int] = mapped_column(ForeignKey("recordings.id"))
    lang: Mapped[str] = mapped_column(String(16))
    idx: Mapped[int] = mapped_column()
    text: Mapped[str] = mapped_column(Text)

    recording: Mapped["Recording"] = relationship(back_populates="translations")


class Segment(Base):
    __tablename__ = "segments"

    id: Mapped[int] = mapped_column(primary_key=True)
    recording_id: Mapped[int] = mapped_column(ForeignKey("recordings.id"))
    idx: Mapped[int] = mapped_column()
    start_ms: Mapped[int] = mapped_column()
    end_ms: Mapped[int] = mapped_column()
    text: Mapped[str] = mapped_column(Text)
    speaker: Mapped[str | None] = mapped_column(String(64), default=None)

    recording: Mapped["Recording"] = relationship(back_populates="segments")
