import { useState } from 'react'
import Icon from './Icon'
import UrlForm from './UrlForm'
import UploadPanel from './UploadPanel'

// Toggle: pilih cara masukkan media (URL atau file). Setelah selesai,
// balik ke pilihan awal.
// - URL: selesai = klik Unduh video
// - File: selesai = upload selesai (progress done)
export default function MediaInput({ onCreated, onUploaded, ...rest }) {
  const [mode, setMode] = useState(null) // null | 'url' | 'file'

  if (!mode) {
    return (
      <div {...rest} data-test="media-input" className="flex gap-2">
        <ChoiceButton
          testId="media-choice-url"
          icon={<Icon name="link" className="h-5 w-5" />}
          label="URL video"
          onClick={() => setMode('url')}
        />
        <ChoiceButton
          testId="media-choice-file"
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
        data-test="media-url-form"
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
      data-test="media-upload-panel"
      onUploaded={(res) => {
        onUploaded(res)
        setMode(null)
      }}
      onCancel={() => setMode(null)}
    />
  )
}

function ChoiceButton({ icon, label, onClick, testId }) {
  return (
    <button
      data-test={testId}
      onClick={onClick}
      className="flex flex-1 flex-col items-center gap-2 rounded-xl border border-dashed border-edge2 bg-panel2 p-4 text-sm font-medium text-fg2 transition hover:border-mint hover:bg-mint/5 hover:text-mint"
    >
      {icon}
      {label}
    </button>
  )
}
