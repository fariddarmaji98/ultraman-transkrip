const LABELS = {
  queued: 'antre',
  extracting: 'ekstraksi',
  transcribing: 'transkrip',
  done: 'selesai',
  failed: 'gagal',
}

export default function StatusBadge({ status }) {
  return <span className={`badge badge-${status}`}>{LABELS[status] ?? status}</span>
}
