// Orkestrator: minta izin tangkap tab, siapkan offscreen document, mulai/tutup sesi.
// Tidak menyentuh media sama sekali — service worker MV3 tidak punya DOM dan bisa
// disuspend kapan saja. Semua kerja media hidup di offscreen/.
import { getSettings, platformOf } from '../lib/config.js'
import { cancelSession, finishSession, startSession } from '../lib/api.js'

const OFFSCREEN = 'offscreen/offscreen.html'
const STATE = 'session'

chrome.runtime.onMessage.addListener((msg, _sender, respond) => {
  const handlers = { START: start, STOP: stop, CANCEL: cancel, STATE: readState }
  const fn = handlers[msg?.type]
  if (!fn) return false
  fn(msg).then(respond).catch((err) => respond({ error: String(err.message ?? err) }))
  return true  // balasan asinkron
})

async function readState() {
  return (await chrome.storage.local.get(STATE))[STATE] ?? { active: false }
}

async function start({ tabId, tabUrl, title }) {
  const state = await readState()
  if (state.active) throw new Error('sesi lain masih berjalan')
  if (state.pending) throw new Error('masih ada rekaman yang belum tersimpan — selesaikan dulu')
  const cfg = await getSettings()
  const platform = platformOf(tabUrl)
  // Sesi dibuat DULU: kalau backend mati, gagal sebelum menyentuh media,
  // sehingga tab tidak sempat kehilangan audionya untuk apa pun.
  const session = await startSession(cfg.apiBase, { platform, title, url: tabUrl })
  await beginCapture(tabId, cfg, session, platform)
  return { active: true, ...session, platform, startedAt: Date.now() }
}

async function beginCapture(tabId, cfg, session, platform) {
  const streamId = await chrome.tabCapture.getMediaStreamId({ targetTabId: tabId })
  await ensureOffscreen()
  const res = await chrome.runtime.sendMessage({
    type: 'OFFSCREEN_START', streamId, apiBase: cfg.apiBase,
    timesliceMs: cfg.timesliceMs, retries: cfg.uploadRetries,
    retryDelayMs: cfg.retryDelayMs, ...session,
  })
  if (res?.error) {
    await cancelSession(cfg.apiBase, session.recording_id, session.upload_token)
    throw new Error(res.error)
  }
  await save({ active: true, tabId, platform, startedAt: Date.now(), ...session })
}

async function stop() {
  const state = await readState()
  if (!state.recording_id) throw new Error('tidak ada sesi berjalan')
  const cfg = await getSettings()
  await haltCapture()
  // Perekaman sudah berhenti; tandai `pending` SEBELUM menutup sesi ke backend.
  // Kalau langkah itu gagal, potongannya tetap aman di server dan user bisa
  // mencoba menyimpan lagi — bukan tersangkut mengira masih merekam.
  await save({ ...state, active: false, pending: true })
  const rec = await finishSession(cfg.apiBase, state.recording_id, state.upload_token)
  await save({ active: false, pending: false, lastTitle: rec.title })
  return { stopped: true, recording: rec }
}

async function cancel() {
  const state = await readState()
  const cfg = await getSettings()
  await haltCapture()
  if (state.recording_id) {
    await cancelSession(cfg.apiBase, state.recording_id, state.upload_token)
  }
  await save({ active: false, pending: false })
  return { cancelled: true }
}

// Hentikan perekaman, apa pun kondisinya. Offscreen bisa saja sudah tidak ada
// (mis. percobaan simpan sebelumnya gagal setelah menutupnya) — mengirim pesan
// ke situ akan melempar "Receiving end does not exist" dan menutupi error yang
// sebenarnya. Karena itu keberadaannya diperiksa, dan kegagalannya diabaikan.
async function haltCapture() {
  if (!(await chrome.offscreen.hasDocument())) return
  await chrome.runtime.sendMessage({ type: 'OFFSCREEN_STOP' }).catch(() => {})
  await closeOffscreen()
}

async function save(state) {
  await chrome.storage.local.set({ [STATE]: state })
}

async function ensureOffscreen() {
  if (await chrome.offscreen.hasDocument()) return
  await chrome.offscreen.createDocument({
    url: OFFSCREEN,
    reasons: ['USER_MEDIA'],
    justification: 'Merekam audio tab meeting dan mikrofon untuk ditranskrip.',
  })
}

async function closeOffscreen() {
  if (await chrome.offscreen.hasDocument()) await chrome.offscreen.closeDocument()
}
