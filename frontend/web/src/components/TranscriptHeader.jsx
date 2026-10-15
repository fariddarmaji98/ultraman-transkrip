import { useState } from 'react'
import { exportUrl, renameRecording } from '../api'
import { fmtTime, recLang } from '../utils'
import Icon from './Icon'
import TranscriptLangBar, { ASLI } from './TranscriptLangBar'

const FORMATS = ['txt', 'srt', 'json']

const REDO_OK = ['done', 'failed']

export default function TranscriptHeader({
  rec, languages, tlang, source, trans, tError, onTitleChange, onRetranscribe,
  onTlang, onTranslate, banding, onBanding, onClose, ...rest
}) {
  const lang = recLang(rec, languages)
  return (
    <div {...rest} data-test="transcript-header" className="sticky top-0 z-10 border-b border-edge bg-panel/80 px-6 py-4 backdrop-blur">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <EditableTitle rec={rec} onTitleChange={onTitleChange} />
          <p className="mt-0.5 truncate text-xs text-fg3">
            {rec.source_filename}
            {rec.duration_ms ? ` · ${fmtTime(rec.duration_ms)}` : ''}
            {lang ? ` · ${lang}` : ''}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {REDO_OK.includes(rec.status) && onRetranscribe && (
            <button
              data-test="btn-retranscribe"
              onClick={onRetranscribe}
              title="Jalankan ulang transkrip (mis. setelah ganti model)"
              className="rounded-md border border-edge px-2.5 py-1 text-xs font-medium text-fg2 transition hover:border-edge2 hover:text-fg"
            >
              Transkrip ulang
            </button>
          )}
          {rec.status === 'done' && <ExportLinks rec={rec} tlang={tlang === ASLI ? undefined : tlang} />}
          {onClose && (
            <button
              data-test="btn-close-transcript"
              onClick={onClose}
              title="Tutup"
              aria-label="Tutup"
              className="rounded-lg border border-edge p-1.5 text-fg3 transition hover:border-edge2 hover:text-fg"
            >
              <Icon name="close" />
            </button>
          )}
        </div>
      </div>
      {/* Bilah bahasa ikut menempel di header, bukan di dalam area gulir: pilihan
          bahasa dan tombol terjemah harus tetap terjangkau setelah transkrip
          digulir jauh ke bawah. */}
      {rec.status === 'done' && rec.segments?.length > 0 && (
        <TranscriptLangBar
          languages={languages}
          source={source}
          value={tlang}
          trans={trans}
          error={tError}
          banding={banding}
          onChange={onTlang}
          onTranslate={onTranslate}
          onBanding={onBanding}
        />
      )}
    </div>
  )
}

function EditableTitle({ rec, onTitleChange }) {
  const [editing, setEditing] = useState(false)
  const [value, setValue] = useState(rec.title)

  async function save() {
    setEditing(false)
    const title = value.trim()
    if (title && title !== rec.title) {
      await renameRecording(rec.id, title)
      onTitleChange?.(title)
    }
  }

  if (editing)
    return (
      <input
        data-test="title-input"
        autoFocus
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onBlur={save}
        onKeyDown={(e) => e.key === 'Enter' && e.target.blur()}
        className="w-full rounded border border-mint/50 bg-panel2 px-1.5 py-0.5 text-lg font-semibold text-fg outline-none"
      />
    )
  return (
    <h2
      data-test="title-display"
      onClick={() => {
        setValue(rec.title)
        setEditing(true)
      }}
      title="Klik untuk ubah judul"
      className="m-0 cursor-text truncate text-lg font-semibold text-fg transition hover:text-mint"
    >
      {rec.title}
    </h2>
  )
}

// Ekspor mengikuti bahasa yang sedang DITAMPILKAN. Mengunduh transkrip asli
// sementara layar menunjukkan terjemahan adalah kejutan yang tidak perlu.
function ExportLinks({ rec, tlang }) {
  return (
    <div data-test="export-links" className="flex items-center gap-2">
      <span className="text-xs text-fg3">Ekspor</span>
      {FORMATS.map((f) => (
        <a
          key={f}
          data-test={`export-${f}`}
          href={exportUrl(rec.id, f, tlang)}
          className="rounded-md border border-edge px-2.5 py-1 text-xs font-semibold text-mint transition hover:bg-mint/10"
        >
          {f.toUpperCase()}
        </a>
      ))}
      {/* Brief = ekstraksi terstruktur (ADR 0013). Bahasanya BUKAN tlang:
          brief milik extract per bahasa AI (default id), bukan terjemahan
          transkrip — tlang kosong/ASLI pun brief tetap pakai bahasa extract. */}
      {rec.extract && (
        <a
          data-test="export-brief"
          href={exportUrl(rec.id, 'brief', undefined)}
          title="Context terstruktur: keputusan, kebutuhan, batasan, pertanyaan terbuka — bersitasi menit"
          className="rounded-md border border-mint/40 px-2.5 py-1 text-xs font-semibold text-mint transition hover:bg-mint/10"
        >
          BRIEF
        </a>
      )}
    </div>
  )
}
