import { fmtTime } from '../utils'

export default function SegmentList({ segments, activeIdx, onSeek }) {
  if (!segments.length)
    return <p className="text-slate-500">Transkrip kosong.</p>

  return (
    <ol className="flex list-none flex-col gap-0.5 p-0">
      {segments.map((s) => (
        <li
          key={s.idx}
          onClick={() => onSeek(s.start_ms)}
          className={`flex cursor-pointer gap-3.5 rounded-lg px-3 py-2.5 transition ${
            s.idx === activeIdx ? 'bg-indigo-50' : 'hover:bg-slate-50'
          }`}
        >
          <span className="min-w-[44px] shrink-0 pt-0.5 text-sm tabular-nums text-indigo-600">
            {fmtTime(s.start_ms)}
          </span>
          <span className="leading-relaxed">{s.text}</span>
        </li>
      ))}
    </ol>
  )
}
