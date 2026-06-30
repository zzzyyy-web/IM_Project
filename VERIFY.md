# 验证记录

本交付包在打包机器上已完成以下验证：

- Web 前端构建通过：`npm run build`
- Admin UI 构建通过：`npm run build`
- 后端健康检查通过：`GET /health`
- 后端管理员登录通过：`admin / 123456`
- 基础聊天回归通过：`PHASE2_OK`
- 阶段功能 smoke test 通过：`PHASE15_17_OK`
- Windows EXE 已生成：`artifacts/windows/IM-Desktop-Setup-1.0.0.exe`
- Android APK 已生成：`artifacts/android/IM-Mobile-debug.apk`
- 服务端 Docker 镜像已生成：`docker/im-backend-latest.tar`
- Docker 镜像启动验证通过：

```text
docker run -d --name im-backend-verify -p 18080:8000 im-backend:latest
GET http://127.0.0.1:18080/health
```

返回：

```json
{"status":"ok","service":"im-core","version":"0.2.0"}
```

验证容器已在验证后删除。
