import { useEffect, useRef, useState } from 'react'
import { getRecording, getTranslation, sourceUrl, startTranscribe, startTranslate } from '../api'
import { currentSegment, isVideo, nearestSegment } from '../utils'
import TranscriptHeader from './TranscriptHeader'
import SegmentList from './SegmentList'
import ProgressSteps from './ProgressSteps'
import AiPanel from './AiPanel'
import ResizeHandle from './ResizeHandle'
import usePanelWidth from '../hooks/usePanelWidth'
import useLocalState from '../hooks/useLocalState'
import TranscriptLangBar, { ASLI } from './TranscriptLangBar'

// Sama dengan DEFAULT_AI_LANGUAGE di backend/constants: membuka rekaman lama
// tanpa menyentuh pemilih harus memberi hasil yang sama seperti sebelum fitur
// ini ada, karena ringkasan & chat lama memang berbahasa Indonesia.
const DEFAULT_AI_LANG = 'id'
const TRANSCRIBING = ['queued', 'extracting', 'transcribing']
const RUNNING = ['queued', 'translating']   // job terjemahan yang masih jalan
const PENDING = [...TRANSCRIBING, 'downloading']  // masih berjalan -> terus di-poll
const SOURCE_W = { key: 'source-width', min: 360, max: 900, initial: 560, handleSide: 'left' }
const SCROLL_MS = 420  // durasi animasi gulir ke segmen tujuan
const PHASE = {
  queued: 'Mengantre…',
  extracting: 'Mengekstrak audio…',
  transcribing: 'Mentranskripsi…',
  downloading: 'Mengunduh video…',
}

export default function TranscriptView({ id, languages, onDone, onClose }) {
  const [rec, setRec] = useState(null)
  const [round, setRound] = useState(0)  // dinaikkan untuk memulai ulang polling
  const [error, setError] = useState(null)
  // SATU bahasa aktif untuk seluruh halaman — transkrip, ringkasan, dan chat.
  // Sebelumnya dua keadaan terpisah, dan itu membuat halaman bisa menampilkan
  // transkrip Jepang di sebelah ringkasan Indonesia tanpa ada yang salah.
  // ASLI = bahasa rekaman itu sendiri; selain itu = kode bahasa terjemahan.
  const [pilihan, setLang] = useLocalState('ai-lang', ASLI)
  const [trans, setTrans] = useState(null)
  const [tRound, setTRound] = useState(0)
  const [tError, setTError] = useState(null)
  const onDoneRef = useRef(onDone)
  onDoneRef.current = onDone

  // Bahasa asli baru diketahui setelah `rec` datang, jadi turunannya dihitung
  // ulang begitu itu terjadi — satu fetch tambahan, dan hanya untuk rekaman
  // yang bahasanya bukan default.
  const source = rec ? sourceLang(rec) : null
  // Pilihan lama dari Fase A bisa kebetulan sama dengan bahasa asli; itu berarti
  // "asli", bukan "terjemahkan ke bahasa yang sama".
  const tlang = pilihan === source ? ASLI : pilihan
  const aiLang = tlang === ASLI ? source ?? DEFAULT_AI_LANG : tlang

  useEffect(() => {
    let active = true
    const tick = async () => {
      const data = await getRecording(id, aiLang)
      if (!active) return
      setRec(data)
      if (PENDING.includes(data.status)) setTimeout(tick, 2000)
      else onDoneRef.current?.()
    }
    tick()
    return () => {
      active = false
    }
  }, [id, round, aiLang])

  useEffect(() => {
    setTError(null)
    if (tlang === ASLI) {
      setTrans(null)
      return
    }
    let active = true
    const tick = async () => {
      const data = await getTranslation(id, tlang).catch(() => null)
      if (!active || !data) return
      setTrans(data)
      if (RUNNING.includes(data.status)) setTimeout(tick, 2000)
    }
    tick()
    return () => {
      active = false
    }
  }, [id, tlang, tRound])

  async function translate() {
    setTError(null)
    try {
      await startTranslate(id, tlang)
      setTRound((n) => n + 1)
    } catch (err) {
      setTError(err.message)
    }
  }

  const applyTitle = (title) => {
    setRec((r) => ({ ...r, title }))
    onDoneRef.current?.()
  }

  async function transcribe() {
    setError(null)
    try {
      // Jangan pasang balasan POST ke state: bentuknya RecordingOut (tanpa
      // `segments`), sedangkan komponen ini butuh RecordingDetail. Cukup mulai
      // ulang polling — tick() langsung mengambil detail yang utuh.
      await startTranscribe(id)
      setRound((n) => n + 1)
    } catch (err) {
      setError(err.message)
    }
  }

  if (!rec) return <p className="p-6 text-fg3">Memuat…</p>
  return (
    <Detail
      rec={rec}
      languages={languages}
      lang={aiLang}
      tlang={tlang}
      trans={trans}
      tError={tError}
      onTlang={setLang}
      onTranslate={translate}
      error={error}
      onTranscribe={transcribe}
      onRefresh={() => setRound((n) => n + 1)}
      onTitleChange={applyTitle}
      onClose={onClose}
    />
  )
}

