// Cookies per-platform. Kredensial: isinya tidak pernah dikirim balik dari server,
// UI hanya tahu "ada" atau "tidak ada" — sepola kunci API di ADR 0007.
import { useEffect, useState } from 'react'
import { forgetCookies, getCookies, uploadCookies } from '../api'
import ConfirmModal from './ConfirmModal'
import SectionLabel from './SectionLabel'

export default function CookiesPanel() {
  const [data, setData] = useState(null)
  const [busy, setBusy] = useState('')
  const [error, setError] = useState(null)
  const [confirming, setConfirming] = useState(null)

  useEffect(() => {
    getCookies().then(setData).catch(() => {})
  }, [])

  async function run(id, fn) {
    setBusy(id)
    setError(null)
    try {
      await fn()
      setData(await getCookies())
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy('')
    }
  }

  if (!data) return null
  return (
    <div className="rounded-xl border border-edge bg-panel2 p-3">
      <SectionLabel>Cookies platform</SectionLabel>
      <div className="space-y-2.5">
        {data.platforms.map((p) => (
          <Row
            key={p.id}
            p={p}
            busy={busy === p.id}
            onUpload={(file) => run(p.id, () => uploadCookies(p.id, file))}
            onForget={() => setConfirming(p)}
          />
        ))}
      </div>
      {error && <p className="mt-2 text-[10px] leading-snug text-red-400">{error}</p>}
      <p className="mt-2.5 text-[10px] leading-relaxed text-fg3">
        Ekspor `cookies.txt` format Netscape dari peramban tempat kamu sudah login.
        Berkas disimpan di server dan tidak pernah ditampilkan lagi.
      </p>
      {confirming && (
        <ConfirmModal
          title={`Hapus cookies ${confirming.label}?`}
          message="Unduhan dari platform ini akan kembali memakai akses publik saja, dan konten yang butuh login akan gagal."
          confirmLabel="Hapus cookies"
          onConfirm={() => {
            const id = confirming.id
            setConfirming(null)
            run(id, () => forgetCookies(id))
          }}
          onCancel={() => setConfirming(null)}
        />
      )}
    </div>
  )
}

function Row({ p, busy, onUpload, onForget }) {
  return (
    <div>
      <div className="flex items-center justify-between gap-2">
        <span className="flex items-center gap-1.5 text-xs text-fg2">
          {p.label}
          {p.stored && (
            <span className="rounded-full border border-mint/40 px-1.5 py-px text-[10px] text-mint">
              tersimpan
            </span>
          )}
        </span>
        {p.stored ? (
          <button
            onClick={onForget}
            className="shrink-0 text-[10px] text-red-400 transition hover:underline"
          >
            Hapus
          </button>
        ) : (
          <UploadButton busy={busy} onPick={onUpload} />
        )}
      </div>
      <p className="mt-0.5 text-[10px] leading-snug text-fg3">{p.note}</p>
    </div>
  )
}

function UploadButton({ busy, onPick }) {
  return (
    <label className="shrink-0 cursor-pointer rounded border border-edge px-2 py-0.5 text-[10px] text-fg3 transition hover:border-edge2 hover:text-fg">
      <input
        type="file"
        accept=".txt,text/plain"
        className="hidden"
        onChange={(e) => e.target.files[0] && onPick(e.target.files[0])}
      />
      {busy ? 'Mengunggah…' : 'Unggah'}
    </label>
  )
}
