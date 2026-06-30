# IM MVP Backend

## 启动

```powershell
conda create -n im-backend python=3.10 -y
conda activate im-backend
cd D:\desktop\work\backend
pip install -r requirements.txt
uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

## 接口

- `POST /api/login`
- `GET /api/users`
- `GET /api/messages?me=alice&peer=bob`
- `WS /ws/{username}`

