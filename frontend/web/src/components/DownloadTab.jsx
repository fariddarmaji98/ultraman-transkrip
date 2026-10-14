// Isi tab Media: masukkan media (URL/import via toggle) + arsip video.
// Setelan mesin unduh, cookies, dan penyimpanan dipindah ke popup Setelan.
import { isRaw } from '../utils'
import RecordingList from './RecordingList'
import SectionLabel from './SectionLabel'
import MediaInput from './MediaInput'

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
      <MediaInput onCreated={onCreated} onUploaded={onUploaded} />
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
