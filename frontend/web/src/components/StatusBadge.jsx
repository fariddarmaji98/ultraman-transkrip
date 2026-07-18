const LABELS = {
  queued: 'antre',
  extracting: 'ekstraksi',
  transcribing: 'transkrip',
  done: 'selesai',
  failed: 'gagal',
}

const STYLES = {
  done: 'bg-emerald-50 text-emerald-600',
  failed: 'bg-red-50 text-red-600',
  queued: 'bg-amber-50 text-amber-700',
  extracting: 'bg-amber-50 text-amber-700',
  transcribing: 'bg-amber-50 text-amber-700',
}

export default function StatusBadge({ status }) {
  const style = STYLES[status] ?? 'bg-slate-100 text-slate-600'
  return (
    <span
      className={`self-start rounded-full px-2 py-0.5 text-[0.68rem] font-semibold uppercase tracking-wide ${style}`}
    >
      {LABELS[status] ?? status}
    </span>
  )
}