function Detail({
  rec, languages, lang, tlang, trans, tError, onTlang, onTranslate,
  error, onTranscribe, onRefresh, onTitleChange, onClose,
}) {
  const mediaRef = useRef(null)
  const scrollRef = useRef(null)
  const [activeIdx, setActiveIdx] = useState(-1)
  // Mode banding hanya bermakna saat ada terjemahan yang ditampilkan, jadi ia
  // hidup di sini dan padam sendiri begitu kembali ke bahasa asli.
  const [banding, setBanding] = useState(false)

  // Satu pintu untuk semua lompatan waktu — dari klik segmen maupun dari sitasi
  // di chat. Player boleh tidak ada (media kena retensi), transkripnya tetap
  // ikut bergulir ke titik yang dimaksud.
  //
  // Sengaja tanpa play(): klik menit memindahkan posisi, bukan mengubah status.
  // Yang sedang main tetap main, yang jeda tetap jeda — orang yang lagi membaca
  // jawaban chat tidak dikagetkan suara yang tiba-tiba menyala.
  const seek = (ms) => {
    const pos = nearestSegment(rec.segments ?? [], ms)
    if (mediaRef.current) mediaRef.current.currentTime = ms / 1000
    setActiveIdx(pos)  // jangan tunggu timeupdate: waktunya bisa jatuh di jeda hening
    revealSegment(scrollRef.current, pos)
  }

  // Jeda hening di antara segmen bikin `currentSegment` mengembalikan -1;
  // pertahankan sorotan terakhir daripada memadamkannya sekejap-sekejap.
  const onTime = () => {
    const pos = currentSegment(rec.segments ?? [], mediaRef.current.currentTime)
    if (pos !== -1) setActiveIdx(pos)
  }

  return (
    <div className="flex min-w-0 flex-1 flex-col">
      <TranscriptHeader
        rec={rec}
        languages={languages}
        tlang={tlang === ASLI ? undefined : tlang}
        onTitleChange={onTitleChange}
        onRetranscribe={onTranscribe}
        onClose={onClose}
      />
      <div className="flex min-h-0 flex-1">
        <AiPanel
          rec={rec}
          languages={languages}
          lang={lang}
          onSummarized={onRefresh}
          onSeek={seek}
        />
        <SourcePanel
          rec={rec}
          languages={languages}
          tlang={tlang}
          trans={trans}
          tError={tError}
          onTlang={onTlang}
          onTranslate={onTranslate}
          banding={banding}
          onBanding={setBanding}
          error={error}
          onTranscribe={onTranscribe}
          mediaRef={mediaRef}
          scrollRef={scrollRef}
          activeIdx={activeIdx}
          onTime={onTime}
          onSeek={seek}
        />
      </div>
    </div>
  )
}

