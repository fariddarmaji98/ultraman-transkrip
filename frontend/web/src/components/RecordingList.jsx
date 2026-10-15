import { useState } from 'react'
import { deleteRecording, retryDownload, sourceUrl } from '../api'
import { fmtDate, fmtTime, isActive } from '../utils'
import Icon from './Icon'
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
  showDownload = false,
}) {
  const [pendingId, setPendingId] = useState(null)

  async function confirmDelete() {
    const id = pendingId
    setPendingId(null)
    await deleteRecording(id)
    if (id === selectedId) onDeselect()
    onChanged()
  }

  async function retry(id) {
    try {
      await retryDownload(id)
      onChanged()
    } catch {
      // error sudah ada di status recording — polling akan tunjukkan
    }
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
            showDownload={showDownload}
            onSelect={() => onSelect(r.id)}
            onRetry={() => retry(r.id)}
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

// Berkasnya baru ada setelah unduhan selesai — jangan tawarkan simpan sebelum itu.
const HAS_FILE = (rec) => !['downloading', 'failed', 'paused'].includes(rec.status)

function RecordingItem({ rec, selected, showDownload, onSelect, onRetry, onDelete }) {
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
        {rec.status === 'paused' && <MiniBar progress={rec.progress} paused />}
      </div>
      <div className="flex shrink-0 items-center">
        {showDownload && HAS_FILE(rec) && (
          <a
            href={sourceUrl(rec.id)}
            download
            onClick={(e) => e.stopPropagation()}
            title="Simpan video ke komputer"
            aria-label="Simpan ke komputer"
            className="rounded p-1.5 text-fg3 transition hover:bg-mint/10 hover:text-mint"
          >
            <Icon name="save" />
          </a>
        )}
        {rec.status === 'failed' && (
          <button
            onClick={(e) => {
              e.stopPropagation()
              onRetry()
            }}
            title="Coba ulang"
            aria-label="Coba ulang"
            className="rounded p-1.5 text-fg3 transition hover:bg-mint/10 hover:text-mint"
          >
            <Icon name="retry" />
          </button>
        )}
        <button
          title="Hapus"
          aria-label="Hapus"
          onClick={onDelete}
          className="rounded p-1.5 text-fg3 transition hover:bg-red-500/10 hover:text-red-400"
        >
          <Icon name="trash" />
        </button>
      </div>
    </li>
  )
}

function MiniBar({ progress, paused }) {
  return (
    <div className="mt-0.5 h-1 overflow-hidden rounded-full bg-edge">
      <div
        className={`h-full rounded-full transition-all duration-500 ${paused ? 'bg-amber-400' : 'bg-mint'}`}
        style={{ width: `${progress ?? 0}%` }}
      />
    </div>
  )
}

