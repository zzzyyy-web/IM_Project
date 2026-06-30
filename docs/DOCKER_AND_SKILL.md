# Docker And Skill Delivery

## Docker Paths

Project Docker build files stay in `D:\desktop\work`; reusable Docker configuration
and generated artifacts are placed directly on D drive.

- Docker Desktop install directory: `D:\docker\DockerDesktop`
- Docker Desktop WSL data root: `D:\docker\wsl`
- Windows containers data root: `D:\docker\windows-containers`
- Docker CLI config: `D:\docker\cli\config.json`
- Docker daemon config template: `D:\docker\config\daemon.json`
- Docker data root: `D:\docker-data`
- Backend container SQLite data: `D:\docker-data\im-backend`
- Backend image tar output: `D:\docker\images\im-backend-latest.tar`

## Install Docker Desktop To D Drive

Docker Desktop installation requires administrator permission. Run this script
from an elevated PowerShell or right-click it and choose administrator execution:

```powershell
D:\docker\install-docker-desktop-d.ps1
```

The script installs Docker Desktop with these paths:

```text
D:\docker\DockerDesktop
D:\docker\wsl
D:\docker\windows-containers
D:\docker\cli
D:\docker-data
```

If using the project wrapper, run:

```powershell
cd D:\desktop\work
.\scripts\install-docker-desktop-d.ps1
```

This wrapper opens an administrator PowerShell window and requires approving the
Windows UAC prompt.

## Build Backend Image

Install Docker first, then run:

```powershell
cd D:\desktop\work
.\scripts\docker-env.ps1
.\scripts\docker-build-backend.ps1
```

## Save Backend Image

```powershell
cd D:\desktop\work
.\scripts\docker-save-backend.ps1
```

## Run Backend With Docker Compose

```powershell
cd D:\desktop\work
.\scripts\docker-compose-up.ps1
```

The backend container exposes:

```text
http://127.0.0.1:8000
```

## Docker Desktop / Engine Note

`D:\docker\config\daemon.json` sets Docker `data-root` to `D:\docker-data`.
Docker Desktop and Docker Engine apply daemon configuration differently, so this
project prepares the D-drive config file but does not automatically write any
configuration to C drive.

## Codex Skill

The project skill is located at:

```text
D:\desktop\work\skills\im-project
```

It documents the local IM system structure, backend/frontend/admin validation,
REST and WebSocket APIs, SQLite notes, and Docker delivery commands.

Run project validation with:

```powershell
cd D:\desktop\work
.\skills\im-project\scripts\validate_project.ps1
```
