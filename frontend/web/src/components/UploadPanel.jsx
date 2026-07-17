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
    <form className="upload" onSubmit={submit}>
      <label className="file-drop">
        <input
          type="file"
          accept="audio/*,video/*"
          onChange={(e) => setFile(e.target.files[0] ?? null)}
        />
        <span>{file ? file.name : 'Pilih audio / video…'}</span>
      </label>
      <select value={language} onChange={(e) => setLanguage(e.target.value)}>
        {LANGS.map(([v, label]) => (
          <option key={v} value={v}>{label}</option>
        ))}
      </select>
      <button type="submit" disabled={!file || progress !== null}>
        {progress !== null ? `Mengunggah ${progress}%` : 'Transkrip'}
      </button>
      {error && <p className="error small">{error}</p>}
    </form>
  )
}
