// Status rekaman sebagai ikon (tooltip menampilkan labelnya).
import Icon from './Icon'

const META = {
  downloading: { label: 'Mengunduh video', color: 'text-sky-400', icon: 'spinner' },
  downloaded: { label: 'Terunduh — belum ditranskrip', color: 'text-sky-400', icon: 'download' },
  queued: { label: 'Antre', color: 'text-amber-400', icon: 'clock' },
  extracting: { label: 'Mengekstrak audio', color: 'text-amber-400', icon: 'spinner' },
  transcribing: { label: 'Mentranskripsi', color: 'text-mint', icon: 'spinner' },
  paused: { label: 'Dijeda', color: 'text-amber-400', icon: 'pause' },
  done: { label: 'Selesai', color: 'text-mint', icon: 'check-circle' },
  failed: { label: 'Gagal', color: 'text-red-400', icon: 'alert' },
}

export default function StatusBadge({ status }) {
  const meta = META[status] ?? { label: status, color: 'text-fg3', icon: 'clock' }
  return (
    <span
      className={`inline-flex ${meta.color}`}
      title={meta.label}
      role="img"
      aria-label={meta.label}
    >
      <Icon name={meta.icon} />
    </span>
  )
}
