// Status rekaman sebagai ikon (tooltip menampilkan labelnya).
const META = {
  downloading: { label: 'Mengunduh video', color: 'text-sky-400', Icon: SpinnerIcon },
  downloaded: { label: 'Terunduh — belum ditranskrip', color: 'text-sky-400', Icon: DownloadIcon },
  queued: { label: 'Antre', color: 'text-amber-400', Icon: ClockIcon },
  extracting: { label: 'Mengekstrak audio', color: 'text-amber-400', Icon: SpinnerIcon },
  transcribing: { label: 'Mentranskripsi', color: 'text-mint', Icon: SpinnerIcon },
  done: { label: 'Selesai', color: 'text-mint', Icon: CheckIcon },
  failed: { label: 'Gagal', color: 'text-red-400', Icon: AlertIcon },
}

export default function StatusBadge({ status }) {
  const meta = META[status] ?? { label: status, color: 'text-fg3', Icon: ClockIcon }
  const { Icon } = meta
  return (
    <span
      className={`inline-flex ${meta.color}`}
      title={meta.label}
      role="img"
      aria-label={meta.label}
    >
      <Icon />
    </span>
  )
}

function CheckIcon() {
  return (
    <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
      <path
        fillRule="evenodd"
        d="M10 18a8 8 0 1 0 0-16 8 8 0 0 0 0 16Zm3.857-9.809a.75.75 0 0 0-1.214-.882l-3.483 4.79-1.88-1.88a.75.75 0 1 0-1.06 1.061l2.5 2.5a.75.75 0 0 0 1.137-.089l4-5.5Z"
        clipRule="evenodd"
      />
    </svg>
  )
}

function AlertIcon() {
  return (
    <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
      <path
        fillRule="evenodd"
        d="M18 10A8 8 0 1 1 2 10a8 8 0 0 1 16 0Zm-8-5a.75.75 0 0 1 .75.75v4.5a.75.75 0 0 1-1.5 0v-4.5A.75.75 0 0 1 10 5Zm0 10a1 1 0 1 0 0-2 1 1 0 0 0 0 2Z"
        clipRule="evenodd"
      />
    </svg>
  )
}

function DownloadIcon() {
  return (
    <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
      <path
        fillRule="evenodd"
        d="M10 2a.75.75 0 0 1 .75.75v7.19l2.22-2.22a.75.75 0 1 1 1.06 1.06l-3.5 3.5a.75.75 0 0 1-1.06 0l-3.5-3.5a.75.75 0 0 1 1.06-1.06l2.22 2.22V2.75A.75.75 0 0 1 10 2ZM3.5 14a.75.75 0 0 1 .75.75v1.5h11.5v-1.5a.75.75 0 0 1 1.5 0v2.25a.75.75 0 0 1-.75.75H3.5a.75.75 0 0 1-.75-.75v-2.25A.75.75 0 0 1 3.5 14Z"
        clipRule="evenodd"
      />
    </svg>
  )
}

function ClockIcon() {
  return (
    <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
      <path
        fillRule="evenodd"
        d="M10 18a8 8 0 1 0 0-16 8 8 0 0 0 0 16Zm.75-13a.75.75 0 0 0-1.5 0v5c0 .414.336.75.75.75h4a.75.75 0 0 0 0-1.5h-3.25V5Z"
        clipRule="evenodd"
      />
    </svg>
  )
}

function SpinnerIcon() {
  return (
    <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="3" strokeOpacity="0.25" />
      <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  )
}
