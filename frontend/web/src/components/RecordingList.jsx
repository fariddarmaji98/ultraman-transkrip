import { useState } from 'react'
import { deleteRecording } from '../api'
import { fmtDate, fmtTime } from '../utils'
import StatusBadge from './StatusBadge'
import ConfirmModal from './ConfirmModal'

export default function RecordingList({
  items,
  selectedId,
  onSelect,
  onChanged,
  onDeselect,
}) {
  const [pendingId, setPendingId] = useState(null)

  async function confirmDelete() {
    const id = pendingId
    setPendingId(null)
    await deleteRecording(id)
    if (id === selectedId) onDeselect()
    onChanged()
  }

  if (!items.length)
    return <p className="text-slate-500">Belum ada rekaman.</p>

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
          title="Hapus transkrip?"
          message="Transkrip dan media rekaman ini akan dihapus permanen dan tidak bisa dikembalikan."
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
      className={`flex cursor-pointer items-center justify-between gap-2 rounded-lg border bg-white px-3 py-2.5 transition ${
        selected
          ? 'border-indigo-500 ring-2 ring-indigo-100'
          : 'border-slate-200 hover:border-indigo-400'
      }`}
    >
      <div className="flex min-w-0 flex-col gap-1">
        <span className="truncate text-sm font-medium">{rec.title}</span>
        <div className="flex items-center gap-2">
          <StatusBadge status={rec.status} />
          <span className="text-xs text-slate-400">
            {fmtDate(rec.created_at)}
            {rec.duration_ms ? ` · ${fmtTime(rec.duration_ms)}` : ''}
          </span>
        </div>
      </div>
      <button
        title="Hapus"
        onClick={onDelete}
        className="shrink-0 rounded px-1.5 py-1 text-slate-400 transition hover:bg-red-50 hover:text-red-600"
      >
        ✕
      </button>
    </li>
  )
}
