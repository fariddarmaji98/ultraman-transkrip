import { useState } from 'react'
import UrlForm from './UrlForm'
import UploadPanel from './UploadPanel'

// Toggle: pilih cara masukkan media (URL atau file). Setelah selesai,
// balik ke pilihan awal.
// - URL: selesai = klik Unduh video
// - File: selesai = upload selesai (progress done)
export default function MediaInput({ onCreated, onUploaded }) {
  const [mode, setMode] = useState(null) // null | 'url' | 'file'

  if (!mode) {
    return (
      <div className="flex gap-2">
        <ChoiceButton
          icon={<LinkIcon />}
          label="URL video"
          onClick={() => setMode('url')}
        />
        <ChoiceButton
          icon={<FileIcon />}
          label="Unggah file"
          onClick={() => setMode('file')}
        />
      </div>
    )
  }

  if (mode === 'url') {
    return (
      <UrlForm
        onCreated={(res) => {
          onCreated(res)
          setMode(null)
        }}
        onCancel={() => setMode(null)}
      />
    )
  }

  return (
    <UploadPanel
      onUploaded={(res) => {
        onUploaded(res)
        setMode(null)
      }}
      onCancel={() => setMode(null)}
    />
  )
}

function ChoiceButton({ icon, label, onClick }) {
  return (
    <button
      onClick={onClick}
      className="flex flex-1 flex-col items-center gap-2 rounded-xl border border-dashed border-edge2 bg-panel2 p-4 text-sm font-medium text-fg2 transition hover:border-mint hover:bg-mint/5 hover:text-mint"
    >
      {icon}
      {label}
    </button>
  )
}

function LinkIcon() {
  return (
    <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 15l6-6m-3-3l1-1a4 4 0 016 6l-1 1m-6 6l-1 1a4 4 0 01-6-6l1-1" />
    </svg>
  )
}

function FileIcon() {
  return (
    <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d="M14 3v5h5M14 3l5 5v11a2 2 0 01-2 2H7a2 2 0 01-2-2V5a2 2 0 012-2h7z" />
    </svg>
  )
}
