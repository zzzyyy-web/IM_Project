---
name: im-project
description: Work on the local IM project in D:\desktop\work, including FastAPI backend, React web client, React admin console, SQLite data, WebSocket messaging, authentication, Docker backend image delivery, and project validation. Use when modifying, validating, packaging, or extending this IM system.
---

# IM Project

## Project Root

Use `D:\desktop\work` as the project root.

Main modules:

- `backend`: FastAPI IM service, SQLite, WebSocket, auth, admin APIs.
- `web-ui/im-ui`: Web IM client.
- `admin-ui`: Independent admin console.
- `docker`: Project Docker documentation only; reusable Docker config/data lives on D drive.

## Core Rules

- Keep project source files under `D:\desktop\work`.
- Do not write Docker config or image exports to C drive.
- Preserve the security model:
  - Users register before login.
  - Passwords use PBKDF2-HMAC-SHA256 with salt.
  - User APIs require Bearer token.
  - Users may only operate on their own profile/friends/sessions/messages.
  - Admin APIs require admin token.
  - WebSocket connects with `/ws/{username}?token=...`.
- Default admin seed is `admin / 123456`; do not allow disabling admin.

## Common Workflows

### Validate Backend

Run:

```powershell
cd D:\desktop\work\backend
$files = Get-ChildItem app,scripts -Filter *.py -File | ForEach-Object { $_.FullName }
D:\conda_envs\im-backend\python.exe -m py_compile @files
D:\conda_envs\im-backend\python.exe scripts\phase1_smoke_test.py
D:\conda_envs\im-backend\python.exe scripts\phase2_smoke_test.py
D:\conda_envs\im-backend\python.exe scripts\security_smoke_test.py
D:\conda_envs\im-backend\python.exe scripts\ws_smoke_test.py
D:\conda_envs\im-backend\python.exe scripts\phase3_smoke_test.py
```

### Validate Frontends

Run:

```powershell
cd D:\desktop\work\web-ui\im-ui
npm run build

cd D:\desktop\work\admin-ui
npm run build
```

### Build Backend Docker Image

Docker CLI must be installed. Project scripts set `DOCKER_CONFIG` to `D:\docker\cli`.

```powershell
cd D:\desktop\work
.\scripts\docker-build-backend.ps1
.\scripts\docker-save-backend.ps1
```

The image tar is written to:

```text
D:\docker\images\im-backend-latest.tar
```

## References

Read these only when needed:

- `references/api.md`: REST and WebSocket API summary.
- `references/database.md`: SQLite schema and reset notes.
- `references/docker.md`: Docker image, compose, and D-drive configuration.
