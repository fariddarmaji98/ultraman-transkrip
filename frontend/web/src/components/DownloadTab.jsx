// Isi tab Unduh: tempel URL + arsip video hasil unduhan + pemakaian disk.
// Hasil unduhan tetap tinggal di sini walau sudah ditranskrip (planning §11).
import { useEffect, useState } from 'react'
import { getStorage } from '../api'
import { isDownload } from '../utils'
import RecordingList from './RecordingList'
import SectionLabel from './SectionLabel'
import StorageInfo from './StorageInfo'
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
  const storage = useStorage(items)
  return (
    <>
      <UrlForm onCreated={onCreated} />
      <StorageInfo storage={storage} />
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

// Muat ulang angka disk hanya saat daftar/status unduhan berubah — bukan tiap poll.
function useStorage(items) {
  const [storage, setStorage] = useState(null)
  const key = items.map((r) => `${r.id}:${r.status}`).join(',')
  useEffect(() => {
    getStorage().then(setStorage).catch(() => {})
  }, [key])
  return storage
}
