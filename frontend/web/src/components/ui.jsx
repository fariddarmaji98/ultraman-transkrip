// Elemen UI yang berulang di banyak layar. Dikumpulkan di sini supaya rupanya
// tidak pelan-pelan menyimpang antar panel — sebelumnya tiap berkas menyalin
// kelas Tailwind yang sama, dan satu perbaikan harus diulang di semua tempat.

// Kartu isi panel: kotak bersudut membulat di atas latar panel2.
export function Card({ className = '', children }) {
  return (
    <div className={`rounded-xl border border-edge bg-panel2 p-4 ${className}`}>{children}</div>
  )
}

// Label pil (topik otomatis, label manual, status provider).
export function Tag({ children, mint, className = '' }) {
  const tone = mint ? 'border-mint/40 text-mint' : 'border-edge2 text-fg3'
  return (
    <span className={`rounded-full border px-2 py-px font-mono text-[10px] ${tone} ${className}`}>
      {children}
    </span>
  )
}
