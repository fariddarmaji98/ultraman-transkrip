// Kolom tengah: dua tab — Ringkasan dan Chat. Dipisah tab supaya masing-masing
// dapat tinggi penuh; sebelumnya chat cuma kebagian sisa ruang di bawah kartu
// ringkasan. Tab yang tidak aktif disembunyikan (bukan dilepas) agar percakapan
// yang sedang dijawab tidak hilang saat pindah tab.
// Mesin AI-nya dipilih di popup Setelan — lihat ADR 0007.
import { useState } from 'react'
import { extractRecording, summarizeRecording } from '../api'
import { fmtDate, langLabel } from '../utils'
import useLocalState from '../hooks/useLocalState'
import ChatPanel from './ChatPanel'
import SummaryText from './SummaryText'
import TabBar from './TabBar'

// Kategori ekstraksi (ADR 0013) — urutan & label sama dengan backend
// `EXTRACT_CATEGORIES`/`EXTRACT_LABELS`. Label dikunci di sini untuk UI; ekspor
// brief sudah pakai label sendiri dari backend.
const CATEGORIES = [
  ['decisions', 'Keputusan'],
  ['requirements', 'Kebutuhan'],
  ['constraints', 'Batasan'],
  ['open_questions', 'Pertanyaan terbuka'],
]

export default function AiPanel({ rec, languages, lang, onSummarized, onSeek }) {
  const [tab, setTab] = useLocalState('ai-tab', 'ringkasan')
  const [chatCount, setChatCount] = useState(0)
  const ready = rec.status === 'done' && rec.segments?.length > 0
  const tabs = [
    { id: 'ringkasan', label: 'Ringkasan' },
    { id: 'context', label: 'Context' },
    { id: 'chat', label: 'Chat', count: chatCount },
  ]

  return (
    <section className="flex min-w-0 flex-1 flex-col">
      <TabBar
        tabs={tabs}
        active={tab}
        onChange={setTab}
        right={<LangAktif name={langLabel(lang, languages)} />}
      />
      <SummaryPane
        rec={rec}
        ready={ready}
        active={tab === 'ringkasan'}
        lang={lang}
        languages={languages}
        onSummarized={onSummarized}
      />
      <ExtractPane
        rec={rec}
        ready={ready}
        active={tab === 'context'}
        lang={lang}
        onExtracted={onSummarized}
        onSeek={onSeek}
      />
      <ChatPanel
        rec={rec}
        ready={ready}
        active={tab === 'chat'}
        lang={lang}
        onSeek={onSeek}
        onCount={setChatCount}
      />
    </section>
  )
}

// Penanda, bukan pemilih. Bahasanya satu untuk seluruh halaman (Fase C), jadi
// ia diubah di satu tempat saja — di atas transkrip, tempat terjemahan benar-benar
// dikerjakan. Dua pemilih untuk satu keadaan hanya membuat orang menebak mana
// yang menang.
function LangAktif({ name }) {
  return (
    <span
      title="Bahasa aktif — diubah lewat pemilih di atas transkrip"
      className="rounded-md border border-edge px-2 py-1 text-[11px] text-fg3"
    >
      {name}
    </span>
  )
}

function SummaryPane({ rec, ready, active, lang, languages, onSummarized }) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)

  async function run() {
    setBusy(true)
    setError(null)
    try {
      await summarizeRecording(rec.id, lang)
      onSummarized?.()
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className={`${active ? 'block' : 'hidden'} min-h-0 flex-1 overflow-y-auto p-5`}>
      <SummaryCard
        summary={rec.summary}
        ready={ready}
        busy={busy}
        error={error}
        langName={langLabel(lang, languages)}
        onRun={run}
      />
    </div>
  )
}

function SummaryCard({ summary, ready, busy, error, langName, onRun }) {
  return (
    <div className="rounded-xl border border-edge bg-panel2 p-4">
      <div className="flex items-baseline justify-between gap-2">
        <h3 className="text-sm font-semibold text-fg">Ringkasan</h3>
        {summary && (
          <span className="shrink-0 font-mono text-[10px] text-fg3">{summary.model}</span>
        )}
      </div>
      {summary ? (
        <div className="mt-2">
          <SummaryText text={summary.text} />
          <p className="mt-3 text-[10px] text-fg3">Dibuat {fmtDate(summary.created_at)}</p>
        </div>
      ) : (
        // Menyebut bahasanya: kartu kosong sesudah ganti bahasa harus terbaca
        // "belum dibuat untuk bahasa ini", bukan "ringkasannya hilang".
        <p className="mt-1 text-xs leading-relaxed text-fg3">
          Belum ada ringkasan berbahasa {langName} untuk rekaman ini.
        </p>
      )}
      <RunButton summary={summary} ready={ready} busy={busy} onRun={onRun} />
      {error && <p className="mt-2 text-xs leading-snug text-red-400">{error}</p>}
    </div>
  )
}

