import { useEffect, useRef, useState } from 'react'
import { getRecording, sourceUrl, startTranscribe } from '../api'
import { currentSegment, isVideo } from '../utils'
import TranscriptHeader from './TranscriptHeader'
import SegmentList from './SegmentList'
import ProgressSteps from './ProgressSteps'
import AiPanel from './AiPanel'
import ResizeHandle from './ResizeHandle'
import usePanelWidth from '../hooks/usePanelWidth'

const TRANSCRIBING = ['queued', 'extracting', 'transcribing']
const PENDING = [...TRANSCRIBING, 'downloading']  // masih berjalan -> terus di-poll
const SOURCE_W = { key: 'source-width', min: 360, max: 900, initial: 560, handleSide: 'left' }
const PHASE = {
  queued: 'Mengantre…',
  extracting: 'Mengekstrak audio…',
  transcribing: 'Mentranskripsi…',
  downloading: 'Mengunduh video…',
}

export default function TranscriptView({ id, onDone, onClose }) {
  const [rec, setRec] = useState(null)
  const [round, setRound] = useState(0)  // dinaikkan untuk memulai ulang polling
  const [error, setError] = useState(null)
  const onDoneRef = useRef(onDone)
  onDoneRef.current = onDone

  useEffect(() => {
    let active = true
    const tick = async () => {
      const data = await getRecording(id)
      if (!active) return
      setRec(data)
      if (PENDING.includes(data.status)) setTimeout(tick, 2000)
      else onDoneRef.current?.()
    }
    tick()
    return () => {
      active = false
    }
  }, [id, round])

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
      error={error}
      onTranscribe={transcribe}
      onRefresh={() => setRound((n) => n + 1)}
      onTitleChange={applyTitle}
      onClose={onClose}
    />
  )
}

function Detail({ rec, error, onTranscribe, onRefresh, onTitleChange, onClose }) {
  const mediaRef = useRef(null)
  const [activeIdx, setActiveIdx] = useState(-1)

  const seek = (ms) => {
    mediaRef.current.currentTime = ms / 1000
    mediaRef.current.play()
  }
  const onTime = () =>
    setActiveIdx(currentSegment(rec.segments ?? [], mediaRef.current.currentTime))

  return (
    <div className="flex min-w-0 flex-1 flex-col">
      <TranscriptHeader
        rec={rec}
        onTitleChange={onTitleChange}
        onRetranscribe={onTranscribe}
        onClose={onClose}
      />
      <div className="flex min-h-0 flex-1">
        <AiPanel rec={rec} onSummarized={onRefresh} onSeek={seek} />
        <SourcePanel
          rec={rec}
          error={error}
          onTranscribe={onTranscribe}
          mediaRef={mediaRef}
          activeIdx={activeIdx}
          onTime={onTime}
          onSeek={seek}
        />
      </div>
    </div>
  )
}

function SourcePanel({ rec, error, onTranscribe, mediaRef, activeIdx, onTime, onSeek }) {
  const { width, dragging, handlers } = usePanelWidth(SOURCE_W)
  return (
    <section
      style={{ width }}
      className={`relative flex shrink-0 flex-col border-l border-edge ${
        dragging ? 'select-none' : ''
      }`}
    >
      <ResizeHandle side="left" dragging={dragging} handlers={handlers} />
      <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5">
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
        <Transcript rec={rec} activeIdx={activeIdx} onSeek={onSeek} />
      </div>
    </section>
  )
}

function MediaPlayer({ rec, mediaRef, onTime }) {
  if (!rec.source_available) return null
  const Tag = isVideo(rec.source_filename) ? 'video' : 'audio'
  const cls =
    Tag === 'video'
      ? 'mb-5 max-h-96 w-full rounded-xl border border-edge bg-black'
      : 'mb-5 w-full'
  return (
    <Tag
      ref={mediaRef}
      src={sourceUrl(rec.id)}
      controls
      onTimeUpdate={onTime}
      className={cls}
    />
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

function Transcript({ rec, activeIdx, onSeek }) {
  // `?.` sengaja: satu field hilang tak boleh merobohkan seluruh halaman.
  if (rec.segments?.length > 0)
    return (
      <SegmentList segments={rec.segments} activeIdx={activeIdx} onSeek={onSeek} />
    )
  if (rec.status === 'done')
    return <p className="text-fg3">Tidak ada ucapan terdeteksi.</p>
  return null
}
