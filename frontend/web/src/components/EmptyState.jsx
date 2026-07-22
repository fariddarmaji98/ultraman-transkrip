export default function EmptyState({ count }) {
  return (
    <div className="flex h-full flex-1 flex-col items-center justify-center gap-4 p-8 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-2xl border border-edge bg-panel2 text-mint">
        <WaveIcon />
      </div>
      <div>
        <p className="text-lg font-semibold text-fg">Pilih rekaman, atau unggah yang baru</p>
        <p className="mt-1 text-sm text-fg2">
          {count > 0
            ? `${count} rekaman tersimpan.`
            : 'Unggah file, atau tempel URL di tab Unduh.'}
        </p>
      </div>
    </div>
  )
}

function WaveIcon() {
  return (
    <svg className="h-7 w-7" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M4 12h1m3-5v10m4-14v18m4-14v10m3-6h1"
      />
    </svg>
  )
}