function RunButton({ summary, ready, busy, onRun }) {
  const label = busy ? 'Meringkas…' : summary ? 'Buat ulang' : 'Buat ringkasan'
  const style = summary
    ? 'border border-edge bg-panel text-fg2 hover:border-edge2 hover:text-fg'
    : 'bg-mint text-canvas hover:bg-mint2'
  return (
    <button
      onClick={onRun}
      disabled={!ready || busy}
      title={ready ? 'Memakai mesin AI dari popup Setelan' : 'Transkrip harus selesai dulu'}
      className={`mt-3 w-full rounded-lg px-3 py-2 text-xs font-semibold transition disabled:cursor-not-allowed disabled:opacity-40 ${style}`}
    >
      {ready ? label : 'Menunggu transkrip selesai'}
    </button>
  )
}

// --- Context (ADR 0013) ----------------------------------------------------
// Tab "Context": ekstraksi terstruktur (keputusan/kebutuhan/batasan/pertanyaan
// terbuka) yang bisa diklik menitnya. Cermin SummaryPane: sama-sama tombol
// "Buat ulang" yang memanggil mesin AI aktif, tapi render-nya per kategori.
function ExtractPane({ rec, ready, active, lang, onExtracted, onSeek }) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)

  async function run() {
    setBusy(true)
    setError(null)
    try {
      await extractRecording(rec.id, lang)
      onExtracted?.()
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className={`${active ? 'block' : 'hidden'} min-h-0 flex-1 overflow-y-auto p-5`}>
      <ExtractCard
        extract={rec.extract}
        ready={ready}
        busy={busy}
        error={error}
        onRun={run}
        onSeek={onSeek}
      />
    </div>
  )
}

function ExtractCard({ extract, ready, busy, error, onRun, onSeek }) {
  const has = extract && CATEGORIES.some(([key]) => extract[key]?.length > 0)
  return (
    <div className="rounded-xl border border-edge bg-panel2 p-4">
      <div className="flex items-baseline justify-between gap-2">
        <h3 className="text-sm font-semibold text-fg">Context terstruktur</h3>
        {extract && (
          <span className="shrink-0 font-mono text-[10px] text-fg3">{extract.model}</span>
        )}
      </div>
      {has ? (
        <div className="mt-2 space-y-4">
          {CATEGORIES.map(([key, label]) => (
            <Category key={key} label={label} items={extract[key] || []} onSeek={onSeek} />
          ))}
          <p className="text-[10px] text-fg3">
            Dibuat {fmtDate(extract.created_at)} — sitasi menit bisa diklik untuk melompat.
          </p>
        </div>
      ) : (
        <p className="mt-1 text-xs leading-relaxed text-fg3">
          {extract
            ? 'Ekstraksi untuk bahasa ini tidak menghasilkan item apa pun.'
            : 'Belum ada context terstruktur — ekstrak keputusan, kebutuhan, batasan, dan pertanyaan terbuka dari transkrip.'}
        </p>
      )}
      <button
        onClick={onRun}
        disabled={!ready || busy}
        title={ready ? 'Memakai mesin AI dari popup Setelan' : 'Transkrip harus selesai dulu'}
        className={`mt-3 w-full rounded-lg px-3 py-2 text-xs font-semibold transition disabled:cursor-not-allowed disabled:opacity-40 ${
          extract
            ? 'border border-edge bg-panel text-fg2 hover:border-edge2 hover:text-fg'
            : 'bg-mint text-canvas hover:bg-mint2'
        }`}
      >
        {!ready ? 'Menunggu transkrip selesai' : busy ? 'Mengekstrak…' : extract ? 'Buat ulang' : 'Ekstrak context'}
      </button>
      {error && <p className="mt-2 text-xs leading-snug text-red-400">{error}</p>}
    </div>
  )
}

function Category({ label, items, onSeek }) {
  if (!items.length) return null
  return (
    <div>
      <h4 className="text-xs font-medium text-fg2">{label}</h4>
      <ul className="mt-1.5 space-y-1.5">
        {items.map((it, i) => (
          <li key={i} className="flex items-start gap-2 text-xs leading-relaxed text-fg">
            <TimeStamp ms={it.at_ms} onSeek={onSeek} />
            <span className="whitespace-pre-wrap">{it.text}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}

function TimeStamp({ ms, onSeek }) {
  const minutes = Math.floor(ms / 60000)
  const seconds = Math.floor((ms % 60000) / 1000)
  const label = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
  return (
    <button
      onClick={() => onSeek?.(ms)}
      title="Putar dari menit ini"
      className="mt-px shrink-0 rounded border border-mint/40 px-1 font-mono text-[10px] text-mint transition hover:bg-mint/10"
    >
      {label}
    </button>
  )
}
