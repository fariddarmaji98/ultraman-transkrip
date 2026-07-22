import { useEffect, useRef, useState } from 'react'
import { getRecording, sourceUrl } from '../api'
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
  }, [id])

  const applyTitle = (title) => {
    setRec((r) => ({ ...r, title }))
    onDoneRef.current?.()
  }

  if (!rec) return <p className="p-6 text-fg3">Memuat…</p>
  return <Detail rec={rec} onTitleChange={applyTitle} onClose={onClose} />
}

function Detail({ rec, onTitleChange, onClose }) {
  const mediaRef = useRef(null)
  const [activeIdx, setActiveIdx] = useState(-1)

  const seek = (ms) => {
    mediaRef.current.currentTime = ms / 1000
    mediaRef.current.play()
  }
  const onTime = () =>
    setActiveIdx(currentSegment(rec.segments, mediaRef.current.currentTime))

  return (
    <div className="flex min-w-0 flex-1 flex-col">
      <TranscriptHeader rec={rec} onTitleChange={onTitleChange} onClose={onClose} />
      <div className="flex min-h-0 flex-1">
        <AiPanel rec={rec} />
        <SourcePanel
          rec={rec}
          mediaRef={mediaRef}
          activeIdx={activeIdx}
          onTime={onTime}
          onSeek={seek}
        />
      </div>
    </div>
  )
}

function SourcePanel({ rec, mediaRef, activeIdx, onTime, onSeek }) {
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
        {rec.status === 'downloaded' && <DownloadedNote />}
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

function DownloadedNote() {
  return (
    <div className="mb-5 rounded-xl border border-edge bg-panel2 p-4 text-sm">
      <p className="font-medium text-fg">Video tersimpan dan siap ditonton.</p>
      <p className="mt-1 text-xs leading-relaxed text-fg3">
        Transkrip belum dijalankan — tombolnya menyusul di fase berikutnya.
      </p>
    </div>
  )
}

function Transcript({ rec, activeIdx, onSeek }) {
  if (rec.segments.length > 0)
    return (
      <SegmentList segments={rec.segments} activeIdx={activeIdx} onSeek={onSeek} />
    )
  if (rec.status === 'done')
    return <p className="text-fg3">Tidak ada ucapan terdeteksi.</p>
  return null
}
