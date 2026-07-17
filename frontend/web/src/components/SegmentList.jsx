import { fmtTime } from '../utils'

export default function SegmentList({ segments, activeIdx, onSeek }) {
  if (!segments.length) return <p className="muted">Transkrip kosong.</p>

  return (
    <ol className="segments">
      {segments.map((s) => (
        <li
          key={s.idx}
          className={s.idx === activeIdx ? 'seg active' : 'seg'}
          onClick={() => onSeek(s.start_ms)}
        >
          <span className="ts">{fmtTime(s.start_ms)}</span>
          <span className="txt">{s.text}</span>
        </li>
      ))}
    </ol>
  )
}
