import { useState } from 'react'
import { uploadRecording } from '../api'

const LANGS = [
  ['auto', 'Deteksi otomatis'],
  ['id', 'Indonesia'],
  ['en', 'English'],
]

export default function UploadPanel({ onUploaded }) {
  const [file, setFile] = useState(null)
  const [language, setLanguage] = useState('auto')
  const [progress, setProgress] = useState(null)
  const [error, setError] = useState(null)

  async function submit(e) {
    e.preventDefault()
    if (!file) return
    setError(null)
    setProgress(0)
    try {
      const res = await uploadRecording(file, language, setProgress)
      setFile(null)
      onUploaded(res)
    } catch (err) {
      setError(err.message)
    } finally {
      setProgress(null)
    }
  }

  return (
    <form className="flex flex-col gap-2.5" onSubmit={submit}>
      <label className="relative flex min-h-[76px] cursor-pointer items-center justify-center rounded-xl border border-dashed border-edge2 bg-panel2 p-3 text-center text-sm text-fg2 transition hover:border-mint hover:text-fg">
        <input
          type="file"
          accept="audio/*,video/*"
          onChange={(e) => setFile(e.target.files[0] ?? null)}
          className="absolute inset-0 cursor-pointer opacity-0"
        />
        <span className="truncate">{file ? file.name : 'Pilih audio / video…'}</span>
      </label>
      <select
        value={language}
        onChange={(e) => setLanguage(e.target.value)}
        className="rounded-lg border border-edge bg-panel2 px-3 py-2 text-sm text-fg"
      >
        {LANGS.map(([v, label]) => (
          <option key={v} value={v}>{label}</option>
        ))}
      </select>
      <button
        type="submit"
        disabled={!file || progress !== null}
        className="rounded-lg bg-mint px-3 py-2 text-sm font-semibold text-canvas transition hover:bg-mint2 disabled:cursor-not-allowed disabled:opacity-40"
      >
        {progress !== null ? `Mengunggah ${progress}%` : 'Transkrip'}
      </button>
      {progress !== null && (
        <div className="h-1.5 overflow-hidden rounded-full bg-edge">
          <div
            className="h-full rounded-full bg-mint transition-all"
            style={{ width: `${progress}%` }}
          />
        </div>
      )}
      {error && <p className="text-xs text-red-400">{error}</p>}
    </form>
  )
}
