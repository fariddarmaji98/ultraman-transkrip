import { useEffect, useRef, useState } from 'react'
import { getRecording, mediaUrl } from '../api'
import { currentSegment } from '../utils'
import TranscriptHeader from './TranscriptHeader'
import SegmentList from './SegmentList'

const PENDING = ['queued', 'extracting', 'transcribing']

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
  if (PENDING.includes(rec.status)) return <Processing status={rec.status} />
  if (rec.status === 'failed')
    return <p className="text-red-600">Transkripsi gagal. Coba unggah ulang.</p>
  return <Transcript rec={rec} />
}

const PHASE = {
  queued: 'Mengantre…',
  extracting: 'Mengekstrak audio…',
  transcribing: 'Mentranskripsi…',
}

function Processing({ status }) {
  return (
    <div className="mt-16 flex flex-col items-center gap-3.5 text-slate-500">
      <div className="h-9 w-9 animate-spin rounded-full border-[3px] border-indigo-100 border-t-indigo-600" />
      <p>{PHASE[status]}</p>
    </div>
  )
}

function Transcript({ rec }) {
  const audioRef = useRef(null)
  const [activeIdx, setActiveIdx] = useState(-1)

  const seek = (ms) => {
    audioRef.current.currentTime = ms / 1000
    audioRef.current.play()
  }
  const onTime = () =>
    setActiveIdx(currentSegment(rec.segments, audioRef.current.currentTime))

  return (
    <div>
      <TranscriptHeader rec={rec} />
      {rec.media_available && (
        <audio
          ref={audioRef}
          src={mediaUrl(rec.id)}
          controls
          onTimeUpdate={onTime}
          className="mb-4 w-full"
        />
      )}
      <SegmentList segments={rec.segments} activeIdx={activeIdx} onSeek={seek} />
    </div>
  )
}
