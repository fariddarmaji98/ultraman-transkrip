import { useState } from 'react'
import UploadPanel from './UploadPanel'
import RecordingList from './RecordingList'
import ModelPicker from './ModelPicker'
import ResizeHandle from './ResizeHandle'
import SettingsModal from './SettingsModal'
import usePanelWidth from '../hooks/usePanelWidth'

const ACTIVE_ST = ['queued', 'extracting', 'transcribing']
const WIDTH = { key: 'sidebar-width', min: 280, max: 560, initial: 340, handleSide: 'right' }

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
  const { width, dragging, handlers } = usePanelWidth(WIDTH)
  const [settingsOpen, setSettingsOpen] = useState(false)
  return (
    <aside
      style={{ width }}
      className={`relative flex h-screen shrink-0 flex-col border-r border-edge bg-panel ${
        dragging ? 'select-none' : ''
      }`}
    >
      <ResizeHandle side="right" dragging={dragging} handlers={handlers} />
      <Brand onSettings={() => setSettingsOpen(true)} />
      {settingsOpen && <SettingsModal onClose={() => setSettingsOpen(false)} />}
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

function Brand({ onSettings }) {
  return (
    <div className="flex items-center gap-3 border-b border-edge px-4 py-4">
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-mint/10 text-mint">
        <MicIcon />
      </div>
      <div className="min-w-0">
        <h1 className="truncate text-sm font-semibold leading-tight text-fg">Ultraman Transkrip</h1>
        <p className="text-[10px] font-medium uppercase tracking-widest text-fg3">
          transkrip lokal · akurat
        </p>
      </div>
      <button
        onClick={onSettings}
        title="Setelan mesin AI"
        aria-label="Setelan"
        className="ml-auto shrink-0 rounded-lg border border-edge p-1.5 text-fg3 transition hover:border-edge2 hover:text-fg"
      >
        <GearIcon />
      </button>
    </div>
  )
}

function GearIcon() {
  return (
    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true">
      <circle cx="12" cy="12" r="3" />
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M19.4 15a1.7 1.7 0 0 0 .34 1.87l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.7 1.7 0 0 0-1.87-.34 1.7 1.7 0 0 0-1.03 1.56V21a2 2 0 1 1-4 0v-.09A1.7 1.7 0 0 0 9 19.4a1.7 1.7 0 0 0-1.87.34l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.7 1.7 0 0 0 4.6 15a1.7 1.7 0 0 0-1.56-1.03H3a2 2 0 1 1 0-4h.09A1.7 1.7 0 0 0 4.6 9a1.7 1.7 0 0 0-.34-1.87l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.7 1.7 0 0 0 9 4.6a1.7 1.7 0 0 0 1.03-1.56V3a2 2 0 1 1 4 0v.09A1.7 1.7 0 0 0 15 4.6a1.7 1.7 0 0 0 1.87-.34l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.7 1.7 0 0 0 19.4 9v.09a1.7 1.7 0 0 0 1.56 1.03H21a2 2 0 1 1 0 4h-.09a1.7 1.7 0 0 0-1.51 1.03Z"
      />
    </svg>
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
