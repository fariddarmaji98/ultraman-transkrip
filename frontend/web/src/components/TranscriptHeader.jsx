import { exportUrl } from '../api'
import { fmtTime } from '../utils'

const FORMATS = ['txt', 'srt', 'json']

export default function TranscriptHeader({ rec }) {
  return (
    <div className="mb-4 flex flex-wrap items-start justify-between gap-3 border-b border-slate-200 pb-3.5">
      <div className="min-w-0">
        <h2 className="m-0 truncate text-lg font-semibold">{rec.title}</h2>
        <p className="mt-0.5 truncate text-sm text-slate-500">
          {rec.source_filename}
          {rec.duration_ms ? ` · ${fmtTime(rec.duration_ms)}` : ''}
          {rec.language !== 'auto' ? ` · ${rec.language}` : ''}
        </p>
      </div>
      {rec.status === 'done' && (
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
      )}
    </div>
  )
}
