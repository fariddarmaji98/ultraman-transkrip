import { useState } from 'react'
import { deleteRecording } from '../api'
import { fmtDate, fmtTime, isActive } from '../utils'
import StatusBadge from './StatusBadge'
import ConfirmModal from './ConfirmModal'

export default function RecordingList({
  items,
  selectedId,
  onSelect,
  onChanged,
  onDeselect,
  emptyText = 'Belum ada rekaman.',
  confirmTitle = 'Hapus transkrip?',
  confirmMessage = 'Transkrip dan media rekaman ini akan dihapus permanen dan tidak bisa dikembalikan.',
}) {
  const [pendingId, setPendingId] = useState(null)

  async function confirmDelete() {
    const id = pendingId
    setPendingId(null)
    await deleteRecording(id)
    if (id === selectedId) onDeselect()
    onChanged()
  }

  if (!items.length) return <p className="text-sm text-fg3">{emptyText}</p>

  return (
    <>
      <ul className="flex list-none flex-col gap-1.5 p-0">
        {items.map((r) => (
          <RecordingItem
            key={r.id}
            rec={r}
            selected={r.id === selectedId}
            onSelect={() => onSelect(r.id)}
            onDelete={(e) => {
              e.stopPropagation()
              setPendingId(r.id)
            }}
          />
        ))}
      </ul>
      {pendingId !== null && (
        <ConfirmModal
          title={confirmTitle}
          message={confirmMessage}
          confirmLabel="Hapus"
          onConfirm={confirmDelete}
          onCancel={() => setPendingId(null)}
        />
      )}
    </>
  )
}

function RecordingItem({ rec, selected, onSelect, onDelete }) {
  return (
    <li
      onClick={onSelect}
      className={`flex cursor-pointer items-center justify-between gap-2 rounded-lg border px-3 py-2.5 transition ${
        selected
          ? 'border-mint/50 bg-mint/5'
          : 'border-edge bg-panel2 hover:border-edge2'
      }`}
    >
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <span className="truncate text-sm font-medium text-fg">{rec.title}</span>
        <div className="flex items-center gap-1.5">
          <StatusBadge status={rec.status} />
          <span className="text-[11px] text-fg3">
            {fmtDate(rec.created_at)}
            {rec.duration_ms ? ` · ${fmtTime(rec.duration_ms)}` : ''}
          </span>
        </div>
        {isActive(rec) && <MiniBar progress={rec.progress} />}
      </div>
      <button
        title="Hapus"
        aria-label="Hapus"
        onClick={onDelete}
        className="shrink-0 rounded p-1.5 text-fg3 transition hover:bg-red-500/10 hover:text-red-400"
      >
        <TrashIcon />
      </button>
    </li>
  )
}

function MiniBar({ progress }) {
  return (
    <div className="mt-0.5 h-1 overflow-hidden rounded-full bg-edge">
      <div
        className="h-full rounded-full bg-mint transition-all duration-500"
        style={{ width: `${progress ?? 0}%` }}
      />
    </div>
  )
}

function TrashIcon() {
  return (
    <svg
      className="h-4 w-4"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      aria-hidden="true"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M6 7h12M9 7V5.5A1.5 1.5 0 0 1 10.5 4h3A1.5 1.5 0 0 1 15 5.5V7m2 0-.6 11.1a2 2 0 0 1-2 1.9H9.6a2 2 0 0 1-2-1.9L7 7m3 3.5v6m4-6v6"
      />
    </svg>
  )
}
