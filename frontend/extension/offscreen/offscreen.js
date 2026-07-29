// Satu-satunya tempat media disentuh: tangkap tab + mic, gabung jadi stereo,
// potong tiap N detik, kirim ke server. Sengaja mandiri — begitu dimulai, ia
// tidak butuh service worker lagi (yang bisa disuspend MV3 kapan saja).
import { putChunk } from '../lib/api.js'

let recorder = null
let context = null
let session = null
let sources = []   // stream MENTAH (tab & mic) — harus dihentikan sendiri saat selesai
let seq = 0
let queue = Promise.resolve()

chrome.runtime.onMessage.addListener((msg, _sender, respond) => {
  if (msg?.type === 'OFFSCREEN_START') {
    begin(msg).then(() => respond({ ok: true }))
      .catch((err) => respond({ error: String(err.message ?? err) }))
    return true
  }
  if (msg?.type === 'OFFSCREEN_STOP') {
    end().then(() => respond({ ok: true }))
    return true
  }
  return false
})

async function begin(msg) {
  session = msg
  seq = 0
  const tab = await captureTab(msg.streamId)
  const mic = await captureMic()
  sources = [tab, mic].filter(Boolean)
  recorder = new MediaRecorder(toStereo(tab, mic), { mimeType: 'audio/webm;codecs=opus' })
  recorder.ondataavailable = (e) => e.data.size && enqueue(e.data)
  recorder.start(msg.timesliceMs)
}

function captureTab(streamId) {
  return navigator.mediaDevices.getUserMedia({
    audio: { mandatory: { chromeMediaSource: 'tab', chromeMediaSourceId: streamId } },
  })
}

// AGC dimatikan dengan sengaja. Ia menormalkan level mic naik-turun sendiri, dan
// justru MENAIKKAN gain saat ruangan sunyi — sehingga sisi "saya" terdengar paling
// keras tepat ketika orang lain yang bicara. Perbandingan energi kiri-kanan
// (planning §6 lapis 0) jadi terbalik. AEC tetap hidup: tanpa itu suara peserta
// yang keluar dari speaker masuk balik lewat mic dan menyalakan kanal kanan.
const MIC = { autoGainControl: false, echoCancellation: true, noiseSuppression: true }

async function captureMic() {
  // Mic WAJIB terpisah: Meet/Zoom membisukan playback suara kita sendiri
  // (anti-echo), jadi audio tab tidak berisi suara kita sama sekali.
  // Bila izinnya belum ada, rekaman tetap jalan — hanya tanpa sisi "saya".
  try {
    return await navigator.mediaDevices.getUserMedia({ audio: MIC })
  } catch {
    return null
  }
}

// Kiri = tab (peserta lain), kanan = mic (saya). JANGAN dicampur jadi satu
// kanal: pemisahan ini yang nanti dipakai membedakan siapa yang bicara, dan
// begitu tercampur ia hilang permanen (planning meeting-capture §4.1).
function toStereo(tabStream, micStream) {
  context = new AudioContext()
  const merger = context.createChannelMerger(2)
  const tab = context.createMediaStreamSource(tabStream)
  tab.connect(merger, 0, 0)
  // Tanpa baris ini tabnya membisu bagi user begitu ditangkap — ia mendengar
  // sunyi sepanjang meeting sementara rekamannya baik-baik saja.
  tab.connect(context.destination)
  if (micStream) context.createMediaStreamSource(micStream).connect(merger, 0, 1)
  // Lebar kanal track di sini TIDAK bisa dipaksa dari JS: menyetel
  // `out.channelCount` (atau mengopernya ke konstruktor) mengubah laporan node
  // tapi track-nya tetap 2 kanal. Karena itu jaminan stereo diperiksa di server
  // saat sesi ditutup, bukan di sini.
  const out = context.createMediaStreamDestination()
  merger.connect(out)
  return out.stream
}

// Antre berurutan: `seq` diambil saat potongan lahir, bukan saat terkirim,
// jadi urutan tetap benar walau satu kiriman sempat diulang.
function enqueue(blob) {
  const mine = seq++
  queue = queue.then(() => sendWithRetry(mine, blob)).catch(() => {})
}

async function sendWithRetry(mine, blob) {
  for (let attempt = 0; ; attempt++) {
    try {
      await putChunk(session.apiBase, session.recording_id, session.upload_token, mine, blob)
      return
    } catch (err) {
      if (attempt >= session.retries) return report(`potongan ${mine} gagal: ${err.message}`)
      await new Promise((r) => setTimeout(r, session.retryDelayMs * (attempt + 1)))
    }
  }
}

function report(message) {
  chrome.runtime.sendMessage({ type: 'OFFSCREEN_ERROR', message }).catch(() => {})
}

async function end() {
  if (!recorder) return
  // `stop()` memicu dataavailable terakhir — tunggu ia masuk antrean dulu,
  // kalau tidak potongan penutupnya hilang.
  await new Promise((resolve) => {
    recorder.onstop = resolve
    recorder.stop()
  })
  await queue  // semua potongan terkirim SEBELUM backend diminta menutup sesi
  releaseTracks()
  await context?.close()
  recorder = context = session = null
}

// Menghentikan stream campuran saja tidak cukup: tab & mic aslinya tetap hidup,
// jadi lampu "sedang merekam" tak pernah padam dan tab tetap tertangkap.
function releaseTracks() {
  for (const stream of [...sources, recorder?.stream]) {
    stream?.getTracks().forEach((track) => track.stop())
  }
  sources = []
}
