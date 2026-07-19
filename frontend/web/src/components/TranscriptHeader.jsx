import { useState } from 'react'
import { exportUrl, renameRecording } from '../api'
import { fmtTime } from '../utils'

const FORMATS = ['txt', 'srt', 'json']

export default function TranscriptHeader({ rec, onTitleChange }) {
  return (
    <div className="mb-4 flex flex-wrap items-start justify-between gap-3 border-b border-slate-200 pb-3.5">
      <div className="min-w-0">
        <EditableTitle rec={rec} onTitleChange={onTitleChange} />
        <p className="mt-0.5 truncate text-sm text-slate-500">
          {rec.source_filename}
          {rec.duration_ms ? ` · ${fmtTime(rec.duration_ms)}` : ''}
          {rec.language !== 'auto' ? ` · ${rec.language}` : ''}
        </p>
      </div>
      {rec.status === 'done' && <ExportLinks rec={rec} />}
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
        className="w-full rounded border border-indigo-300 px-1.5 py-0.5 text-lg font-semibold outline-none"
      />
    )
  return (
    <h2
      onClick={() => {
        setValue(rec.title)
        setEditing(true)
      }}
      title="Klik untuk ubah judul"
      className="m-0 cursor-text truncate text-lg font-semibold hover:text-indigo-600"
    >
      {rec.title}
    </h2>
  )
}

function ExportLinks({ rec }) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-sm text-slate-500">Ekspor:</span>
      {FORMATS.map((f) => (
        <a
          key={f}
          href={exportUrl(rec.id, f)}
          className="rounded-md border border-slate-200 px-2.5 py-1 text-xs font-semibold text-indigo-600 no-underline transition hover:bg-indigo-50"
        >
          {f.toUpperCase()}
        </a>
      ))}
    </div>
  )
}
