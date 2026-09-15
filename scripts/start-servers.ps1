# Jalankan backend + frontend ultraman-transkrip secara idempoten.
# Dipanggil Task Scheduler (ONLOGON + watchdog) dan bisa manual:
#   powershell -NoProfile -ExecutionPolicy Bypass -File scripts\start-servers.ps1
# Idempoten: hanya mulai proses yang port-nya belum merespons sehat.
$ErrorActionPreference = 'SilentlyContinue'

$root     = Split-Path -Parent $PSScriptRoot          # root repo
$backend  = Join-Path $root 'backend'
$frontend = Join-Path $root 'frontend\web'
$logdir   = Join-Path $root '.logs'
New-Item -ItemType Directory -Force -Path $logdir | Out-Null

# node.exe dari instalasi Hermes (PATH dev lokal memakainya; bukan node sistem).
$node = 'C:\Users\Thamvan\AppData\Local\hermes\node\node.exe'

function Test-Health($url) {
  try {
    return (Invoke-WebRequest -Uri $url -TimeoutSec 3 -UseBasicParsing).StatusCode -eq 200
  } catch { return $false }
}

function Log($msg) {
  "$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')  $msg" | Out-File (Join-Path $logdir 'launcher.log') -Append
}

# --- Backend :8000 ----------------------------------------------------------
if (-not (Test-Health 'http://127.0.0.1:8000/api/health')) {
  $py = Join-Path $backend '.venv\Scripts\python.exe'
  Start-Process -FilePath $py -ArgumentList 'run_local.py' -WorkingDirectory $backend `
    -RedirectStandardOutput (Join-Path $logdir 'backend.log') `
    -RedirectStandardError  (Join-Path $logdir 'backend.err') -WindowStyle Hidden
  Log 'backend mulai'
}

# --- Frontend :5173 (vite langsung, tanpa npm wrapper) ----------------------
if (-not (Test-Health 'http://127.0.0.1:5173')) {
  $vite = Join-Path $frontend 'node_modules\vite\bin\vite.js'
  Start-Process -FilePath $node -ArgumentList "`"$vite`" --host" -WorkingDirectory $frontend `
    -RedirectStandardOutput (Join-Path $logdir 'frontend.log') `
    -RedirectStandardError  (Join-Path $logdir 'frontend.err') -WindowStyle Hidden
  Log 'frontend mulai'
}
