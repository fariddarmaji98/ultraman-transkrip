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

// Segmen terdekat untuk sebuah waktu — dipakai saat melompat, jadi sengaja
// tidak menuntut waktunya jatuh persis di dalam segmen: sitasi model bisa
// membulatkan detik, dan ada jeda hening di antara segmen.
export function nearestSegment(segments, ms) {
  const pos = segments.findIndex((s) => ms < s.end_ms)
  return pos === -1 ? segments.length - 1 : pos
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

// Ukuran file ringkas (mis. "1,4 GB" / "820 MB").
export function fmtBytes(n) {
  if (!n) return '0 MB'
  const gb = n / 1024 ** 3
  if (gb >= 1) return `${gb.toFixed(1).replace('.', ',')} GB`
  return `${Math.round(n / 1024 ** 2)} MB`
}

// Status yang masih berjalan — dipakai polling, statistik, dan bar progres.
const ACTIVE = ['queued', 'extracting', 'transcribing', 'downloading']
// Status khas unduhan: belum masuk pipeline transkrip sama sekali.
const DOWNLOAD_ONLY = ['downloading', 'downloaded']

export const isActive = (rec) => ACTIVE.includes(rec.status)
export const isDownload = (rec) => rec.source_kind === 'url'
export const inTranscriptPhase = (rec) => !DOWNLOAD_ONLY.includes(rec.status)

// Nama bahasa dari kode ISO. Katalognya datang dari GET /api/config — jangan
// pernah menyalinnya ke sini, karena daftar kedua yang ikut basi persis itu yang
// baru saja dibereskan. Kode di luar katalog ditampilkan apa adanya (Whisper
// mengenal ~100 bahasa, katalognya cuma 9), bukan dikosongkan.
export function langLabel(code, languages) {
  if (!code) return ''
  return (languages ?? []).find((l) => l.id === code)?.label ?? code
}

// Bahasa rekaman: yang diminta bila dipilih manual, kalau tidak yang terdeteksi.
export function recLang(rec, languages) {
  const code = rec.language !== 'auto' ? rec.language : rec.detected_language
  return langLabel(code, languages)
}

const VIDEO_EXT = ['mp4', 'mkv', 'webm', 'mov', 'avi', 'm4v']

// True bila nama file berekstensi video (untuk pilih <video> vs <audio>).
export function isVideo(filename) {
  const ext = (filename ?? '').split('.').pop()?.toLowerCase()
  return VIDEO_EXT.includes(ext)
}
