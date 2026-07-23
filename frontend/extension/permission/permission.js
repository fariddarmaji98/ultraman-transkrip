// Satu tujuan: memunculkan prompt izin mikrofon di konteks yang boleh
// memunculkannya, lalu melepas stream-nya lagi. Perekaman sesungguhnya tetap
// di offscreen/ — halaman ini cuma pembuka pintu.
const status = document.getElementById('status')

document.getElementById('ask').addEventListener('click', async () => {
  status.className = 'muted'
  status.textContent = 'Menunggu jawabanmu di prompt browser…'
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
    stream.getTracks().forEach((t) => t.stop())  // izin sudah didapat; jangan tahan mic
    status.textContent = 'Izin diberikan. Tab ini boleh ditutup.'
  } catch (err) {
    status.className = 'muted error'
    status.textContent = `Izin ditolak (${err.name}). Buka ikon gembok di address bar untuk mengubahnya.`
  }
})
