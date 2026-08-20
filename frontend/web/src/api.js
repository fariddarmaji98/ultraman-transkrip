// Klien backend. Semua request lewat /api (diproxy Vite ke FastAPI).

export async function listRecordings() {
  const res = await fetch('/api/recordings')
  // Jangan pernah menetapkan `recordings` ke non-array (mis. `{detail}` dari 429
  // gerbang tol): pemanggil memakai `.filter()`/`.some()` dan langsung crash.
  if (!res.ok) return []
  return res.json()
}

export async function getConfig() {
  const res = await fetch('/api/config')
  if (!res.ok) return null
  return res.json()
}

export async function setModel(model) {
  const res = await fetch('/api/config', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ model }),
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data.detail ?? 'gagal mengganti model')
  return data
}

export async function createFromUrl(url, language = 'auto') {
  const res = await fetch('/api/recordings/from-url', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url, language }),
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data.detail ?? 'gagal memulai unduhan')
  return data
}

export async function getChat(id, lang) {
  const res = await fetch(`/api/recordings/${id}/chat?lang=${lang}`)
  return res.json()
}

export async function sendChat(id, question, lang) {
  const res = await fetch(`/api/recordings/${id}/chat?lang=${lang}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ question }),
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data.detail ?? 'gagal mengirim pertanyaan')
  return data
}

export async function clearChat(id, lang) {
  await fetch(`/api/recordings/${id}/chat?lang=${lang}`, { method: 'DELETE' })
}

export async function summarizeRecording(id, lang) {
  const res = await fetch(`/api/recordings/${id}/summarize?lang=${lang}`, { method: 'POST' })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data.detail ?? 'gagal membuat ringkasan')
  return data
}

export async function startTranscribe(id) {
  const res = await fetch(`/api/recordings/${id}/transcribe`, { method: 'POST' })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data.detail ?? 'gagal memulai transkrip')
  return data
}

export async function getCookies() {
  const res = await fetch('/api/cookies')
  return res.json()
}

export async function uploadCookies(platform, file) {
  const form = new FormData()
  form.append('file', file)
  const res = await fetch(`/api/cookies/${platform}`, { method: 'POST', body: form })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data.detail ?? 'gagal mengunggah cookies')
  return data
}

export async function forgetCookies(platform) {
  await fetch(`/api/cookies/${platform}`, { method: 'DELETE' })
}

export async function getStorage() {
  const res = await fetch('/api/storage')
  return res.json()
}

export async function getLlm() {
  const res = await fetch('/api/llm')
  return res.json()
}

export const setLlm = (body) => sendLlm('/api/llm', 'PATCH', body)
export const testLlm = (body) => sendLlm('/api/llm/test', 'POST', body)

export async function forgetLlmKey(provider) {
  await fetch(`/api/llm/${provider}/key`, { method: 'DELETE' })
}

async function sendLlm(url, method, body) {
  const res = await fetch(url, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data.detail ?? 'gagal menyimpan setelan AI')
  return data
}

export async function getRecording(id, lang) {
  const res = await fetch(`/api/recordings/${id}?lang=${lang}`)
  if (!res.ok) throw new Error('gagal memuat rekaman')
  return res.json()
}

export async function deleteRecording(id) {
  await fetch(`/api/recordings/${id}`, { method: 'DELETE' })
}

export async function renameRecording(id, title) {
  await fetch(`/api/recordings/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ title }),
  })
}

export function uploadRecording(file, language, onProgress) {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    xhr.open('POST', '/api/recordings')
    xhr.upload.onprogress = (e) =>
      onProgress(Math.round((e.loaded / e.total) * 100))
    xhr.onload = () => finishUpload(xhr, resolve, reject)
    xhr.onerror = () => reject(new Error('koneksi gagal'))
    xhr.send(buildForm(file, language))
  })
}

function buildForm(file, language) {
  const form = new FormData()
  form.append('file', file)
  form.append('language', language)
  return form
}

function finishUpload(xhr, resolve, reject) {
  if (xhr.status === 201) return resolve(JSON.parse(xhr.responseText))
  reject(new Error(parseError(xhr.responseText)))
}

function parseError(text) {
  try {
    return JSON.parse(text).detail
  } catch {
    return 'upload gagal'
  }
}

export const mediaUrl = (id) => `/api/recordings/${id}/media`
export const sourceUrl = (id) => `/api/recordings/${id}/source`
// `lang` kosong = transkrip asli. Diisi = versi terjemahan bahasa itu.
export const exportUrl = (id, fmt, lang) =>
  `/api/recordings/${id}/export?fmt=${fmt}${lang ? `&lang=${lang}` : ''}`

// --- Terjemahan transkrip ---------------------------------------------------
// Terpisah dari `getRecording`: terjemahan berjalan di latar dan punya
// status/progresnya sendiri, sedangkan detail rekaman tidak boleh ikut menunggu.
export async function getTranslation(id, lang) {
  const res = await fetch(`/api/recordings/${id}/translation?lang=${lang}`)
  if (!res.ok) throw new Error('gagal memuat terjemahan')
  return res.json()
}

export async function startTranslate(id, lang) {
  const res = await fetch(`/api/recordings/${id}/translate?lang=${lang}`, { method: 'POST' })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data.detail ?? 'gagal memulai terjemahan')
  return data
}
