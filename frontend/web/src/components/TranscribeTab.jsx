// Isi tab Transkrip: unggah file + engine + statistik + riwayat.
// Rekaman yang baru diunduh (belum ditranskrip) sengaja tidak muncul di sini —
// tempatnya di tab Unduh sampai transkrip dijalankan.
import UploadPanel from './UploadPanel'
import RecordingList from './RecordingList'
import ModelPicker from './ModelPicker'
import SectionLabel from './SectionLabel'
import { inTranscriptPhase, isActive } from '../utils'

export default function TranscribeTab({
  recordings,
  config,
  selectedId,
  onSelect,
  onChanged,
  onDeselect,
  onUploaded,
  onConfigChange,
}) {
  const items = recordings.filter(inTranscriptPhase)
  const busy = items.some(isActive)  // unduhan tidak mengunci model — ia tak pakai Whisper
  return (
    <>
      <UploadPanel languages={config?.languages} onUploaded={onUploaded} />
      <EnginePanel config={config} busy={busy} onConfigChange={onConfigChange} />
      <StatsGrid items={items} />
      <div>
        <SectionLabel>Riwayat</SectionLabel>
        <RecordingList
          items={items}
          selectedId={selectedId}
          onSelect={onSelect}
          onChanged={onChanged}
          onDeselect={onDeselect}
          emptyText="Belum ada transkrip."
        />
      </div>
    </>
  )
}

function EnginePanel({ config, busy, onConfigChange }) {
  const provider = config?.asr_provider === 'groq' ? 'Groq · cloud' : 'Lokal · mesin'
  return (
    <div className="rounded-xl border border-edge bg-panel2 p-3">
      <SectionLabel>Engine</SectionLabel>
      <Row label="Provider" value={provider} />
      <ModelPicker config={config} busy={busy} onConfigChange={onConfigChange} />
      <EngineStatus busy={busy} />
    </div>
  )
}

function EngineStatus({ busy }) {
  const tone = busy ? 'text-amber-400' : 'text-mint'
  return (
    <div className={`mt-2.5 flex items-center gap-2 text-xs ${tone}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${busy ? 'bg-amber-400' : 'bg-mint'}`} />
      <span>{busy ? 'Engine sibuk' : 'Engine siap'}</span>
    </div>
  )
}

function Row({ label, value }) {
  return (
    <div className="flex items-center justify-between gap-2 py-1 text-xs">
      <span className="text-fg3">{label}</span>
      <span className="truncate text-fg2">{value}</span>
    </div>
  )
}

function StatsGrid({ items }) {
  const by = (fn) => items.filter(fn).length
  return (
    <div className="grid grid-cols-2 gap-2">
      <Stat label="Selesai" value={by((r) => r.status === 'done')} accent />
      <Stat label="Diproses" value={by(isActive)} />
      <Stat label="Gagal" value={by((r) => r.status === 'failed')} danger />
      <Stat label="Total" value={items.length} />
    </div>
  )
}

function Stat({ label, value, accent, danger }) {
  const color = accent ? 'text-mint' : danger && value > 0 ? 'text-red-400' : 'text-fg'
  return (
    <div className="rounded-xl border border-edge bg-panel2 px-3 py-2.5">
      <div className="text-[10px] font-medium uppercase tracking-widest text-fg3">{label}</div>
      <div className={`mt-0.5 text-2xl font-semibold tabular-nums ${color}`}>{value}</div>
    </div>
  )
}
