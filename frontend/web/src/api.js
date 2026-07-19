// Klien backend. Semua request lewat /api (diproxy Vite ke FastAPI).

export async function listRecordings() {
  const res = await fetch('/api/recordings')
  return res.json()
}

export async function getRecording(id) {
  const res = await fetch(`/api/recordings/${id}`)
  if (!res.ok) throw new Error('gagal memuat rekaman')
  return res.json()
}

export async function deleteRecording(id) {
  await fetch(`/api/recordings/${id}`, { method: 'DELETE' })
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
export const exportUrl = (id, fmt) => `/api/recordings/${id}/export?fmt=${fmt}`
