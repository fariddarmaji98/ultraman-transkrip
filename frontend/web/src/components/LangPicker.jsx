// Pemilih bahasa KELUARAN AI — ringkasan dan chat. Berbeda maksud dari pemilih
// bahasa di panel unggah (sidebar kiri), yang menentukan bahasa apa yang
// didengarkan mesin transkrip. Yang ini tidak menyentuh transkrip sama sekali.
export default function LangPicker({ languages, value, onChange, title }) {
  if (!languages?.length) return null
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      title={title ?? 'Bahasa ringkasan & chat — bukan bahasa transkrip'}
      aria-label="Bahasa keluaran AI"
      className="rounded-md border border-edge bg-panel2 px-2 py-1 text-[11px] text-fg2 transition hover:border-edge2 hover:text-fg"
    >
      {languages.map((l) => (
        <option key={l.id} value={l.id}>{l.label}</option>
      ))}
    </select>
  )
}
