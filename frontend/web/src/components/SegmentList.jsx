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
          {s.asli === undefined ? (
            <span className="leading-relaxed text-fg2">{s.text}</span>
          ) : (
            // Mode banding: terjemahan di kiri, asli di kanan dengan warna
            // lebih redup supaya jelas mana yang sedang dibaca. Membungkus
            // sendiri di kolom sempit — panelnya bisa digeser sampai 900px.
            <span className="flex min-w-0 flex-1 flex-wrap gap-x-4 gap-y-1">
              <span className="min-w-[10rem] flex-1 leading-relaxed text-fg2">{s.text}</span>
              <span className="min-w-[10rem] flex-1 leading-relaxed text-fg3">{s.asli}</span>
            </span>
          )}
        </li>
      ))}
    </ol>
  )
}
