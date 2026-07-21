// Popup setelan mesin AI (ringkasan & chat): pilih provider lokal atau API.
// Kunci API hanya dikirim ke backend — nilainya tidak pernah dibaca balik.
import { useEffect, useState } from 'react'
import { forgetLlmKey, getLlm, setLlm, testLlm } from '../api'

export default function SettingsModal({ onClose }) {
  const [cfg, setCfg] = useState(null)
  const [form, setForm] = useState({ provider: '', model: '', api_key: '' })
  const [test, setTest] = useState(null)
  const [busy, setBusy] = useState('')

  useEffect(() => {
    getLlm().then((data) => {
      setCfg(data)
      setForm({ provider: data.provider, model: data.model, api_key: '' })
    })
  }, [])

  function pick(p) {
    setForm({ provider: p.id, model: p.default_model, api_key: '' })
    setTest(null)
  }

  async function run(kind, fn) {
    setBusy(kind)
    setTest(null)
    try {
      await fn()
    } catch (err) {
      setTest({ ok: false, detail: err.message })
    } finally {
      setBusy('')
    }
  }

  const active = cfg?.providers.find((p) => p.id === form.provider)
  return (
    <Shell onClose={onClose}>
      {!cfg ? (
        <p className="py-6 text-sm text-fg3">Memuat setelan…</p>
      ) : (
        <>
          <div className="max-h-64 space-y-1.5 overflow-y-auto pr-1">
            {cfg.providers.map((p) => (
              <ProviderOption
                key={p.id}
                p={p}
                selected={p.id === form.provider}
                onSelect={() => pick(p)}
              />
            ))}
          </div>
          <ModelField value={form.model} onChange={(model) => setForm({ ...form, model })} />
          {active?.needs_key && (
            <KeyField
              value={form.api_key}
              stored={active.key_set}
              onChange={(api_key) => setForm({ ...form, api_key })}
              onForget={() => run('forget', async () => {
                await forgetLlmKey(active.id)
                setCfg(await getLlm())
              })}
            />
          )}
          {test && <TestBanner result={test} />}
          <Actions
            busy={busy}
            onClose={onClose}
            onTest={() => run('test', async () => setTest(await testLlm(form)))}
            onSave={() => run('save', async () => {
              await setLlm(form)
              onClose()
            })}
          />
        </>
      )}
    </Shell>
  )
}

function Shell({ children, onClose }) {
  return (
    <div className="relative z-30" role="dialog" aria-modal="true">
      <div className="fixed inset-0 bg-black/60" onClick={onClose} />
      <div className="fixed inset-0 z-30 flex min-h-full items-center justify-center p-4">
        <div className="relative w-full max-w-lg rounded-xl border border-edge bg-panel p-6 shadow-2xl">
          <h3 className="text-base font-semibold text-fg">Mesin AI</h3>
          <p className="mb-4 mt-1 text-xs text-fg3">
            Dipakai untuk ringkasan dan chat transkrip. Transkripsi tetap memakai engine di panel
            Engine.
          </p>
          {children}
        </div>
      </div>
    </div>
  )
}

function ProviderOption({ p, selected, onSelect }) {
  const ring = selected ? 'border-mint/60 bg-mint/5' : 'border-edge bg-panel2 hover:border-edge2'
  return (
    <button
      onClick={onSelect}
      className={`flex w-full items-start gap-3 rounded-lg border p-3 text-left transition ${ring}`}
    >
      <span className={`mt-0.5 h-3.5 w-3.5 shrink-0 rounded-full border-2 ${
        selected ? 'border-mint bg-mint' : 'border-edge2'
      }`} />
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-2">
          <span className="text-sm font-medium text-fg">{p.label}</span>
          {!p.needs_key && <Tag>tanpa kunci</Tag>}
          {p.key_set && <Tag mint>kunci tersimpan</Tag>}
        </span>
        <span className="mt-0.5 block text-xs leading-snug text-fg3">{p.note}</span>
      </span>
    </button>
  )
}

function Tag({ children, mint }) {
  const tone = mint ? 'border-mint/40 text-mint' : 'border-edge2 text-fg3'
  return <span className={`rounded-full border px-1.5 py-px text-[10px] ${tone}`}>{children}</span>
}

function ModelField({ value, onChange }) {
  return (
    <label className="mt-4 block">
      <span className="text-xs text-fg3">Model</span>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1 w-full rounded-lg border border-edge bg-panel2 px-3 py-2 font-mono text-xs text-fg outline-none focus:border-mint/60"
      />
    </label>
  )
}

function KeyField({ value, stored, onChange, onForget }) {
  return (
    <label className="mt-3 block">
      <span className="flex items-center justify-between text-xs text-fg3">
        <span>API key</span>
        {stored && (
          <button onClick={onForget} type="button" className="text-[10px] text-red-400 hover:underline">
            hapus kunci tersimpan
          </button>
        )}
      </span>
      <input
        type="password"
        autoComplete="off"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={stored ? 'tersimpan — kosongkan bila tidak diubah' : 'tempel kunci di sini'}
        className="mt-1 w-full rounded-lg border border-edge bg-panel2 px-3 py-2 font-mono text-xs text-fg outline-none focus:border-mint/60 placeholder:font-sans placeholder:text-fg3"
      />
    </label>
  )
}

function TestBanner({ result }) {
  const tone = result.ok
    ? 'border-mint/30 bg-mint/5 text-mint'
    : 'border-red-500/30 bg-red-500/5 text-red-400'
  return (
    <p className={`mt-3 rounded-lg border px-3 py-2 text-xs leading-snug ${tone}`}>
      {result.detail}
    </p>
  )
}

function Actions({ busy, onTest, onSave, onClose }) {
  return (
    <div className="mt-5 flex items-center gap-2">
      <button
        onClick={onTest}
        disabled={!!busy}
        className="rounded-md border border-edge bg-panel2 px-3 py-2 text-xs font-semibold text-fg transition hover:border-edge2 disabled:opacity-50"
      >
        {busy === 'test' ? 'Menguji…' : 'Tes koneksi'}
      </button>
      <span className="flex-1" />
      <button
        onClick={onClose}
        className="rounded-md border border-edge px-3 py-2 text-xs font-semibold text-fg2 transition hover:border-edge2"
      >
        Batal
      </button>
      <button
        onClick={onSave}
        disabled={!!busy}
        className="rounded-md bg-mint px-3 py-2 text-xs font-semibold text-canvas transition hover:bg-mint2 disabled:opacity-50"
      >
        {busy === 'save' ? 'Menyimpan…' : 'Simpan'}
      </button>
    </div>
  )
}
