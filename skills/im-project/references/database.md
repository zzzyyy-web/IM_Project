# Database Reference

SQLite file:

```text
D:\desktop\work\backend\im.sqlite3
```

Docker SQLite volume:

```text
D:\desktop\work\docker\data\backend\im.sqlite3
```

Main tables:

- `users`: username, display name, avatar, password hash/salt, role, profile fields, disabled flag.
- `friend_requests`: from user, to user, message, status.
- `friendships`: normalized one-to-one friendship pairs.
- `conversations`: single chat conversation state, unread counts, pin/mute settings.
- `messages`: persisted chat messages.

Reset local DB:

```powershell
Stop-Process -Id (Get-NetTCPConnection -LocalPort 8000 -State Listen).OwningProcess -Force
Remove-Item D:\desktop\work\backend\im.sqlite3 -Force
cd D:\desktop\work\backend
D:\conda_envs\im-backend\python.exe -m uvicorn app.main:app --host 127.0.0.1 --port 8000
```

Startup seeds `admin / 123456`.
