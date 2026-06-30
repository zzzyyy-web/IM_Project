$ErrorActionPreference = "Stop"
$here = Split-Path -Parent $MyInvocation.MyCommand.Path

if (Test-Path "$here\im-backend-latest.tar") {
  docker load -i "$here\im-backend-latest.tar"
  if ($LASTEXITCODE -ne 0) {
    throw "docker load failed. Please make sure Docker Desktop Linux engine is running."
  }
}

docker compose -f "$here\docker-compose.yml" up -d
if ($LASTEXITCODE -ne 0) {
  throw "docker compose up failed. Please make sure Docker Desktop Linux engine is running."
}

Write-Host "Backend started: http://127.0.0.1:8000"
