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
    <form
      className="flex flex-col gap-2.5 rounded-xl border border-slate-200 bg-white p-4 shadow-sm"
      onSubmit={submit}
    >
      <label className="relative flex min-h-[72px] cursor-pointer items-center justify-center rounded-lg border-[1.5px] border-dashed border-slate-200 p-2.5 text-center text-slate-500 transition hover:border-indigo-500 hover:bg-indigo-50">
        <input
          type="file"
          accept="audio/*,video/*"
          onChange={(e) => setFile(e.target.files[0] ?? null)}
          className="absolute inset-0 cursor-pointer opacity-0"
        />
        <span>{file ? file.name : 'Pilih audio / video…'}</span>
      </label>
      <select
        value={language}
        onChange={(e) => setLanguage(e.target.value)}
        className="rounded-lg border border-slate-200 bg-white px-3 py-2"
      >
        {LANGS.map(([v, label]) => (
          <option key={v} value={v}>{label}</option>
        ))}
      </select>
      <button
        type="submit"
        disabled={!file || progress !== null}
        className="rounded-lg bg-indigo-600 px-3 py-2 font-semibold text-white transition hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {progress !== null ? `Mengunggah ${progress}%` : 'Transkrip'}
      </button>
      {error && <p className="text-sm text-red-600">{error}</p>}
    </form>
  )
}
