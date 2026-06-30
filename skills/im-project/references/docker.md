# Docker Reference

Docker build files are under `D:\desktop\work`; reusable Docker config and
artifacts are placed directly on D drive.

Files:

- `backend/Dockerfile`
- `backend/.dockerignore`
- `docker-compose.yml`
- `.env.docker.example`
- `scripts/docker-build-backend.ps1`
- `scripts/docker-save-backend.ps1`
- `scripts/docker-compose-up.ps1`
- `scripts/docker-env.ps1`
- `scripts/install-docker-desktop-d.ps1`
- `D:\docker\config\daemon.json`
- `D:\docker\cli\config.json`
- `D:\docker\install-docker-desktop-d.ps1`

Build:

```powershell
cd D:\desktop\work
.\scripts\docker-build-backend.ps1
```

Save image tar:

```powershell
.\scripts\docker-save-backend.ps1
```

Run compose:

```powershell
.\scripts\docker-compose-up.ps1
```

D-drive paths:

- CLI config: `D:\docker\cli`
- Daemon config template: `D:\docker\config\daemon.json`
- Docker Desktop install directory: `D:\docker\DockerDesktop`
- Docker Desktop WSL data root: `D:\docker\wsl`
- Windows containers data root: `D:\docker\windows-containers`
- SQLite container volume: `D:\docker-data\im-backend`
- Image tar output: `D:\docker\images`

Install Docker Desktop to D drive:

```powershell
D:\docker\install-docker-desktop-d.ps1
```
