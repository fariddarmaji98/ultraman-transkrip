// Remote control, bukan UI produk: mulai/stop + status. Transkrip, ringkasan,
// dan chat semuanya hidup di webapp (planning meeting-capture §3.1).
import { platformOf } from '../lib/config.js'

const el = (id) => document.getElementById(id)
const LABELS = { meet: 'Google Meet', zoom: 'Zoom (web)', teams: 'Microsoft Teams', lain: 'Tab ini' }
let ticking = null

document.addEventListener('DOMContentLoaded', render)
el('start').addEventListener('click', () => guard(start))
el('stop').addEventListener('click', () => guard(stop))
el('cancel').addEventListener('click', () => guard(cancel))
el('retry').addEventListener('click', () => guard(stop))
el('discard').addEventListener('click', () => guard(cancel))
el('askMic').addEventListener('click', () => {
  chrome.tabs.create({ url: chrome.runtime.getURL('permission/permission.html') })
})

// Tiga keadaan, dan `pending` bukan hiasan: rekaman yang gagal disimpan harus
// punya jalan keluar, bukan membuat popup mengaku masih merekam selamanya.
async function render() {
  const state = await send({ type: 'STATE' })
  const view = state.active ? 'live' : state.pending ? 'pending' : 'idle'
  el('dot').classList.toggle('on', view === 'live')
  for (const id of ['idle', 'live', 'pending']) el(id).hidden = id !== view
  if (view === 'live') showLive(state)
  else if (view === 'idle') await showIdle()
  else clearInterval(ticking)
}

async function showIdle() {
  const tab = await activeTab()
  const platform = platformOf(tab?.url ?? '')
  el('platform').textContent = LABELS[platform]
  el('tabTitle').textContent = tab?.title ?? '(tak ada tab aktif)'
  el('hint').textContent = platform === 'lain'
    ? 'Tab ini bukan Meet/Zoom/Teams — audionya tetap bisa direkam.'
    : 'Aplikasi Zoom desktop tidak bisa direkam; pakai Zoom di browser.'
  await showMicState()
  clearInterval(ticking)
}

// Peringatan ditampilkan SEBELUM merekam, bukan sesudah: tahu suaramu hilang
// setelah meeting dua jam selesai sudah terlambat.
async function showMicState() {
  const granted = await micGranted()
  el('micWarn').hidden = granted
  el('askMic').hidden = granted
}

async function micGranted() {
  try {
    const status = await navigator.permissions.query({ name: 'microphone' })
    return status.state === 'granted'
  } catch {
    return false  // browser tak mendukung kueri — anggap belum, biar user bisa memilih
  }
}

function showLive(state) {
  el('liveTitle').textContent = LABELS[state.platform] ?? ''
  clearInterval(ticking)
  const tick = () => (el('elapsed').textContent = hhmm(Date.now() - state.startedAt))
  tick()
  ticking = setInterval(tick, 1000)
}

function hhmm(ms) {
  const total = Math.max(0, Math.floor(ms / 1000))
  const pad = (n) => String(n).padStart(2, '0')
  const head = total >= 3600 ? `${pad(Math.floor(total / 3600))}:` : ''
  return `${head}${pad(Math.floor(total / 60) % 60)}:${pad(total % 60)}`
}

async function start() {
  const tab = await activeTab()
  if (!tab) throw new Error('tidak ada tab aktif')
  await send({ type: 'START', tabId: tab.id, tabUrl: tab.url, title: el('title').value })
}

async function stop() {
  const res = await send({ type: 'STOP' })
  el('done').hidden = false
  el('done').textContent = `Tersimpan: "${res.recording.title}" — sedang ditranskrip di webapp.`
}

async function cancel() {
  await send({ type: 'CANCEL' })
  el('done').hidden = false
  el('done').textContent = 'Sesi dibatalkan, rekaman dibuang.'
}

// Semua aksi lewat sini: tombol dimatikan selagi jalan, error tampil apa adanya.
async function guard(fn) {
  const buttons = [...document.querySelectorAll('button')]
  buttons.forEach((b) => (b.disabled = true))
  el('error').hidden = true
  try {
    await fn()
  } catch (err) {
    el('error').hidden = false
    el('error').textContent = String(err.message ?? err)
  } finally {
    buttons.forEach((b) => (b.disabled = false))
    await render()
  }
}

async function activeTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
  return tab
}

async function send(msg) {
  const res = await chrome.runtime.sendMessage(msg)
  if (res?.error) throw new Error(res.error)
  return res ?? {}
}
