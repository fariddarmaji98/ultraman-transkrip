import { useState } from 'react'
import Icon from './Icon'
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
          icon={<Icon name="link" className="h-5 w-5" />}
          label="URL video"
          onClick={() => setMode('url')}
        />
        <ChoiceButton
          icon={<Icon name="file" className="h-5 w-5" />}
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
