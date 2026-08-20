"""Jalankan backend FastAPI dengan heartbeat berkala.

uvicorn tidak mencetak apa pun saat diam, sehingga watchdog task melaporkan
"stalled". Script ini mencetak heartbeat tiap 25 detik supaya watchdog melihat
aktivitas dan server tetap berjalan.
"""
import threading
import time

import uvicorn


def _heartbeat():
    while True:
        time.sleep(25)
        print(f"[heartbeat] {time.strftime('%H:%M:%S')} backend running", flush=True)


threading.Thread(target=_heartbeat, daemon=True).start()
uvicorn.run("app.main:app", host="127.0.0.1", port=8000)
