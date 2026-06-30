$ErrorActionPreference = "Stop"
$here = Split-Path -Parent $MyInvocation.MyCommand.Path
$root = Split-Path -Parent $here

docker build -t im-backend:latest -f "$root\source\backend\Dockerfile" "$root\source\backend"
if ($LASTEXITCODE -ne 0) {
  throw "docker build failed. Please make sure Docker Desktop Linux engine is running."
}

docker save im-backend:latest -o "$here\im-backend-latest.tar"
if ($LASTEXITCODE -ne 0) {
  throw "docker save failed. Please make sure Docker Desktop Linux engine is running."
}

Write-Host "Docker image exported: $here\im-backend-latest.tar"
