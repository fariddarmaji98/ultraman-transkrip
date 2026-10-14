// Isi tab Unduh: masukkan media (URL + import) + arsip video hasil unduhan.
// Setelan mesin unduh, cookies, dan penyimpanan dipindah ke popup Setelan.
import { isRaw } from '../utils'
import RecordingList from './RecordingList'
import SectionLabel from './SectionLabel'
import UrlForm from './UrlForm'
import UploadPanel from './UploadPanel'

export default function DownloadTab({
  recordings,
  selectedId,
  onSelect,
  onChanged,
  onDeselect,
  onCreated,
  onUploaded,
}) {
  const items = recordings.filter(isRaw)
  return (
    <>
      <UrlForm onCreated={onCreated} />
      <div>
        <SectionLabel>Atau unggah file</SectionLabel>
        <UploadPanel onUploaded={onUploaded} />
      </div>
      <div>
        <SectionLabel>Video terunduh</SectionLabel>
        <RecordingList
          items={items}
          selectedId={selectedId}
          onSelect={onSelect}
          onChanged={onChanged}
          onDeselect={onDeselect}
          emptyText="Belum ada video."
          showDownload
          confirmTitle="Hapus video?"
          confirmMessage="File video dan transkripnya (bila ada) akan dihapus permanen dan tidak bisa dikembalikan."
        />
      </div>
    </>
  )
}
