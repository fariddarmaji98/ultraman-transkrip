import { deleteRecording } from '../api'
import { fmtDate, fmtTime } from '../utils'
import StatusBadge from './StatusBadge'

export default function RecordingList({
  items,
  selectedId,
  onSelect,
  onChanged,
  onDeselect,
}) {
  async function remove(e, id) {
    e.stopPropagation()
    if (!window.confirm('Hapus transkrip ini? Tidak bisa dikembalikan.')) return
    await deleteRecording(id)
    if (id === selectedId) onDeselect()
    onChanged()
  }

  if (!items.length)
    return <p className="text-slate-500">Belum ada rekaman.</p>

  return (
    <ul className="flex list-none flex-col gap-1.5 p-0">
      {items.map((r) => (
        <li
          key={r.id}
          onClick={() => onSelect(r.id)}
          className={`flex cursor-pointer items-center justify-between gap-2 rounded-lg border bg-white px-3 py-2.5 transition ${
            r.id === selectedId
              ? 'border-indigo-500 ring-2 ring-indigo-100'
              : 'border-slate-200 hover:border-indigo-400'
          }`}
        >
          <div className="flex min-w-0 flex-col gap-1">
            <span className="truncate text-sm font-medium">{r.title}</span>
            <div className="flex items-center gap-2">
              <StatusBadge status={r.status} />
              <span className="text-xs text-slate-400">
                {fmtDate(r.created_at)}
                {r.duration_ms ? ` · ${fmtTime(r.duration_ms)}` : ''}
              </span>
            </div>
          </div>
          <button
            title="Hapus"
            onClick={(e) => remove(e, r.id)}
            className="shrink-0 rounded px-1.5 py-1 text-slate-400 transition hover:bg-red-50 hover:text-red-600"
          >
            ✕
          </button>
        </li>
      ))}
    </ul>
  )
}
