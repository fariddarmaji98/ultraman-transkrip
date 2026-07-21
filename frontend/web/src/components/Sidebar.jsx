import UploadPanel from './UploadPanel'
import RecordingList from './RecordingList'
import ModelPicker from './ModelPicker'

const ACTIVE_ST = ['queued', 'extracting', 'transcribing']

export default function Sidebar({
  recordings,
  config,
  selectedId,
  onSelect,
  onUploaded,
  onChanged,
  onDeselect,
  onConfigChange,
}) {
  const busy = recordings.some((r) => ACTIVE_ST.includes(r.status))
  return (
    <aside className="flex h-screen w-[340px] shrink-0 flex-col border-r border-edge bg-panel">
      <Brand />
      <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto p-4">
        <UploadPanel onUploaded={onUploaded} />
        <EnginePanel config={config} busy={busy} onConfigChange={onConfigChange} />
        <StatsGrid recordings={recordings} />
        <div>
          <SectionLabel>Riwayat</SectionLabel>
          <RecordingList
            items={recordings}
            selectedId={selectedId}
            onSelect={onSelect}
            onChanged={onChanged}
            onDeselect={onDeselect}
          />
        </div>
      </div>
    </aside>
  )
}

function Brand() {
  return (
    <div className="flex items-center gap-3 border-b border-edge px-4 py-4">
      <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-mint/10 text-mint">
        <MicIcon />
      </div>
      <div>
        <h1 className="text-sm font-semibold leading-tight text-fg">Ultraman Transkrip</h1>
        <p className="text-[10px] font-medium uppercase tracking-widest text-fg3">
          transkrip lokal · akurat
        </p>
      </div>
    </div>
  )
}

function SectionLabel({ children }) {
  return (
    <div className="mb-2 text-[10px] font-semibold uppercase tracking-widest text-fg3">
      {children}
    </div>
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

function Row({ label, value, mono }) {
  return (
    <div className="flex items-center justify-between gap-2 py-1 text-xs">
      <span className="text-fg3">{label}</span>
      <span className={`truncate text-fg2 ${mono ? 'font-mono' : ''}`}>{value}</span>
    </div>
  )
}

function StatsGrid({ recordings }) {
  const by = (fn) => recordings.filter(fn).length
  return (
    <div className="grid grid-cols-2 gap-2">
      <Stat label="Selesai" value={by((r) => r.status === 'done')} accent />
      <Stat label="Diproses" value={by((r) => ACTIVE_ST.includes(r.status))} />
      <Stat label="Gagal" value={by((r) => r.status === 'failed')} danger />
      <Stat label="Total" value={recordings.length} />
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

function MicIcon() {
  return (
    <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M12 15a3 3 0 0 0 3-3V6a3 3 0 1 0-6 0v6a3 3 0 0 0 3 3Zm0 0v4m-4 0h8m-9-9a5 5 0 0 0 10 0"
      />
    </svg>
  )
}
