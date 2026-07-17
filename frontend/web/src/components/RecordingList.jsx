import { deleteRecording } from '../api'
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
    await deleteRecording(id)
    if (id === selectedId) onDeselect()
    onChanged()
  }

  if (!items.length) return <p className="muted">Belum ada rekaman.</p>

  return (
    <ul className="rec-list">
      {items.map((r) => (
        <li
          key={r.id}
          className={r.id === selectedId ? 'rec active' : 'rec'}
          onClick={() => onSelect(r.id)}
        >
          <div className="rec-main">
            <span className="rec-title">{r.title}</span>
            <StatusBadge status={r.status} />
          </div>
          <button className="del" title="Hapus" onClick={(e) => remove(e, r.id)}>
            ✕
          </button>
        </li>
      ))}
    </ul>
  )
}
