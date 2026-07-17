// Timestamp mm:ss dari milidetik.
export function fmtTime(ms) {
  const total = Math.floor(ms / 1000)
  const m = String(Math.floor(total / 60)).padStart(2, '0')
  const s = String(total % 60).padStart(2, '0')
  return `${m}:${s}`
}

// Indeks segmen yang sedang diputar (-1 bila tidak ada).
export function currentSegment(segments, currentSec) {
  const t = currentSec * 1000
  return segments.findIndex((s) => t >= s.start_ms && t < s.end_ms)
}
