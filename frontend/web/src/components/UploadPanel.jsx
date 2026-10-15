import { useRef, useState } from 'react'
import { uploadRecording } from '../api'

// Unggah file audio/video ke server. Tidak auto-transkrip — file tersimpan
// sebagai data mentah (status=downloaded), muncul di list Video Terunduh.
// Pilih file → langsung upload. Bahasa dipegang pipeline transkrip ("auto").
export default function UploadPanel({ onUploaded, onCancel, ...rest }) {
  const inputRef = useRef(null)
  const [progress, setProgress] = useState(null)
  const [error, setError] = useState(null)
  const [dragOver, setDragOver] = useState(false)

  async function doUpload(file) {
    if (!file) return
    setError(null)
    setProgress(0)
    try {
      const res = await uploadRecording(file, setProgress)
      onUploaded(res)
    } catch (err) {
      setError(err.message)
    } finally {
      setProgress(null)
      if (inputRef.current) inputRef.current.value = ''
    }
  }

  return (
    <div
      {...rest}
      className="flex flex-col gap-2"
      onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
      onDragLeave={() => setDragOver(false)}
      onDrop={(e) => {
        e.preventDefault()
        setDragOver(false)
        doUpload(e.dataTransfer.files[0])
      }}
    >
      <label
        data-test="upload-dropzone"
        className={`relative flex min-h-[76px] cursor-pointer items-center justify-center rounded-xl border border-dashed p-3 text-center text-sm transition ${
          dragOver
            ? 'border-mint bg-mint/5 text-mint'
            : 'border-edge2 bg-panel2 text-fg2 hover:border-mint hover:text-fg'
        }`}
      >
        <input
          data-test="upload-file-input"
          ref={inputRef}
          type="file"
          accept="audio/*,video/*"
          onChange={(e) => doUpload(e.target.files[0])}
          className="absolute inset-0 cursor-pointer opacity-0"
          disabled={progress !== null}
        />
        <span className="truncate">
          {progress !== null
            ? `Mengunggah ${progress}%`
            : error
              ? error
              : 'Klik atau seret audio / video ke sini'}
        </span>
      </label>
      {progress !== null && (
        <div data-test="upload-progress" className="h-1.5 overflow-hidden rounded-full bg-edge">
          <div
            className="h-full rounded-full bg-mint transition-all"
            style={{ width: `${progress}%` }}
          />
        </div>
      )}
      {progress === null && (
        <button
          data-test="upload-cancel"
          onClick={onCancel}
          className="self-end rounded-lg border border-edge px-3 py-1.5 text-xs text-fg3 transition hover:text-fg"
        >
          Batal
        </button>
      )}
    </div>
  )
}