// Gulirkan transkrip ke segmen tujuan — hanya bila ia belum terlihat, supaya
// klik pada segmen yang sudah di layar tidak menggeser bacaan orang.
function revealSegment(scroller, pos) {
  const el = scroller?.querySelector(`[data-pos="${pos}"]`)
  if (!el) return
  const view = scroller.getBoundingClientRect()
  // Player menempel di atas; segmen yang tertutup olehnya belum benar-benar terlihat.
  const top = scroller.querySelector('[data-sticky]')?.getBoundingClientRect().bottom ?? view.top
  const box = el.getBoundingClientRect()
  if (box.top >= top && box.bottom <= view.bottom) return
  // Pusatkan di ruang yang benar-benar terlihat, yaitu di bawah player.
  const tengah = (top + view.bottom) / 2 - box.height / 2
  glideTo(scroller, scroller.scrollTop + box.top - tengah)
}

let tujuanGlide = null  // lompatan terakhir yang menang, bila diklik beruntun

// Animasi gulir sendiri, bukan `behavior: 'smooth'` bawaan: browser mematikan
// yang bawaan saat `prefers-reduced-motion: reduce` — dan lingkungan tertentu
// (mis. panel pratinjau di editor) melaporkannya walau bukan maunya pengguna.
function glideTo(el, jauh) {
  const to = Math.max(0, Math.min(jauh, el.scrollHeight - el.clientHeight))
  const dari = el.scrollTop
  const mulai = performance.now()
  tujuanGlide = to
  const langkah = (now) => {
    if (tujuanGlide !== to) return  // sudah ada lompatan yang lebih baru
    const p = Math.min((now - mulai) / SCROLL_MS, 1)
    el.scrollTop = dari + (to - dari) * (1 - (1 - p) ** 3)  // ease-out kubik
    if (p < 1) requestAnimationFrame(langkah)
  }
  requestAnimationFrame(langkah)
  // Jaring pengaman: ada lingkungan yang cuma melukis saat perlu, jadi rAF bisa
  // berhenti di tengah animasi. Tujuannya wajib tercapai walau mulusnya hilang.
  setTimeout(() => {
    if (tujuanGlide === to && Math.abs(el.scrollTop - to) > 1) el.scrollTop = to
  }, SCROLL_MS + 80)
}

function SourcePanel({
  rec, languages, tlang, trans, tError, onTlang, onTranslate, banding, onBanding,
  error, onTranscribe, mediaRef, scrollRef, activeIdx, onTime, onSeek,
}) {
  const { width, dragging, handlers } = usePanelWidth(SOURCE_W)
  return (
    <section
      style={{ width }}
      className={`relative flex shrink-0 flex-col border-l border-edge ${
        dragging ? 'select-none' : ''
      }`}
    >
      <ResizeHandle side="left" dragging={dragging} handlers={handlers} />
      {/* Tanpa padding atas selama ada player: elemen `sticky` tidak boleh keluar
          dari content box induknya, jadi padding atas berubah jadi celah tempat
          teks yang lewat mengintip. Jaraknya diberikan player itu sendiri. */}
      <div
        ref={scrollRef}
        className={`min-h-0 flex-1 overflow-y-auto px-5 pb-5 ${
          rec.source_available ? '' : 'pt-5'
        }`}
      >
        <MediaPlayer rec={rec} mediaRef={mediaRef} onTime={onTime} />
        {rec.status === 'downloading' && (
          <ProgressBar status={rec.status} progress={rec.progress} />
        )}
        {rec.status === 'downloaded' && (
          <DownloadedCard onTranscribe={onTranscribe} error={error} />
        )}
        {TRANSCRIBING.includes(rec.status) && (
          <>
            <ProgressSteps status={rec.status} />
            <ProgressBar status={rec.status} progress={rec.progress} />
          </>
        )}
        {rec.status === 'failed' && (
          <p className="text-red-400">Gagal diproses. Cek pesan error, lalu coba lagi.</p>
        )}
        {rec.status === 'done' && rec.segments?.length > 0 && (
          <TranscriptLangBar
            languages={languages}
            source={sourceLang(rec)}
            value={tlang}
            trans={trans}
            error={tError}
            banding={banding}
            onChange={onTlang}
            onTranslate={onTranslate}
            onBanding={onBanding}
          />
        )}
        <Transcript
          rec={rec}
          segments={shownSegments(rec, tlang, trans, banding)}
          activeIdx={activeIdx}
          onSeek={onSeek}
        />
      </div>
    </section>
  )
}

