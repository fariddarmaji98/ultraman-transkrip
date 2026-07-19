import { useEffect, useRef, useState } from 'react'
import { getRecording, sourceUrl } from '../api'
import { currentSegment, isVideo } from '../utils'
import TranscriptHeader from './TranscriptHeader'
import SegmentList from './SegmentList'
import ProgressSteps from './ProgressSteps'

const PENDING = ['queued', 'extracting', 'transcribing']
const PHASE = {
  queued: 'Mengantre…',
  extracting: 'Mengekstrak audio…',
  transcribing: 'Mentranskripsi…',
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
    <div>
      <TranscriptHeader rec={rec} onTitleChange={onTitleChange} onClose={onClose} />
      <div className="mx-auto max-w-3xl px-6 py-6">
        <MediaPlayer rec={rec} mediaRef={mediaRef} onTime={onTime} />
        {PENDING.includes(rec.status) && (
          <>
            <ProgressSteps status={rec.status} />
            <ProgressBar status={rec.status} progress={rec.progress} />
          </>
        )}
        {rec.status === 'failed' && (
          <p className="text-red-400">Transkripsi gagal. Coba unggah ulang.</p>
        )}
        <Transcript rec={rec} activeIdx={activeIdx} onSeek={seek} />
      </div>
    </div>
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

function Transcript({ rec, activeIdx, onSeek }) {
  if (rec.segments.length > 0)
    return (
      <SegmentList segments={rec.segments} activeIdx={activeIdx} onSeek={onSeek} />
    )
  if (rec.status === 'done')
    return <p className="text-fg3">Tidak ada ucapan terdeteksi.</p>
  return null
}
