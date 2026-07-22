// Modal konfirmasi (tema gelap): backdrop + panel tengah + ikon + aksi.
// z-40 supaya selalu di atas SettingsModal (z-30) saat dipanggil dari dalamnya.
export default function ConfirmModal({
  title,
  message,
  confirmLabel = 'Hapus',
  onConfirm,
  onCancel,
}) {
  return (
    <div className="relative z-40" role="dialog" aria-modal="true">
      <div className="fixed inset-0 bg-black/60" onClick={onCancel} />
      <div className="fixed inset-0 z-40 flex min-h-full items-end justify-center p-4 sm:items-center">
        <div className="relative w-full max-w-md rounded-xl border border-edge bg-panel p-6 text-left shadow-2xl">
          <div className="sm:flex sm:items-start">
            <div className="mx-auto flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-red-500/15 text-red-400 sm:mx-0 sm:h-10 sm:w-10">
              <WarningIcon />
            </div>
            <div className="mt-3 text-center sm:ml-4 sm:mt-0 sm:text-left">
              <h3 className="text-base font-semibold text-fg">{title}</h3>
              <p className="mt-2 text-sm text-fg2">{message}</p>
            </div>
          </div>
          <div className="mt-5 sm:mt-4 sm:flex sm:flex-row-reverse sm:gap-3">
            <button
              onClick={onConfirm}
              className="inline-flex w-full justify-center rounded-md bg-red-500 px-3 py-2 text-sm font-semibold text-white transition hover:bg-red-400 sm:w-auto"
            >
              {confirmLabel}
            </button>
            <button
              onClick={onCancel}
              className="mt-3 inline-flex w-full justify-center rounded-md border border-edge bg-panel2 px-3 py-2 text-sm font-semibold text-fg transition hover:border-edge2 sm:mt-0 sm:w-auto"
            >
              Batal
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

function WarningIcon() {
  return (
    <svg className="h-6 w-6 sm:h-5 sm:w-5" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z"
      />
    </svg>
  )
}
