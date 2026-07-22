// Pemakaian disk folder unggahan. Video hasil unduhan tidak dihapus otomatis —
// angka ini yang membuat masalahnya kelihatan sebelum disk penuh.
import SectionLabel from './SectionLabel'
import { fmtBytes } from '../utils'

export default function StorageInfo({ storage }) {
  if (!storage) return null
  return (
    <div className="rounded-xl border border-edge bg-panel2 p-3">
      <SectionLabel>Penyimpanan</SectionLabel>
      <Row label="Berkas tersimpan" value={`${storage.files} file`} />
      <Row label="Terpakai" value={fmtBytes(storage.used_bytes)} />
      <Row label="Sisa disk" value={fmtBytes(storage.free_bytes)} />
      <p className="mt-2 text-[10px] leading-relaxed text-fg3">
        Tidak ada penghapusan otomatis — hapus video yang tak terpakai bila disk menipis.
      </p>
    </div>
  )
}

function Row({ label, value }) {
  return (
    <div className="flex items-center justify-between gap-2 py-0.5 text-xs">
      <span className="text-fg3">{label}</span>
      <span className="text-fg2 tabular-nums">{value}</span>
    </div>
  )
}
