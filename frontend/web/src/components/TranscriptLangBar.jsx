// Pemilih bahasa TRANSKRIP — pemilih ketiga di aplikasi ini, dan yang paling
// mudah tertukar. Bedanya:
//   sidebar kiri  : bahasa apa yang DIDENGARKAN mesin transkrip
//   panel tengah  : bahasa TULISAN ringkasan & chat
//   yang ini      : bahasa transkrip yang sedang DITAMPILKAN
// Hanya yang ini yang menghasilkan salinan transkrip, dan karena itu satu-satunya
// yang punya tombol dan progres.
import { langLabel } from '../utils'

export const ASLI = 'asli'

export default function TranscriptLangBar({
  languages, source, value, trans, busy, error, onChange, onTranslate,
}) {
  const pilihan = (languages ?? []).filter((l) => l.id !== source)
  if (!pilihan.length) return null
  return (
    <div className="mb-3 flex flex-wrap items-center gap-2 border-b border-edge pb-3">
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        title="Bahasa transkrip yang ditampilkan — bukan bahasa ringkasan/chat"
        aria-label="Bahasa transkrip"
        className="rounded-md border border-edge bg-panel2 px-2 py-1 text-[11px] text-fg2 transition hover:border-edge2 hover:text-fg"
      >
        <option value={ASLI}>Asli{source ? ` (${langLabel(source, languages)})` : ''}</option>
        {pilihan.map((l) => (
          <option key={l.id} value={l.id}>{l.label}</option>
        ))}
      </select>
      <Status value={value} trans={trans} busy={busy} onTranslate={onTranslate} />
      {error && <span className="text-[11px] text-red-400">{error}</span>}
    </div>
  )
}

// Empat keadaan, dan tak satu pun boleh tampil sebagai layar kosong: belum
// diminta, sedang berjalan, gagal, dan selesai.
function Status({ value, trans, busy, onTranslate }) {
  if (value === ASLI) return null
  if (trans?.status === 'translating' || trans?.status === 'queued' || busy)
    return <span className="text-[11px] text-fg3">Menerjemahkan… {trans?.progress ?? 0}%</span>
  if (trans?.status === 'failed')
    return (
      <>
        <span className="text-[11px] text-red-400">Gagal: {trans.error ?? 'tidak diketahui'}</span>
        <Button onClick={onTranslate}>Coba lagi</Button>
      </>
    )
  if (trans?.segments?.length)
    return <span className="text-[11px] text-fg3">{trans.segments.length} segmen diterjemahkan</span>
  return <Button onClick={onTranslate}>Terjemahkan</Button>
}

function Button({ children, onClick }) {
  return (
    <button
      onClick={onClick}
      className="rounded-md border border-mint/40 px-2 py-1 text-[11px] font-semibold text-mint transition hover:bg-mint/10"
    >
      {children}
    </button>
  )
}
