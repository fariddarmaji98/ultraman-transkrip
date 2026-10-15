// Progress flow: stepper tahap transkripsi (centang = selesai, titik = aktif, kosong = belum).
import Icon from './Icon'

const STEPS = ['Antre', 'Ekstrak', 'Transkrip', 'Selesai']
const PHASE_IDX = { queued: 0, extracting: 1, transcribing: 2, done: 3 }

export default function ProgressSteps({ status }) {
  const idx = PHASE_IDX[status] ?? 0
  return (
    <ol className="mb-5 flex">
      {STEPS.map((label, i) => (
        <Step
          key={label}
          label={label}
          state={i < idx ? 'done' : i === idx ? 'active' : 'upcoming'}
          first={i === 0}
          last={i === STEPS.length - 1}
        />
      ))}
    </ol>
  )
}

function Step({ label, state, first, last }) {
  return (
    <li className="flex flex-1 flex-col items-center">
      <div className="flex w-full items-center">
        <Line hidden={first} filled={state !== 'upcoming'} />
        <Dot state={state} />
        <Line hidden={last} filled={state === 'done'} />
      </div>
      <span
        className={`mt-1.5 text-xs ${
          state === 'upcoming' ? 'text-fg3' : 'font-medium text-fg2'
        }`}
      >
        {label}
      </span>
    </li>
  )
}

function Line({ hidden, filled }) {
  const color = filled ? 'bg-mint' : 'bg-edge2'
  return <span className={`h-0.5 flex-1 ${hidden ? 'invisible' : color}`} />
}

function Dot({ state }) {
  if (state === 'done')
    return (
      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-mint text-canvas">
        <Icon name="check" className="h-3.5 w-3.5" />
      </span>
    )
  if (state === 'active')
    return (
      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-mint">
        <span className="h-2 w-2 rounded-full bg-canvas" />
      </span>
    )
  return (
    <span className="h-6 w-6 shrink-0 rounded-full border-2 border-edge2 bg-panel" />
  )
}
