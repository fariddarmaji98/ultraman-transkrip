// Teks jawaban dengan sitasi [mm:ss] yang bisa diklik untuk melompatkan player.
// Model kadang menulis rentang ([20:24-20:35]) — keduanya ditangani, dan yang
// dipakai untuk melompat adalah waktu pertama.
const CITE = /\[(\d{1,2}):(\d{2})(?:\s*[-–—]\s*\d{1,2}:\d{2})?\]/g

export default function CitedText({ text, maxMs, onSeek }) {
  return (
    <span className="whitespace-pre-wrap">
      {split(text).map((part, i) => (
        <Piece key={i} part={part} maxMs={maxMs} onSeek={onSeek} />
      ))}
    </span>
  )
}

// Sitasi di luar durasi rekaman berarti model mengarang menitnya — jangan
// tawarkan diklik, karena melompat ke sana tidak ada artinya.
function Piece({ part, maxMs, onSeek }) {
  if (part.ms === undefined) return <span>{part.text}</span>
  const valid = !maxMs || part.ms <= maxMs
  if (!valid)
    return (
      <span title="Menit ini tidak ada di rekaman" className="mx-0.5 font-mono text-[10px] text-fg3 line-through">
        {part.text.slice(1, -1)}
      </span>
    )
  return (
    <button
      onClick={() => onSeek?.(part.ms)}
      title="Putar dari menit ini"
      className="mx-0.5 rounded border border-mint/40 px-1 font-mono text-[10px] text-mint transition hover:bg-mint/10"
    >
      {part.text.slice(1, -1)}
    </button>
  )
}

function split(text) {
  const parts = []
  let last = 0
  for (const m of (text ?? '').matchAll(CITE)) {
    if (m.index > last) parts.push({ text: text.slice(last, m.index) })
    parts.push({ text: m[0], ms: (Number(m[1]) * 60 + Number(m[2])) * 1000 })
    last = m.index + m[0].length
  }
  if (last < (text ?? '').length) parts.push({ text: text.slice(last) })
  return parts
}
