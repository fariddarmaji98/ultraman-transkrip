import { useEffect, useRef, useState } from 'react'
import { getRecording, sourceUrl } from '../api'
import { currentSegment, isVideo } from '../utils'
import TranscriptHeader from './TranscriptHeader'
import SegmentList from './SegmentList'

const PENDING = ['queued', 'extracting', 'transcribing']
const PHASE = {
  queued: 'Mengantre…',
  extracting: 'Mengekstrak audio…',
  transcribing: 'Mentranskripsi…',
}

export default function TranscriptView({ id, onDone }) {
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

  if (!rec) return <p className="text-slate-500">Memuat…</p>
  return <Detail rec={rec} />
}

function Detail({ rec }) {
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
      <TranscriptHeader rec={rec} />
      <MediaPlayer rec={rec} mediaRef={mediaRef} onTime={onTime} />
      {PENDING.includes(rec.status) && (
        <ProgressBar status={rec.status} progress={rec.progress} />
      )}
      {rec.status === 'failed' && (
        <p className="text-red-600">Transkripsi gagal. Coba unggah ulang.</p>
      )}
      <Transcript rec={rec} activeIdx={activeIdx} onSeek={seek} />
    </div>
  )
}

function MediaPlayer({ rec, mediaRef, onTime }) {
  if (!rec.source_available) return null
  const Tag = isVideo(rec.source_filename) ? 'video' : 'audio'
  const cls =
    Tag === 'video' ? 'mb-4 max-h-96 w-full rounded-lg bg-black' : 'mb-4 w-full'
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
    <div className="mb-4">
      <div className="mb-1 flex justify-between text-sm text-slate-500">
        <span>{PHASE[status]}</span>
        <span>{progress}%</span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-slate-100">
        <div
          className="h-full rounded-full bg-indigo-500 transition-all duration-500"
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
    return <p className="text-slate-500">Tidak ada ucapan terdeteksi.</p>
  return null
}
