import { useCallback, useEffect, useState } from 'react'
import { getConfig, getMaintenance, listRecordings } from './api'
import { isActive } from './utils'
import Sidebar from './components/Sidebar'
import TranscriptView from './components/TranscriptView'
import EmptyState from './components/EmptyState'
import MaintenanceOverlay from './components/MaintenanceOverlay'

export default function App() {
  const [recordings, setRecordings] = useState([])
  const [config, setConfig] = useState(null)
  const [selectedId, setSelectedId] = useState(null)
  const [maintenance, setMaintenance] = useState(null)

  const refresh = useCallback(async () => {
    setRecordings(await listRecordings())
  }, [])

  useEffect(() => {
    refresh()
    getConfig().then(setConfig).catch(() => {})
  }, [refresh])

  // Pemeliharaan (update yt-dlp otomatis): poll ringan tiap 2 detik. Status
  // dipegang selalu — overlay yang memutuskan tampil/tidak dari `updating`.
  useEffect(() => {
    let alive = true
    const tick = async () => {
      const s = await getMaintenance()
      if (alive && s) setMaintenance(s)
    }
    tick()
    const timer = setInterval(tick, 2000)
    return () => {
      alive = false
      clearInterval(timer)
    }
  }, [])

  // Selama ada unduhan/transkrip berjalan, segarkan daftar supaya progres di
  // sidebar ikut bergerak. Bergantung pada boolean, bukan array — agar interval
  // tidak dibuat ulang tiap kali data datang.
  const busy = recordings.some(isActive)
  useEffect(() => {
    if (!busy) return
    const timer = setInterval(refresh, 2000)
    return () => clearInterval(timer)
  }, [busy, refresh])

  async function handleNew(res) {
    await refresh()
    setSelectedId(res.recording.id)
  }

  return (
    <div className="flex h-screen overflow-hidden bg-canvas text-fg">
      <MaintenanceOverlay status={maintenance} />
      <Sidebar
        recordings={recordings}
        config={config}
        selectedId={selectedId}
        onSelect={setSelectedId}
        onUploaded={handleNew}
        onCreated={handleNew}
        onChanged={refresh}
        onDeselect={() => setSelectedId(null)}
        onConfigChange={setConfig}
      />
      <main className="flex min-w-0 flex-1 overflow-hidden">
        {selectedId ? (
          <TranscriptView
            key={selectedId}
            id={selectedId}
            languages={config?.languages}
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
