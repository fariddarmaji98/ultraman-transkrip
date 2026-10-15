// Ikon SVG bersama. Sebelumnya 18 fungsi inline tersebar di 10 berkas —
// termasuk dua `CheckIcon` kembar. Satu registri di sini supaya ukuran, warna,
// dan gaya jalurnya tidak pelan-pelan menyimpang antar layar.
//
// `body` untuk ikon berbilang elemen (gigi: lingkaran + jalur; spinner: dua
// busur). Sisanya cukup `d` — atribut pembungkusnya seragam per mode.
const STROKE = { mode: 'stroke', sw: 1.7, vb: '0 0 24 24' }
const FILL = { mode: 'fill', vb: '0 0 20 20' }

const ICONS = {
  // --- garis ---
  mic: { ...STROKE, sw: 1.8, d: 'M12 15a3 3 0 0 0 3-3V6a3 3 0 1 0-6 0v6a3 3 0 0 0 3 3Zm0 0v4m-4 0h8m-9-9a5 5 0 0 0 10 0' },
  gear: {
    ...STROKE,
    body: (
      <>
        <circle cx="12" cy="12" r="3" />
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M19.4 15a1.7 1.7 0 0 0 .34 1.87l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.7 1.7 0 0 0-1.87-.34 1.7 1.7 0 0 0-1.03 1.56V21a2 2 0 1 1-4 0v-.09A1.7 1.7 0 0 0 9 19.4a1.7 1.7 0 0 0-1.87.34l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.7 1.7 0 0 0 4.6 15a1.7 1.7 0 0 0-1.56-1.03H3a2 2 0 1 1 0-4h.09A1.7 1.7 0 0 0 4.6 9a1.7 1.7 0 0 0-.34-1.87l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.7 1.7 0 0 0 9 4.6a1.7 1.7 0 0 0 1.03-1.56V3a2 2 0 1 1 4 0v.09A1.7 1.7 0 0 0 15 4.6a1.7 1.7 0 0 0 1.87-.34l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.7 1.7 0 0 0 19.4 9v.09a1.7 1.7 0 0 0 1.56 1.03H21a2 2 0 1 1 0 4h-.09a1.7 1.7 0 0 0-1.51 1.03Z"
        />
      </>
    ),
  },
  save: { ...STROKE, d: 'M12 4v11m0 0 4-4m-4 4-4-4M5 17v1.5A1.5 1.5 0 0 0 6.5 20h11a1.5 1.5 0 0 0 1.5-1.5V17' },
  retry: { ...STROKE, d: 'M4 4v5h5M20 20v-5h-5M5 9a7 7 0 0 1 12-3l1 1M19 15a7 7 0 0 1-12 3l-1-1' },
  trash: { ...STROKE, sw: 1.6, d: 'M6 7h12M9 7V5.5A1.5 1.5 0 0 1 10.5 4h3A1.5 1.5 0 0 1 15 5.5V7m2 0-.6 11.1a2 2 0 0 1-2 1.9H9.6a2 2 0 0 1-2-1.9L7 7m3 3.5v6m4-6v6' },
  link: { ...STROKE, d: 'M9 15l6-6m-3-3l1-1a4 4 0 016 6l-1 1m-6 6l-1 1a4 4 0 01-6-6l1-1' },
  file: { ...STROKE, d: 'M14 3v5h5M14 3l5 5v11a2 2 0 01-2 2H7a2 2 0 01-2-2V5a2 2 0 012-2h7z' },
  send: { ...STROKE, sw: 1.8, d: 'M5 12h14M13 5l7 7-7 7' },
  close: { ...STROKE, sw: 1.8, d: 'M6 6l12 12M18 6 6 18' },
  warning: { ...STROKE, sw: 1.5, d: 'M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z' },
  wave: { ...STROKE, sw: 1.8, d: 'M4 12h1m3-5v10m4-14v18m4-14v10m3-6h1' },
  spinner: {
    ...STROKE,
    anim: 'animate-spin',
    body: (
      <>
        <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="3" strokeOpacity="0.25" />
        <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
      </>
    ),
  },
  // --- padat ---
  'check-circle': { ...FILL, d: 'M10 18a8 8 0 1 0 0-16 8 8 0 0 0 0 16Zm3.857-9.809a.75.75 0 0 0-1.214-.882l-3.483 4.79-1.88-1.88a.75.75 0 1 0-1.06 1.061l2.5 2.5a.75.75 0 0 0 1.137-.089l4-5.5Z' },
  alert: { ...FILL, d: 'M18 10A8 8 0 1 1 2 10a8 8 0 0 1 16 0Zm-8-5a.75.75 0 0 1 .75.75v4.5a.75.75 0 0 1-1.5 0v-4.5A.75.75 0 0 1 10 5Zm0 10a1 1 0 1 0 0-2 1 1 0 0 0 0 2Z' },
  download: { ...FILL, d: 'M10 2a.75.75 0 0 1 .75.75v7.19l2.22-2.22a.75.75 0 1 1 1.06 1.06l-3.5 3.5a.75.75 0 0 1-1.06 0l-3.5-3.5a.75.75 0 0 1 1.06-1.06l2.22 2.22V2.75A.75.75 0 0 1 10 2ZM3.5 14a.75.75 0 0 1 .75.75v1.5h11.5v-1.5a.75.75 0 0 1 1.5 0v2.25a.75.75 0 0 1-.75.75H3.5a.75.75 0 0 1-.75-.75v-2.25A.75.75 0 0 1 3.5 14Z' },
  clock: { ...FILL, d: 'M10 18a8 8 0 1 0 0-16 8 8 0 0 0 0 16Zm.75-13a.75.75 0 0 0-1.5 0v5c0 .414.336.75.75.75h4a.75.75 0 0 0 0-1.5h-3.25V5Z' },
  pause: { ...FILL, d: 'M7 4a1 1 0 0 1 1 1v10a1 1 0 0 1-2 0V5a1 1 0 0 1 1-1Zm6 0a1 1 0 0 1 1 1v10a1 1 0 0 1-2 0V5a1 1 0 0 1 1-1Z' },
  check: { ...FILL, d: 'M16.7 5.3a1 1 0 0 1 0 1.4l-7.5 7.5a1 1 0 0 1-1.4 0L3.3 9.7a1 1 0 0 1 1.4-1.4L8.5 12l6.8-6.7a1 1 0 0 1 1.4 0Z' },
}

export default function Icon({ name, className = 'h-4 w-4' }) {
  const ic = ICONS[name]
  if (!ic) return null
  const solid = ic.mode === 'fill'
  return (
    <svg
      className={ic.anim ? `${className} ${ic.anim}` : className}
      viewBox={ic.vb}
      fill={solid ? 'currentColor' : 'none'}
      stroke={solid ? undefined : 'currentColor'}
      strokeWidth={solid ? undefined : ic.sw}
      aria-hidden="true"
    >
      {ic.body ?? (
        <path
          d={ic.d}
          fillRule={solid ? 'evenodd' : undefined}
          clipRule={solid ? 'evenodd' : undefined}
          strokeLinecap={solid ? undefined : 'round'}
          strokeLinejoin={solid ? undefined : 'round'}
        />
      )}
    </svg>
  )
}
