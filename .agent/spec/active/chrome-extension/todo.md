# Todo — F1 Chrome Extension (transkrip)

- [ ] scaffold MV3: `manifest.json` (permissions: activeTab, storage, host backend)
- [ ] `popup/`: HTML/CSS/JS 2 tab (Transkrip, Config)
- [ ] tab Transkrip: 3 tombol sumber (Voice aktif; Zoom/Meet disabled) + area transkrip + tombol Summarize
- [ ] `lib/transcribe.js`: wrapper Web Speech API (`SpeechRecognition`), `lang` dari config
- [ ] streaming: event `onresult` (interim+final) → append + auto-scroll
- [ ] toggle rekam Voice: start/stop, izin mic, state tombol
- [ ] `lib/config.js`: baca/tulis `chrome.storage` (bahasa, endpoint backend)
- [ ] tab Config: dropdown bahasa (id-ID/en-US/auto) + endpoint backend
- [ ] `lib/backend.js`: client `fetch` → `POST /transcripts` + `POST /summarize`
- [ ] tombol Summarize → panggil backend → tampilkan ringkasan (panel)
- [ ] recovery: izin mic ditolak, error Web Speech (no-speech/network), backend down
- [ ] uji manual: load unpacked → Voice → transkrip muncul → Summarize → ringkasan
- [ ] (F2, terpisah) Zoom/Meet via tabCapture + ASR on-device
