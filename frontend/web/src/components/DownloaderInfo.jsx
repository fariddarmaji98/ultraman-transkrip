// Versi yt-dlp + umurnya. Extractor rusak tiap situs berubah, jadi versi basi
// adalah penyebab kegagalan unduh nomor satu — ia harus kelihatan, bukan tersembunyi.
import SectionLabel from './SectionLabel'

export default function DownloaderInfo({ downloader }) {
  if (!downloader) return null
  const { version, age_days: age, stale } = downloader
  return (
    <div className="rounded-xl border border-edge bg-panel2 p-3">
      <SectionLabel>Mesin unduh</SectionLabel>
      <div className="flex items-center justify-between gap-2 py-0.5 text-xs">
        <span className="text-fg3">yt-dlp</span>
        <span className="truncate font-mono text-fg2">{version}</span>
      </div>
      <p className={`mt-1.5 text-[10px] leading-relaxed ${stale ? 'text-amber-400' : 'text-fg3'}`}>
        {label(age, stale)}
      </p>
    </div>
  )
}

function label(age, stale) {
  if (age === null || age === undefined) return 'Umur versi tidak terbaca.'
  if (stale)
    // Pemeliharaan sudah otomatis (app/updater.py): instruksi manual tidak lagi
    // relevan untuk pengguna — yang perlu diketahui hanya sedang dikejar otomatis.
    return `Versi berumur ${age} hari — pembaruan otomatis akan memperbarui saat rilis nightly tersedia.`
  return `Versi berumur ${age} hari — diperbarui otomatis setiap hari.`
}
