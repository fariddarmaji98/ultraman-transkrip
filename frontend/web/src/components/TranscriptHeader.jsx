import { exportUrl } from '../api'

const FORMATS = ['txt', 'srt', 'json']

export default function TranscriptHeader({ rec }) {
  return (
    <div className="tr-header">
      <h2>{rec.title}</h2>
      <div className="exports">
        <span className="muted small">Ekspor:</span>
        {FORMATS.map((f) => (
          <a key={f} href={exportUrl(rec.id, f)} className="exp-link">
            {f.toUpperCase()}
          </a>
        ))}
      </div>
    </div>
  )
}
