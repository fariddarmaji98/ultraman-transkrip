import { exportUrl } from '../api'

const FORMATS = ['txt', 'srt', 'json']

export default function TranscriptHeader({ rec }) {
  return (
    <div className="mb-4 flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 pb-3.5">
      <h2 className="m-0 text-lg font-semibold">{rec.title}</h2>
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
    </div>
  )
}
