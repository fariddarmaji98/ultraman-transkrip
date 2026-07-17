import { useCallback, useEffect, useState } from 'react'
import { listRecordings } from './api'
import UploadPanel from './components/UploadPanel'
import RecordingList from './components/RecordingList'
import TranscriptView from './components/TranscriptView'

export default function App() {
  const [recordings, setRecordings] = useState([])
  const [selectedId, setSelectedId] = useState(null)

  const refresh = useCallback(async () => {
    setRecordings(await listRecordings())
  }, [])

  useEffect(() => {
    refresh()
  }, [refresh])

  async function handleUploaded(res) {
    await refresh()
    setSelectedId(res.recording.id)
  }

  return (
    <div className="app">
      <header className="topbar">
        <h1>Ultraman Transkrip</h1>
        <span className="tag">unggah → transkrip</span>
      </header>
      <main className="layout">
        <aside className="sidebar">
          <UploadPanel onUploaded={handleUploaded} />
          <RecordingList
            items={recordings}
            selectedId={selectedId}
            onSelect={setSelectedId}
            onChanged={refresh}
            onDeselect={() => setSelectedId(null)}
          />
        </aside>
        <section className="content">
          {selectedId ? (
            <TranscriptView key={selectedId} id={selectedId} onDone={refresh} />
          ) : (
            <p className="empty">Pilih rekaman di kiri, atau unggah yang baru.</p>
          )}
        </section>
      </main>
    </div>
  )
}
