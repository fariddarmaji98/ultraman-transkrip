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
  if ((await readState()).active) throw new Error('sesi lain masih berjalan')
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
  if (!state.active) throw new Error('tidak ada sesi berjalan')
  const cfg = await getSettings()
  await chrome.runtime.sendMessage({ type: 'OFFSCREEN_STOP' })
  await closeOffscreen()
  const rec = await finishSession(cfg.apiBase, state.recording_id, state.upload_token)
  await save({ active: false, lastRecordingId: rec.id, lastTitle: rec.title })
  return { stopped: true, recording: rec }
}

async function cancel() {
  const state = await readState()
  const cfg = await getSettings()
  await chrome.runtime.sendMessage({ type: 'OFFSCREEN_STOP' }).catch(() => {})
  await closeOffscreen()
  if (state.active) {
    await cancelSession(cfg.apiBase, state.recording_id, state.upload_token)
  }
  await save({ active: false })
  return { cancelled: true }
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
