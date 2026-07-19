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

// Tanggal singkat lokal (mis. "19 Jul 2026").
export function fmtDate(iso) {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  return d.toLocaleDateString('id-ID', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

const VIDEO_EXT = ['mp4', 'mkv', 'webm', 'mov', 'avi', 'm4v']

// True bila nama file berekstensi video (untuk pilih <video> vs <audio>).
export function isVideo(filename) {
  const ext = (filename ?? '').split('.').pop()?.toLowerCase()
  return VIDEO_EXT.includes(ext)
}
