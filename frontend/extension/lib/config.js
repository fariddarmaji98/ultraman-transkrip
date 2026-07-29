// Satu-satunya tempat alamat backend & angka ajaib hidup (AGENTS.md: jangan tersebar).
export const DEFAULTS = {
  apiBase: 'http://localhost:8000/api',
  // 5 detik: cukup kecil agar putusnya jaringan tak memakan banyak audio,
  // cukup besar agar satu meeting sejam tidak jadi ribuan permintaan.
  timesliceMs: 5000,
  uploadRetries: 3,
  retryDelayMs: 1500,
}

// Cocokkan domain tab dengan platform yang dikenal backend (MEETING_PLATFORMS).
const HOSTS = [
  [/(^|\.)meet\.google\.com$/, 'meet'],
  [/(^|\.)zoom\.(us|com)$/, 'zoom'],
  [/(^|\.)teams\.(microsoft|live)\.com$/, 'teams'],
]

export function platformOf(url) {
  try {
    const host = new URL(url).hostname
    return HOSTS.find(([re]) => re.test(host))?.[1] ?? 'lain'
  } catch {
    return 'lain'
  }
}

export async function getSettings() {
  const saved = await chrome.storage.local.get('settings')
  return { ...DEFAULTS, ...(saved.settings ?? {}) }
}

export async function saveSettings(patch) {
  const current = await getSettings()
  await chrome.storage.local.set({ settings: { ...current, ...patch } })
}

// Alamat server bisa berbeda mesin: backend jalan di PC yang di-remote, Chrome
// ada di laptop yang dipegang. MV3 melarang fetch ke host yang tidak dideklarasi,
// dan `host_permissions` tidak bisa diubah saat jalan — jadi host selain
// localhost diminta lewat `optional_host_permissions` saat alamatnya disimpan.
export async function setApiBase(raw) {
  const url = new URL(/^https?:\/\//.test(raw) ? raw : `http://${raw}`)
  if (!url.pathname.replace(/\/+$/, '')) url.pathname = '/api'
  const apiBase = url.toString().replace(/\/+$/, '')
  const granted = await chrome.permissions.request({ origins: [`${url.origin}/*`] })
  if (!granted) throw new Error('izin ke server itu ditolak — alamat tidak disimpan')
  await saveSettings({ apiBase })
  return apiBase
}
