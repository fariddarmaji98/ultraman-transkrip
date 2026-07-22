import { fmtTime } from '../utils'

export default function SegmentList({ segments, activeIdx, onSeek }) {
  if (!segments.length)
    return <p className="text-fg3">Transkrip kosong.</p>

  return (
    <ol className="flex list-none flex-col gap-0.5 p-0">
      {segments.map((s, pos) => (
        <li
          key={s.idx}
          data-pos={pos}
          onClick={() => onSeek(s.start_ms)}
          className={`flex cursor-pointer gap-4 rounded-lg px-3 py-2.5 transition ${
            s.idx === activeIdx ? 'bg-mint/10' : 'hover:bg-panel2'
          }`}
        >
          <span className="min-w-[48px] shrink-0 pt-0.5 text-sm tabular-nums text-mint">
            {fmtTime(s.start_ms)}
          </span>
          <span className="leading-relaxed text-fg2">{s.text}</span>
        </li>
      ))}
    </ol>
  )
}
