# IM 系统交付包

本目录包含 IM 系统交付要求中的源代码、Windows EXE、Android APK、服务端 Docker 镜像以及 skills。

## 交付内容

- 源代码：`source/`
  - 后端：`source/backend`
  - Web 前端：`source/web-ui/im-ui`
  - 后台管理：`source/admin-ui`
  - 桌面端壳工程：`source/desktop-client`
  - 移动端壳工程：`source/mobile-client`
- Windows 安装包：`artifacts/windows/IM-Desktop-Setup-1.0.0.exe`
- Android 安装包：`artifacts/android/IM-Mobile-debug.apk`
- 服务端 Docker 镜像：`docker/im-backend-latest.tar`
- Docker 启动脚本：`docker/`
- Skills：`skills/`
- 补充文档：`docs/`

## 默认账号

- 管理员账号：`admin`
- 管理员密码：`123456`

## 后端启动方式一：Docker

要求：已安装并启动 Docker Desktop。

```powershell
cd docker
.\load-and-run-backend.ps1
```

脚本会加载 `docker/im-backend-latest.tar`，并将后端启动在：

```text
http://127.0.0.1:8000
```

健康检查：

```text
http://127.0.0.1:8000/health
```

## 后端启动方式二：本地 Python

要求：Python 3.10。

```powershell
cd source\backend
python -m venv .venv
.\.venv\Scripts\activate
pip install -r requirements.txt
python -m uvicorn app.main:app --host 0.0.0.0 --port 8000
```

## Web 前端启动

要求：Node.js 20+。

```powershell
cd source\web-ui\im-ui
npm install
npm run dev -- --host 127.0.0.1 --port 5173
```

访问：

```text
http://127.0.0.1:5173/
```

## 后台管理启动

```powershell
cd source\admin-ui
npm install
npm run dev -- --host 127.0.0.1 --port 5174
```

访问：

```text
http://127.0.0.1:5174/
```

只有管理员账号可以进入后台。

## EXE 使用

先启动后端，然后安装并打开：

```text
artifacts/windows/IM-Desktop-Setup-1.0.0.exe
```

桌面端默认连接：

```text
http://127.0.0.1:8000
```

## APK 使用

APK 文件：

```text
artifacts/android/IM-Mobile-debug.apk
```

默认后端地址：

```text
http://10.0.2.2:8000
```

该地址适用于 Android 模拟器访问电脑本机后端。真机测试时，电脑和手机需要在同一局域网，并将移动端源码中的后端地址改为电脑局域网 IP 后重新打包。

源码位置：

```text
source/mobile-client/app/src/main/java/com/im/project/mobile/MainActivity.java
```

