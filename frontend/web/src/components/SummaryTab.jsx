// Isi tab Summary: recording yang sudah punya transkrip + ringkasan (data matang).
import { isReady } from '../utils'
import RecordingList from './RecordingList'
import SectionLabel from './SectionLabel'

export default function SummaryTab({
  recordings,
  selectedId,
  onSelect,
  onChanged,
  onDeselect,
}) {
  const items = recordings.filter(isReady)
  return (
    <>
      <SectionLabel>Selesai</SectionLabel>
      <RecordingList
        items={items}
        selectedId={selectedId}
        onSelect={onSelect}
        onChanged={onChanged}
        onDeselect={onDeselect}
        emptyText="Belum ada ringkasan selesai."
        showDownload
      />
    </>
  )
}
