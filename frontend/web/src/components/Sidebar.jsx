// Rangka sidebar: brand + tab + isi tab. Lebarnya bisa digeser (ADR 0006).
import { useState } from 'react'
import DownloadTab from './DownloadTab'
import Icon from './Icon'
import ResizeHandle from './ResizeHandle'
import SettingsModal from './SettingsModal'
import SidebarTabs from './SidebarTabs'
import SummaryTab from './SummaryTab'
import TranscribeTab from './TranscribeTab'
import usePanelWidth from '../hooks/usePanelWidth'
import useLocalState from '../hooks/useLocalState'
import { hasTranscript, isRaw, isReady } from '../utils'

const WIDTH = { key: 'sidebar-width', min: 280, max: 560, initial: 340, handleSide: 'right' }

export default function Sidebar({ recordings, config, onCreated, ...tabProps }) {
  const { width, dragging, handlers } = usePanelWidth(WIDTH)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [tab, setTab] = useLocalState('sidebar-tab', 'media')
  const counts = {
    media: recordings.filter(isRaw).length,
    transkrip: recordings.filter(hasTranscript).length,
    summary: recordings.filter(isReady).length,
  }
  return (
    <aside
      data-test="sidebar-root"
      style={{ width }}
      className={`relative flex h-screen shrink-0 flex-col border-r border-edge bg-panel ${
        dragging ? 'select-none' : ''
      }`}
    >
      <ResizeHandle side="right" dragging={dragging} handlers={handlers} data-test="sidebar-resize" />
      <Brand onSettings={() => setSettingsOpen(true)} />
      <SidebarTabs active={tab} counts={counts} onChange={setTab} data-test="sidebar-tabs" />
      <div data-test="sidebar-content" className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto p-4">
        {tab === 'media' ? (
          <DownloadTab
            recordings={recordings}
            onCreated={onCreated}
            {...tabProps}
          />
        ) : tab === 'summary' ? (
          <SummaryTab recordings={recordings} {...tabProps} />
        ) : (
          <TranscribeTab recordings={recordings} config={config} {...tabProps} />
        )}
      </div>
      {settingsOpen && (
        <SettingsModal
          config={config}
          recordings={recordings}
          onClose={() => setSettingsOpen(false)}
        />
      )}
    </aside>
  )
}

function Brand({ onSettings }) {
  return (
    <div data-test="sidebar-brand" className="flex items-center gap-3 border-b border-edge px-4 py-4">
      <div data-test="sidebar-brand-logo" className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-mint/10 text-mint">
        <Icon name="mic" className="h-5 w-5" />
      </div>
      <div data-test="sidebar-brand-title" className="min-w-0">
        <h1 className="truncate text-sm font-semibold leading-tight text-fg">Ultraman Transkrip</h1>
        <p className="text-[10px] font-medium uppercase tracking-widest text-fg3">
          transkrip lokal · akurat
        </p>
      </div>
      <button
        data-test="sidebar-btn-settings"
        onClick={onSettings}
        title="Setelan general"
        aria-label="Setelan"
        className="ml-auto shrink-0 rounded-lg border border-edge p-1.5 text-fg3 transition hover:border-edge2 hover:text-fg"
      >
        <Icon name="gear" />
      </button>
    </div>
  )
}
