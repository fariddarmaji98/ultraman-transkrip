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
    <div className="min-h-screen bg-slate-50 text-slate-800">
      <header className="flex items-baseline gap-3 border-b border-slate-200 bg-white px-7 py-4">
        <h1 className="m-0 text-lg font-semibold text-indigo-600">Ultraman Transkrip</h1>
        <span className="text-sm text-slate-500">unggah → transkrip</span>
      </header>
      <main className="mx-auto grid max-w-6xl grid-cols-1 items-start gap-5 p-5 md:grid-cols-[320px_1fr] md:px-7">
        <aside className="flex flex-col gap-4">
          <UploadPanel onUploaded={handleUploaded} />
          <RecordingList
            items={recordings}
            selectedId={selectedId}
            onSelect={setSelectedId}
            onChanged={refresh}
            onDeselect={() => setSelectedId(null)}
          />
        </aside>
        <section className="min-h-[60vh] rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          {selectedId ? (
            <TranscriptView key={selectedId} id={selectedId} onDone={refresh} />
          ) : (
            <p className="mt-10 text-center text-slate-500">
              Pilih rekaman di kiri, atau unggah yang baru.
            </p>
          )}
        </section>
      </main>
    </div>
  )
}
