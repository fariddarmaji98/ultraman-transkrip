// Form tempel URL. Backend memeriksa (probe) dulu sebelum mengunduh, jadi error
// platform/durasi/ukuran sudah muncul di sini — bukan setelah unduhan berjalan.
import { useState } from 'react'
import { createFromUrl } from '../api'

// Latar lebih gelap dari panel + tepi lebih terang. Dengan `border-edge` di atas
// `bg-panel2`, kolomnya terbaca seperti baris keterangan, bukan tempat mengetik.
const FIELD =
  'rounded-lg border border-edge2 bg-canvas px-3 py-2 text-sm text-fg outline-none ' +
  'transition placeholder:text-fg3 focus:border-mint'

export default function UrlForm({ onCreated }) {
  const [url, setUrl] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)

  async function submit(e) {
    e.preventDefault()
    if (!url.trim() || busy) return
    setBusy(true)
    setError(null)
    try {
      onCreated(await createFromUrl(url.trim()))
      setUrl('')
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <form className="flex flex-col gap-2.5" onSubmit={submit}>
      <input
        value={url}
        onChange={(e) => setUrl(e.target.value)}
        placeholder="Tempel URL video…"
        spellCheck="false"
        aria-label="URL video"
        className={FIELD}
      />
      <button
        type="submit"
        disabled={!url.trim() || busy}
        className="rounded-lg bg-mint px-3 py-2 text-sm font-semibold text-canvas transition hover:bg-mint2 disabled:cursor-not-allowed disabled:opacity-40"
      >
        {busy ? 'Memeriksa…' : 'Unduh video'}
      </button>
      {error && <p className="text-xs leading-snug text-red-400">{error}</p>}
      <Notice />
    </form>
  )
}

function Notice() {
  return (
    <div className="space-y-1 text-[10px] leading-relaxed text-fg3">
      <p>Maks 720p · 4 jam · 2 GB. TikTok dan X paling mulus; YouTube kadang minta login.</p>
      <p>
        Kamu bertanggung jawab atas ketentuan layanan platform dan hak cipta konten yang
        diunduh.
      </p>
    </div>
  )
}
