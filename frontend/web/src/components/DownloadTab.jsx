// Isi tab Unduh: tempel URL + arsip video hasil unduhan.
// Setelan mesin unduh, cookies, dan penyimpanan dipindah ke popup Setelan.
import { isDownload } from '../utils'
import RecordingList from './RecordingList'
import SectionLabel from './SectionLabel'
import UrlForm from './UrlForm'

export default function DownloadTab({
  recordings,
  selectedId,
  onSelect,
  onChanged,
  onDeselect,
  onCreated,
}) {
  const items = recordings.filter(isDownload)
  return (
    <>
      <UrlForm onCreated={onCreated} />
      <div>
        <SectionLabel>Video terunduh</SectionLabel>
        <RecordingList
          items={items}
          selectedId={selectedId}
          onSelect={onSelect}
          onChanged={onChanged}
          onDeselect={onDeselect}
          emptyText="Belum ada video diunduh."
          showDownload
          confirmTitle="Hapus video?"
          confirmMessage="File video dan transkripnya (bila ada) akan dihapus permanen dan tidak bisa dikembalikan."
        />
      </div>
    </>
  )
}
