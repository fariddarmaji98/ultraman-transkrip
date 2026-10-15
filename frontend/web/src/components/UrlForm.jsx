// Form tempel URL. Backend memeriksa (probe) dulu sebelum mengunduh, jadi error
// platform/durasi/ukuran sudah muncul di sini — bukan setelah unduhan berjalan.
// Multi-URL: satu URL per baris, diproses berurutan.
import { useState } from 'react'
import { createFromUrl } from '../api'

const FIELD =
  'rounded-lg border border-edge2 bg-canvas px-3 py-2 text-xs leading-relaxed text-fg outline-none ' +
  'transition placeholder:text-fg3 focus:border-mint resize-none'

const PLACEHOLDER = [
  '- Tempel URL video',
  '- Gunakan baris baru untuk multi-unduh',
  '- Maks 720p · 4 jam · 2 GB',
  '- TikTok dan X paling mulus, YouTube kadang minta login',
].join('\n')

export default function UrlForm({ onCreated, onCancel, ...rest }) {
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)
  const [results, setResults] = useState(null)

  async function submit(e) {
    e.preventDefault()
    const urls = text.split('\n').map((u) => u.trim()).filter(Boolean)
    if (!urls.length || busy) return
    setBusy(true)
    setResults(null)
    const done = []
    for (const url of urls) {
      try {
        const res = await createFromUrl(url)
        onCreated(res)
        done.push({ url, ok: true })
      } catch (err) {
        done.push({ url, ok: false, error: err.message })
      }
    }
    const failed = done.filter((r) => !r.ok)
    if (failed.length === 0) {
      setText('')
    } else {
      setText(failed.map((r) => r.url).join('\n'))
    }
    setResults(done)
    setBusy(false)
  }

  const urlCount = text.split('\n').map((u) => u.trim()).filter(Boolean).length

  return (
    <form {...rest} className="flex flex-col gap-2.5" onSubmit={submit}>
      <textarea
        data-test="url-input"
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder={PLACEHOLDER}
        spellCheck="false"
        rows={5}
        aria-label="URL video"
        className={FIELD}
      />
      <div className="flex items-center justify-between gap-2">
        <button
          data-test="url-cancel"
          type="button"
          onClick={onCancel}
          disabled={busy}
          className="rounded-lg border border-edge px-3 py-2 text-sm text-fg3 transition hover:text-fg disabled:opacity-40"
        >
          Batal
        </button>
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-fg3">
            {urlCount > 0 ? `${urlCount} URL siap diunduh` : ''}
          </span>
          <button
            data-test="url-submit"
            type="submit"
            disabled={!urlCount || busy}
            className="rounded-lg bg-mint px-3 py-2 text-sm font-semibold text-canvas transition hover:bg-mint2 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {busy ? 'Memproses…' : urlCount > 1 ? `Unduh ${urlCount} video` : 'Unduh video'}
          </button>
        </div>
      </div>
      {results && (
        <div data-test="url-results" className="space-y-1">
          {results.map((r, i) => (
            <p key={i} className={`text-[10px] leading-snug ${r.ok ? 'text-mint' : 'text-red-400'}`}>
              {r.ok ? '✓' : '✗'} {r.url.length > 50 ? r.url.slice(0, 50) + '…' : r.url}
              {!r.ok && ` — ${r.error}`}
            </p>
          ))}
        </div>
      )}
    </form>
  )
}