function MediaPlayer({ rec, mediaRef, onTime }) {
  if (!rec.source_available) return null
  const Tag = isVideo(rec.source_filename) ? 'video' : 'audio'
  const cls =
    Tag === 'video'
      ? 'max-h-96 w-full rounded-xl border border-edge bg-black'
      : 'w-full'
  return (
    // Menempel di atas saat transkrip digulir — nonton sambil ikut membaca.
    // `-mx-5 px-5`: latarnya harus menutup sampai tepi kolom, kalau tidak teks
    // yang lewat di belakangnya mengintip di sela padding. `pt-5` menggantikan
    // padding atas induk yang sengaja ditiadakan (lihat SourcePanel).
    <div data-sticky className="sticky top-0 z-10 -mx-5 mb-5 bg-canvas px-5 pb-3 pt-5">
      <Tag
        ref={mediaRef}
        src={sourceUrl(rec.id)}
        controls
        onTimeUpdate={onTime}
        className={cls}
      />
    </div>
  )
}

function ProgressBar({ status, progress }) {
  return (
    <div className="mb-5 rounded-xl border border-mint/20 bg-mint/5 p-4">
      <div className="mb-2 flex items-center gap-2 text-sm font-medium text-mint">
        <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-mint/30 border-t-mint" />
        <span>{PHASE[status]}</span>
        <span className="ml-auto tabular-nums">{progress}%</span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-edge">
        <div
          className="h-full rounded-full bg-mint transition-all duration-500"
          style={{ width: `${progress}%` }}
        />
      </div>
    </div>
  )
}

function DownloadedCard({ onTranscribe, error }) {
  return (
    <div className="mb-5 rounded-xl border border-edge bg-panel2 p-4">
      <p className="text-sm font-medium text-fg">Video tersimpan dan siap ditonton.</p>
      <p className="mt-1 text-xs leading-relaxed text-fg3">
        Transkrip belum dijalankan. Prosesnya memakai CPU dan bisa lama untuk video panjang.
      </p>
      <button
        onClick={onTranscribe}
        className="mt-3 rounded-lg bg-mint px-3 py-2 text-xs font-semibold text-canvas transition hover:bg-mint2"
      >
        Transkrip sekarang
      </button>
      {error && <p className="mt-2 text-xs text-red-400">{error}</p>}
    </div>
  )
}

function Transcript({ rec, segments, activeIdx, onSeek }) {
  // `?.` sengaja: satu field hilang tak boleh merobohkan seluruh halaman.
  if (segments?.length > 0)
    return <SegmentList segments={segments} activeIdx={activeIdx} onSeek={onSeek} />
  if (rec.status === 'done')
    return <p className="text-fg3">Tidak ada ucapan terdeteksi.</p>
  return null
}

// Bahasa asli rekaman: yang diminta bila dipilih manual, kalau tidak yang
// terdeteksi. Dipakai untuk menulis "Asli (Indonesia)" dan untuk TIDAK
// menawarkan menerjemahkan ke bahasa yang sama dengan aslinya.
function sourceLang(rec) {
  return rec.language !== 'auto' ? rec.language : rec.detected_language
}

// Teks diganti, WAKTU TIDAK — timestamp tetap milik segmen asli, supaya
// player, sorotan, dan sitasi chat tetap menunjuk titik yang sama.
function shownSegments(rec, tlang, trans, banding) {
  const asli = rec.segments ?? []
  if (tlang === ASLI || !trans?.segments?.length) return asli
  const teks = new Map(trans.segments.map((t) => [t.idx, t.text]))
  return asli.map((s) => ({
    ...s,
    text: teks.get(s.idx) ?? s.text,
    // Hanya diisi saat mode banding: `SegmentList` memakai keberadaannya
    // sebagai penanda harus merender dua kolom, bukan flag terpisah.
    asli: banding ? s.text : undefined,
  }))
}
