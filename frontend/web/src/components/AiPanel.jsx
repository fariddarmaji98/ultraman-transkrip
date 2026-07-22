// Kolom tengah: ringkasan (aktif) + chat (menyusul M3).
// Mesin AI-nya dipilih di popup Setelan — lihat ADR 0007.
import { useState } from 'react'
import { summarizeRecording } from '../api'
import { fmtDate } from '../utils'
import ChatPanel from './ChatPanel'
import SummaryText from './SummaryText'

export default function AiPanel({ rec, onSummarized, onSeek }) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const ready = rec.status === 'done' && rec.segments?.length > 0

  async function run() {
    setBusy(true)
    setError(null)
    try {
      await summarizeRecording(rec.id)
      onSummarized?.()
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="flex min-w-0 flex-1 flex-col">
      <PanelHeader />
      <div className="shrink-0 overflow-y-auto p-5 pb-0">
        <SummaryCard
          summary={rec.summary}
          ready={ready}
          busy={busy}
          error={error}
          onRun={run}
        />
      </div>
      <ChatPanel rec={rec} ready={ready} onSeek={onSeek} />
    </section>
  )
}

function PanelHeader() {
  return (
    <div className="flex items-center justify-between border-b border-edge px-5 py-3">
      <span className="text-[10px] font-semibold uppercase tracking-widest text-fg3">
        Asisten AI
      </span>
    </div>
  )
}

function SummaryCard({ summary, ready, busy, error, onRun }) {
  return (
    <div className="rounded-xl border border-edge bg-panel2 p-4">
      <div className="flex items-baseline justify-between gap-2">
        <h3 className="text-sm font-semibold text-fg">Ringkasan</h3>
        {summary && (
          <span className="shrink-0 font-mono text-[10px] text-fg3">{summary.model}</span>
        )}
      </div>
      {summary ? (
        <div className="mt-2">
          <SummaryText text={summary.text} />
          <p className="mt-3 text-[10px] text-fg3">Dibuat {fmtDate(summary.created_at)}</p>
        </div>
      ) : (
        <p className="mt-1 text-xs leading-relaxed text-fg3">
          Ringkasan otomatis dan poin aksi dari transkrip ini.
        </p>
      )}
      <RunButton summary={summary} ready={ready} busy={busy} onRun={onRun} />
      {error && <p className="mt-2 text-xs leading-snug text-red-400">{error}</p>}
    </div>
  )
}

function RunButton({ summary, ready, busy, onRun }) {
  const label = busy ? 'Meringkas…' : summary ? 'Buat ulang' : 'Buat ringkasan'
  const style = summary
    ? 'border border-edge bg-panel text-fg2 hover:border-edge2 hover:text-fg'
    : 'bg-mint text-canvas hover:bg-mint2'
  return (
    <button
      onClick={onRun}
      disabled={!ready || busy}
      title={ready ? 'Memakai mesin AI dari popup Setelan' : 'Transkrip harus selesai dulu'}
      className={`mt-3 w-full rounded-lg px-3 py-2 text-xs font-semibold transition disabled:cursor-not-allowed disabled:opacity-40 ${style}`}
    >
      {ready ? label : 'Menunggu transkrip selesai'}
    </button>
  )
}
