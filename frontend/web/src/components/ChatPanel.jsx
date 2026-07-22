// Tanya-jawab dengan transkrip. Percakapan tersimpan di server, jadi tidak
// hilang saat pindah rekaman atau reload.
import { useEffect, useRef, useState } from 'react'
import { clearChat, getChat, sendChat } from '../api'
import CitedText from './CitedText'
import ConfirmModal from './ConfirmModal'

export default function ChatPanel({ rec, ready, active, onSeek, onCount }) {
  const [messages, setMessages] = useState([])
  const [question, setQuestion] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const [confirming, setConfirming] = useState(false)
  const endRef = useRef(null)

  useEffect(() => {
    getChat(rec.id).then(setMessages).catch(() => {})
  }, [rec.id])

  useEffect(() => {
    onCount?.(messages.length)
  }, [messages, onCount])

  useEffect(() => {
    // `active` ikut jadi pemicu: scrollIntoView tak berpengaruh saat panel
    // masih display:none, jadi harus diulang begitu tabnya dibuka.
    if (active) endRef.current?.scrollIntoView({ block: 'end' })
  }, [messages, busy, active])

  async function send(e) {
    e.preventDefault()
    const text = question.trim()
    if (!text || busy) return
    setBusy(true)
    setError(null)
    setQuestion('')
    setMessages((prev) => [...prev, { id: 'sementara', role: 'user', text }])
    try {
      await sendChat(rec.id, text)
      setMessages(await getChat(rec.id))
    } catch (err) {
      setError(err.message)
      setMessages(await getChat(rec.id))  // buang pesan sementara
    } finally {
      setBusy(false)
    }
  }

  async function wipe() {
    setConfirming(false)
    await clearChat(rec.id)
    setMessages([])
    setError(null)
  }

  return (
    <>
      <section className={`min-h-0 flex-1 flex-col ${active ? 'flex' : 'hidden'}`}>
        <Header messages={messages} onClear={() => setConfirming(true)} />
        <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-5 py-4">
          {messages.length === 0 && !busy && <Empty ready={ready} />}
          {messages.map((m) => (
            <Bubble key={m.id} message={m} maxMs={rec.duration_ms} onSeek={onSeek} />
          ))}
          {busy && <p className="text-xs text-fg3">Menjawab…</p>}
          {error && <p className="text-xs leading-snug text-red-400">{error}</p>}
          <div ref={endRef} />
        </div>
        <Composer
          value={question}
          ready={ready}
          busy={busy}
          onChange={setQuestion}
          onSubmit={send}
        />
      </section>
      {confirming && (
        <ConfirmModal
          title="Bersihkan percakapan?"
          message="Seluruh tanya-jawab pada rekaman ini akan dihapus permanen. Transkrip dan ringkasan tidak terpengaruh."
          confirmLabel="Bersihkan"
          onConfirm={wipe}
          onCancel={() => setConfirming(false)}
        />
      )}
    </>
  )
}

// Judul "Chat" sudah ada di tab, jadi baris ini menampilkan yang belum
// terlihat di mana pun: mesin yang menjawab (sepola kartu Ringkasan).
// Percakapan kosong = tidak ada baris sama sekali, tidak ada ruang terbuang.
function Header({ messages, onClear }) {
  if (messages.length === 0) return null
  const model = [...messages].reverse().find((m) => m.model)?.model
  return (
    <div className="flex shrink-0 items-center justify-between border-b border-edge px-5 py-2">
      <span className="font-mono text-[10px] text-fg3">{model ?? ''}</span>
      <button
        onClick={onClear}
        className="text-[10px] text-fg3 transition hover:text-red-400"
      >
        Bersihkan
      </button>
    </div>
  )
}

function Empty({ ready }) {
  return (
    <div className="flex flex-col items-center gap-2 px-4 py-6 text-center">
      <p className="text-sm font-medium text-fg2">Tanya apa saja soal rekaman ini</p>
      <p className="max-w-xs text-xs leading-relaxed text-fg3">
        {ready
          ? 'Jawaban menyertakan menit sumbernya — klik untuk memutar dari titik itu.'
          : 'Menunggu transkrip selesai.'}
      </p>
    </div>
  )
}

function Bubble({ message, maxMs, onSeek }) {
  const mine = message.role === 'user'
  const box = mine
    ? 'ml-6 bg-mint/10 border-mint/25 text-fg'
    : 'mr-6 bg-panel2 border-edge text-fg2'
  return (
    <div className={`rounded-xl border px-3 py-2 text-xs leading-relaxed ${box}`}>
      {mine ? (
        message.text
      ) : (
        <CitedText text={message.text} maxMs={maxMs} onSeek={onSeek} />
      )}
    </div>
  )
}

function Composer({ value, ready, busy, onChange, onSubmit }) {
  return (
    <form onSubmit={onSubmit} className="border-t border-edge p-3">
      <div className="flex items-center gap-2 rounded-xl border border-edge2 bg-canvas px-3 py-2 transition focus-within:border-mint">
        <input
          value={value}
          disabled={!ready || busy}
          onChange={(e) => onChange(e.target.value)}
          placeholder={ready ? 'Tanya isi rekaman…' : 'Menunggu transkrip selesai'}
          aria-label="Pertanyaan"
          className="min-w-0 flex-1 bg-transparent text-sm text-fg outline-none placeholder:text-fg3 disabled:cursor-not-allowed"
        />
        <button
          type="submit"
          disabled={!ready || busy || !value.trim()}
          aria-label="Kirim"
          className="rounded-lg border border-edge p-1.5 text-fg3 transition hover:border-mint/50 hover:text-mint disabled:cursor-not-allowed disabled:opacity-40"
        >
          <SendIcon />
        </button>
      </div>
    </form>
  )
}

function SendIcon() {
  return (
    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d="M5 12h14M13 5l7 7-7 7" />
    </svg>
  )
}
