$ErrorActionPreference = "Stop"

$root = "D:\desktop\work"

Push-Location (Join-Path $root "backend")
try {
  $files = Get-ChildItem app,scripts -Filter *.py -File | ForEach-Object { $_.FullName }
  D:\conda_envs\im-backend\python.exe -m py_compile @files
  D:\conda_envs\im-backend\python.exe scripts\phase1_smoke_test.py
  D:\conda_envs\im-backend\python.exe scripts\phase2_smoke_test.py
  D:\conda_envs\im-backend\python.exe scripts\security_smoke_test.py
  D:\conda_envs\im-backend\python.exe scripts\ws_smoke_test.py
  D:\conda_envs\im-backend\python.exe scripts\phase3_smoke_test.py
} finally {
  Pop-Location
}

Push-Location (Join-Path $root "web-ui\im-ui")
try {
  npm run build
} finally {
  Pop-Location
}

Push-Location (Join-Path $root "admin-ui")
try {
  npm run build
} finally {
  Pop-Location
}
