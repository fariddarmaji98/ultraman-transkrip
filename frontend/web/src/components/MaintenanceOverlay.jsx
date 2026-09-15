// Overlay maintenance: tampil penuh selama backend memperbarui mesin unduh
// (yt-dlp). Digerakkan state, bukan timeout — hilang sendiri saat poll
// `/api/maintenance` melaporkan selesai, apa pun lamanya.
export default function MaintenanceOverlay({ status }) {
  if (!status?.updating) return null
  return (
    <div
      role="alert"
      className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-4 bg-canvas/95 backdrop-blur-sm"
    >
      <Spinner />
      <div className="text-center">
        <h2 className="text-base font-semibold text-fg">Sedang Pemeliharaan</h2>
        <p className="mt-1 max-w-sm text-xs leading-relaxed text-fg3">
          {status.message || 'Memperbarui mesin unduh…'}
          {' '}Aplikasi otomatis kembali sebentar lagi — tidak perlu memuat ulang.
        </p>
      </div>
    </div>
  )
}

function Spinner() {
  return (
    <div
      className="h-10 w-10 animate-spin rounded-full border-2 border-edge border-t-mint"
      aria-hidden="true"
    />
  )
}
