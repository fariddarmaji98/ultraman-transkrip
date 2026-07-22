// Baris tab generik. Dipakai sidebar (Transkrip/Unduh) dan kolom AI
// (Ringkasan/Chat) — satu komponen supaya keduanya tidak pelan-pelan
// berbeda rupa seperti sepasang komponen kembar.
export default function TabBar({ tabs, active, onChange }) {
  return (
    <div className="flex shrink-0 gap-1 border-b border-edge px-3" role="tablist">
      {tabs.map((t) => (
        <Tab
          key={t.id}
          label={t.label}
          count={t.count ?? 0}
          selected={t.id === active}
          onClick={() => onChange(t.id)}
        />
      ))}
    </div>
  )
}

function Tab({ label, count, selected, onClick }) {
  const tone = selected
    ? 'border-mint text-fg'
    : 'border-transparent text-fg3 hover:text-fg2'
  return (
    <button
      role="tab"
      aria-selected={selected}
      onClick={onClick}
      className={`-mb-px flex items-center gap-1.5 border-b-2 px-3 py-2.5 text-xs font-semibold transition ${tone}`}
    >
      {label}
      {count > 0 && (
        <span className="rounded-full bg-edge px-1.5 py-px text-[10px] font-medium text-fg3">
          {count}
        </span>
      )}
    </button>
  )
}
