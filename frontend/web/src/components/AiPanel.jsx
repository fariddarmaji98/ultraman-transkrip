// Kolom tengah: ringkasan + chat AI (roadmap M2/M3). Backend-nya belum ada,
// jadi kontrolnya sengaja dikunci — lebih jujur daripada menampilkan hasil palsu.
export default function AiPanel({ rec }) {
  const ready = rec.status === 'done'
  return (
    <section className="flex min-w-0 flex-1 flex-col">
      <PanelHeader />
      <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto p-5">
        <SummaryCard ready={ready} />
        <ChatEmpty />
      </div>
      <ChatInput />
    </section>
  )
}

function PanelHeader() {
  return (
    <div className="flex items-center justify-between border-b border-edge px-5 py-3">
      <span className="text-[10px] font-semibold uppercase tracking-widest text-fg3">
        Asisten AI
      </span>
      <span className="rounded-full border border-edge2 px-2 py-0.5 text-[10px] text-fg3">
        belum aktif
      </span>
    </div>
  )
}

function SummaryCard({ ready }) {
  return (
    <div className="rounded-xl border border-edge bg-panel2 p-4">
      <h3 className="text-sm font-semibold text-fg">Ringkasan</h3>
      <p className="mt-1 text-xs leading-relaxed text-fg3">
        Ringkasan otomatis dan poin aksi dari transkrip ini.
      </p>
      <button
        disabled
        title="Endpoint ringkasan (M2) belum dibuat"
        className="mt-3 w-full cursor-not-allowed rounded-lg border border-edge bg-panel px-3 py-2 text-xs font-semibold text-fg3"
      >
        {ready ? 'Buat ringkasan' : 'Menunggu transkrip selesai'}
      </button>
    </div>
  )
}

function ChatEmpty() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-3 px-4 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-edge bg-panel2 text-fg3">
        <ChatIcon />
      </div>
      <p className="text-sm font-medium text-fg2">Tanya apa saja soal rekaman ini</p>
      <p className="max-w-xs text-xs leading-relaxed text-fg3">
        Jawaban akan mengutip menit sumbernya di transkrip sebelah kanan.
      </p>
    </div>
  )
}

function ChatInput() {
  return (
    <div className="border-t border-edge p-3">
      <div className="flex items-center gap-2 rounded-xl border border-edge bg-panel2 px-3 py-2">
        <input
          disabled
          placeholder="Chat dengan transkrip (segera)…"
          className="min-w-0 flex-1 bg-transparent text-sm text-fg outline-none placeholder:text-fg3 disabled:cursor-not-allowed"
        />
        <button
          disabled
          aria-label="Kirim"
          className="cursor-not-allowed rounded-lg border border-edge p-1.5 text-fg3"
        >
          <SendIcon />
        </button>
      </div>
    </div>
  )
}

function ChatIcon() {
  return (
    <svg className="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M8 10h8M8 14h5m7-2a8 8 0 0 1-8 8H8l-4 3v-5.5A8 8 0 1 1 20 12Z"
      />
    </svg>
  )
}

function SendIcon() {
  return (
    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d="M5 12h14M13 5l7 7-7 7" />
    </svg>
  )
}
