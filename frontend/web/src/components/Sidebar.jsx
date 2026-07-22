// Rangka sidebar: brand + tab + isi tab. Lebarnya bisa digeser (ADR 0006).
import { useState } from 'react'
import DownloadTab from './DownloadTab'
import ResizeHandle from './ResizeHandle'
import SettingsModal from './SettingsModal'
import SidebarTabs from './SidebarTabs'
import TranscribeTab from './TranscribeTab'
import usePanelWidth from '../hooks/usePanelWidth'
import useLocalState from '../hooks/useLocalState'
import { inTranscriptPhase, isDownload } from '../utils'

const WIDTH = { key: 'sidebar-width', min: 280, max: 560, initial: 340, handleSide: 'right' }

export default function Sidebar({ recordings, config, onCreated, ...tabProps }) {
  const { width, dragging, handlers } = usePanelWidth(WIDTH)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [tab, setTab] = useLocalState('sidebar-tab', 'transkrip')
  const counts = {
    transkrip: recordings.filter(inTranscriptPhase).length,
    unduh: recordings.filter(isDownload).length,
  }
  return (
    <aside
      style={{ width }}
      className={`relative flex h-screen shrink-0 flex-col border-r border-edge bg-panel ${
        dragging ? 'select-none' : ''
      }`}
    >
      <ResizeHandle side="right" dragging={dragging} handlers={handlers} />
      <Brand onSettings={() => setSettingsOpen(true)} />
      <SidebarTabs active={tab} counts={counts} onChange={setTab} />
      <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto p-4">
        {tab === 'unduh' ? (
          <DownloadTab
            recordings={recordings}
            config={config}
            onCreated={onCreated}
            {...tabProps}
          />
        ) : (
          <TranscribeTab recordings={recordings} config={config} {...tabProps} />
        )}
      </div>
      {settingsOpen && <SettingsModal onClose={() => setSettingsOpen(false)} />}
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
