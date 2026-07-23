// Klien backend. Semua permintaan sesi lewat sini — jangan panggil fetch tersebar.
export async function startSession(apiBase, body) {
  const res = await fetch(`${apiBase}/recordings/meeting`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  return unwrap(res, 'gagal memulai sesi')
}

export async function putChunk(apiBase, id, token, seq, blob) {
  const res = await fetch(`${apiBase}/recordings/${id}/chunk?seq=${seq}`, {
    method: 'PUT',
    headers: { 'X-Upload-Token': token, 'Content-Type': 'application/octet-stream' },
    body: blob,
  })
  if (!res.ok) throw new Error(await detail(res, `potongan ${seq} ditolak`))
}

export async function finishSession(apiBase, id, token) {
  const res = await fetch(`${apiBase}/recordings/${id}/finish`, {
    method: 'POST',
    headers: { 'X-Upload-Token': token },
  })
  return unwrap(res, 'gagal menutup sesi')
}

export async function cancelSession(apiBase, id, token) {
  await fetch(`${apiBase}/recordings/${id}/meeting`, {
    method: 'DELETE',
    headers: { 'X-Upload-Token': token },
  })
}

async function unwrap(res, fallback) {
  if (!res.ok) throw new Error(await detail(res, fallback))
  return res.json()
}

// Pesan error backend jauh lebih berguna daripada "HTTP 422" — pakai bila ada.
async function detail(res, fallback) {
  try {
    const body = await res.json()
    return body.detail || `${fallback} (HTTP ${res.status})`
  } catch {
    return `${fallback} (HTTP ${res.status})`
  }
}
