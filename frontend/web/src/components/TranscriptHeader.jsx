import { useState } from 'react'
import { exportUrl, renameRecording } from '../api'
import { fmtTime } from '../utils'

const FORMATS = ['txt', 'srt', 'json']

export default function TranscriptHeader({ rec, onTitleChange, onClose }) {
  return (
    <div className="sticky top-0 z-10 flex items-start justify-between gap-3 border-b border-edge bg-panel/80 px-6 py-4 backdrop-blur">
      <div className="min-w-0">
        <EditableTitle rec={rec} onTitleChange={onTitleChange} />
        <p className="mt-0.5 truncate text-xs text-fg3">
          {rec.source_filename}
          {rec.duration_ms ? ` · ${fmtTime(rec.duration_ms)}` : ''}
          {rec.language !== 'auto' ? ` · ${rec.language}` : ''}
        </p>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        {rec.status === 'done' && <ExportLinks rec={rec} />}
        {onClose && (
          <button
            onClick={onClose}
            title="Tutup"
            aria-label="Tutup"
            className="rounded-lg border border-edge p-1.5 text-fg3 transition hover:border-edge2 hover:text-fg"
          >
            <CloseIcon />
          </button>
        )}
      </div>
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

function ExportLinks({ rec }) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-xs text-fg3">Ekspor</span>
      {FORMATS.map((f) => (
        <a
          key={f}
          href={exportUrl(rec.id, f)}
          className="rounded-md border border-edge px-2.5 py-1 text-xs font-semibold text-mint transition hover:bg-mint/10"
        >
          {f.toUpperCase()}
        </a>
      ))}
    </div>
  )
}

function CloseIcon() {
  return (
    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d="M6 6l12 12M18 6 6 18" />
    </svg>
  )
}
