// Popup setelan mesin AI (ringkasan & chat): pilih provider lokal atau API.
// Kunci API hanya dikirim ke backend — nilainya tidak pernah dibaca balik.
import { useEffect, useState } from 'react'
import { forgetLlmKey, getLlm, listLlmModels, setLlm, testLlm } from '../api'
import ConfirmModal from './ConfirmModal'

export default function SettingsModal({ onClose }) {
  const [cfg, setCfg] = useState(null)
  const [form, setForm] = useState({ provider: '', model: '', api_key: '', base_url: '' })
  const [test, setTest] = useState(null)
  const [busy, setBusy] = useState('')
  const [confirming, setConfirming] = useState(false)
  const [models, setModels] = useState(null) // null = belum dimuat; {ok, models|detail}

  useEffect(() => {
    getLlm().then((data) => {
      setCfg(data)
      setForm({
        provider: data.provider,
        model: data.model,
        api_key: '',
        base_url: data.base_url || '',
      })
    })
  }, [])

  function pick(p) {
    // Custom: model dikosongkan — tidak ada default yang bisa dijamin valid,
    // dan input teksnya memang disabled sampai daftar dimuat.
    const model = p.id === 'custom' ? '' : p.default_model
    setForm({ provider: p.id, model, api_key: '', base_url: cfg?.base_url || '' })
    setTest(null)
    setModels(null) // daftar model milik provider lama tidak boleh bocor ke yang baru
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

  async function forget() {
    setConfirming(false)
    await run('forget', async () => {
      await forgetLlmKey(form.provider)
      setCfg(await getLlm())
      setForm((f) => ({ ...f, api_key: '' }))
    })
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
          <ModelField
            value={form.model}
            onChange={(model) => setForm({ ...form, model })}
            models={models}
            busy={busy === 'models'}
            requireLoad={form.provider === 'custom'}
            onLoad={async () => {
              setModels(null)
              setTest(null)
              await run('models', async () => {
                const res = await listLlmModels(form)
                if (!res.ok) throw new Error(res.detail)
                setModels({ ok: true, models: res.models })
                // Custom: model harus dipilih dari daftar yang barusan divalidasi.
                // Nilai lama (mis. model provider sebelumnya) tidak berlaku lagi.
                if (form.provider === 'custom' && !res.models.some((m) => m.id === form.model)) {
                  setForm((f) => ({ ...f, model: '' }))
                }
              })
            }}
          />
          {form.provider === 'custom' && (
            <UrlField value={form.base_url} onChange={(base_url) => setForm({ ...form, base_url })} />
          )}
          {active?.needs_key && (
            <KeyField
              value={form.api_key}
              stored={active.key_set}
              onChange={(api_key) => setForm({ ...form, api_key })}
              onForget={() => setConfirming(true)}
            />
          )}
          {test && <TestBanner result={test} />}
          {confirming && (
            <ConfirmModal
              title="Hapus kunci API?"
              message={`Kunci ${active.label} akan dihapus dari server. Ringkasan dan chat tidak bisa dipakai sampai kamu memasukkan kunci baru.`}
              confirmLabel="Hapus kunci"
              onConfirm={forget}
              onCancel={() => setConfirming(false)}
            />
          )}
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

// Label opsi dropdown: "glm-5.3 · A · text, vision" — cermin gaya katalog
// BandelAI "(A, text)". Kemampuan hanya muncul bila provider melaporkannya;
// urutan tetap: grade dulu, lalu modality.
function modelLabel(m) {
  const bits = []
  if (m.grade) bits.push(m.grade)
  const caps = []
  if (m.text) caps.push('text')
  if (m.vision) caps.push('vision')
  if (caps.length) bits.push(caps.join(', '))
  return bits.length ? `${m.id} · ${bits.join(' · ')}` : m.id
}

// Model = dropdown yang datanya diambil dari provider (`GET /models`).
// Provider custom: freetext DI-DISABLE — daftar harus dimuat dulu, karena
// model proxy tidak bisa ditebak dan salah ketik = kegagalan senyap saat
// ringkasan dijalankan. Provider bawaan tetap boleh diketik (default katalog
// dijamin valid) — memuat daftar di sana adalah bantuan, bukan syarat.
function ModelField({ value, onChange, models, busy, onLoad, requireLoad }) {
  const loaded = models?.ok ? models.models : null
  return (
    <div className="mt-4">
      <div className="flex items-center justify-between">
        <span className="text-xs text-fg3">Model</span>
        <button
          type="button"
          onClick={onLoad}
          disabled={!!busy}
          className="text-[10px] text-fg3 transition hover:text-fg disabled:opacity-50"
        >
          {busy ? 'Memuat…' : 'Muat daftar model'}
        </button>
      </div>
      {loaded ? (
        <>
          <select
            value={loaded.some((m) => m.id === value) ? value : ''}
            onChange={(e) => onChange(e.target.value)}
            className="mt-1 w-full rounded-lg border border-edge bg-panel2 px-3 py-2 font-mono text-xs text-fg outline-none focus:border-mint/60"
          >
            {!loaded.some((m) => m.id === value) && (
              <option value="">{value || '— pilih model —'}</option>
            )}
            {loaded.map((m) => (
              <option key={m.id} value={m.id}>
                {modelLabel(m)}
              </option>
            ))}
          </select>
          <span className="mt-1 block text-[10px] text-fg3">
            {loaded.length} model dari provider — klik "Muat daftar model" untuk menyegarkan.
          </span>
        </>
      ) : (
        <>
          <input
            value={value}
            onChange={(e) => onChange(e.target.value)}
            disabled={requireLoad}
            placeholder={requireLoad ? 'klik "Muat daftar model" dulu' : ''}
            className="mt-1 w-full rounded-lg border border-edge bg-panel2 px-3 py-2 font-mono text-xs text-fg outline-none focus:border-mint/60 placeholder:font-sans placeholder:text-fg3 disabled:cursor-not-allowed disabled:opacity-60"
          />
          {models && !models.ok && (
            <span className="mt-1 block text-[10px] leading-snug text-amber-400">
              {models.detail}
            </span>
          )}
        </>
      )}
    </div>
  )
}

// Hanya tampil untuk provider Custom URL. Placeholder menjelaskan konvensi
// "/v1" karena itu kesalahan paling umum: base URL tanpa /v1 = 404 di
// /chat/completions, dan pesan errornya tidak menyebut penyebabnya.
function UrlField({ value, onChange }) {
  return (
    <label className="mt-3 block">
      <span className="text-xs text-fg3">Base URL</span>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="https://contoh-proxy.xyz/v1"
        spellCheck="false"
        className="mt-1 w-full rounded-lg border border-edge bg-panel2 px-3 py-2 font-mono text-xs text-fg outline-none focus:border-mint/60 placeholder:font-sans placeholder:text-fg3"
      />
    </label>
  )
}

// Kunci tersimpan -> field dikunci. Mengetik di atas kunci yang sudah ada bikin
// ambigu (mengganti? menambah?), jadi satu-satunya jalan ganti = hapus dulu.
function KeyField({ value, stored, onChange, onForget }) {
  return (
    <div className="mt-3">
      <div className="flex items-center justify-between text-xs text-fg3">
        <label htmlFor="llm-key">API key</label>
        {stored && (
          <button
            type="button"
            onClick={onForget}
            className="text-[10px] text-red-400 transition hover:underline"
          >
            Hapus kunci
          </button>
        )}
      </div>
      <input
        id="llm-key"
        type="password"
        autoComplete="off"
        disabled={stored}
        value={stored ? '' : value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={stored ? '•••••••••••• tersimpan di server' : 'tempel kunci di sini'}
        className="mt-1 w-full rounded-lg border border-edge bg-panel2 px-3 py-2 font-mono text-xs text-fg outline-none focus:border-mint/60 placeholder:font-sans placeholder:text-fg3 disabled:cursor-not-allowed disabled:opacity-60"
      />
      <KeyHint stored={stored} typed={!!value} />
    </div>
  )
}

function KeyHint({ stored, typed }) {
  if (stored)
    return (
      <span className="mt-1 block text-[10px] leading-snug text-fg3">
        Hapus kunci dulu bila ingin menggantinya.
      </span>
    )
  if (typed) return null
  return (
    <span className="mt-1 block text-[10px] leading-snug text-amber-400">
      Belum ada kunci tersimpan — provider ini belum bisa dipakai meski disimpan.
    </span>
  )
}

function TestBanner({ result }) {
  const tone = result.ok
    ? 'border-mint/30 bg-mint/5 text-mint'
    : 'border-red-500/30 bg-red-500/5 text-red-400'
  return (
    <p className={`mt-3 rounded-lg border px-3 py-2 text-xs leading-snug ${tone}`}>
      {result.detail}
      {/* Tes tidak menyimpan apa pun — tanpa pengingat ini, sukses hijau terasa "selesai". */}
      {result.ok && ' — klik Simpan agar kuncinya tersimpan.'}
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
