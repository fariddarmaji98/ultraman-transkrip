import { useCallback, useEffect, useState } from 'react'
import { getConfig, listRecordings } from './api'
import Sidebar from './components/Sidebar'
import TranscriptView from './components/TranscriptView'
import EmptyState from './components/EmptyState'

export default function App() {
  const [recordings, setRecordings] = useState([])
  const [config, setConfig] = useState(null)
  const [selectedId, setSelectedId] = useState(null)

  const refresh = useCallback(async () => {
    setRecordings(await listRecordings())
  }, [])

  useEffect(() => {
    refresh()
    getConfig().then(setConfig).catch(() => {})
  }, [refresh])

  async function handleUploaded(res) {
    await refresh()
    setSelectedId(res.recording.id)
  }

  return (
    <div className="flex h-screen overflow-hidden bg-canvas text-fg">
      <Sidebar
        recordings={recordings}
        config={config}
        selectedId={selectedId}
        onSelect={setSelectedId}
        onUploaded={handleUploaded}
        onChanged={refresh}
        onDeselect={() => setSelectedId(null)}
        onConfigChange={setConfig}
      />
      <main className="flex min-w-0 flex-1 overflow-hidden">
        {selectedId ? (
          <TranscriptView
            key={selectedId}
            id={selectedId}
            onDone={refresh}
            onClose={() => setSelectedId(null)}
          />
        ) : (
          <EmptyState count={recordings.length} />
        )}
      </main>
    </div>
  )
}
