import { useState } from 'react'
import { setModel } from '../api'

const HINT = 'Model diunduh otomatis saat pertama dipakai. Transkrip lama tidak berubah.'

export default function ModelPicker({ config, busy, onConfigChange }) {
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const choices = config?.models ?? []
  const known = choices.some((m) => m.id === config?.model)

  async function pick(id) {
    setSaving(true)
    setError('')
    try {
      onConfigChange(await setModel(id))
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  if (!known) return <StaticModel value={config?.model} />
  return (
    <div className="mt-1.5">
      <Label saving={saving} />
      <select
        value={config.model}
        disabled={saving || busy}
        onChange={(e) => pick(e.target.value)}
        className="w-full rounded-lg border border-edge bg-panel px-2 py-1.5 text-xs text-fg2 outline-none focus:border-mint/60 disabled:opacity-40"
      >
        {choices.map((m) => (
          <option key={m.id} value={m.id}>
            {m.label} · {m.size} · {m.note}
          </option>
        ))}
      </select>
      <Note busy={busy} error={error} />
    </div>
  )
}

function Label({ saving }) {
  return (
    <div className="flex items-center justify-between gap-2 pb-1 text-xs">
      <span className="text-fg3">Model</span>
      {saving && <span className="text-[10px] text-mint">menyimpan…</span>}
    </div>
  )
}

function Note({ busy, error }) {
  if (error) return <p className="mt-1 text-[10px] leading-snug text-red-400">{error}</p>
  const text = busy ? 'Ada transkrip berjalan — model terkunci sementara.' : HINT
  return <p className="mt-1 text-[10px] leading-snug text-fg3">{text}</p>
}

function StaticModel({ value }) {
  return (
    <div className="flex items-center justify-between gap-2 py-1 text-xs">
      <span className="text-fg3">Model</span>
      <span className="truncate font-mono text-fg2">{value ?? '…'}</span>
    </div>
  )
}
