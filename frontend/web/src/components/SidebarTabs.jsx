// Pemisah dua bagian sidebar: transkrip (unggah) vs unduh (dari URL).
const TABS = [
  ['transkrip', 'Transkrip'],
  ['unduh', 'Unduh'],
]

export default function SidebarTabs({ active, counts, onChange }) {
  return (
    <div className="flex gap-1 border-b border-edge px-3" role="tablist">
      {TABS.map(([id, label]) => (
        <Tab
          key={id}
          label={label}
          count={counts?.[id] ?? 0}
          selected={id === active}
          onClick={() => onChange(id)}
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
