# EXE / APK 交付说明

## 已生成产物

- Windows EXE 安装包：`D:\desktop\work\desktop-client\release\IM-Desktop-Setup-1.0.0.exe`
- Android APK：`D:\desktop\work\mobile-client\app\build\outputs\apk\debug\app-debug.apk`

## 目录说明

- `desktop-client/`：Electron 桌面端壳工程，封装 `web-ui/im-ui/dist`
- `mobile-client/`：Android WebView 移动端壳工程，封装 `web-ui/im-ui/dist`
- `.npm-cache/`：npm 缓存
- `.electron-cache/`：Electron 下载缓存
- `.electron-builder-cache/`：Electron Builder 缓存
- `.gradle/`：Gradle 缓存
- `android-sdk/`：Android SDK
- `tools/`：Gradle 和 Android command line tools 压缩包/解压目录

以上目录都在 `D:\desktop\work` 下。

## 后端地址

Web 端现在支持运行时后端地址配置：

```js
localStorage.setItem("im-api-base", "http://后端IP:8000")
location.reload()
```

默认地址：

- 桌面 EXE：`http://127.0.0.1:8000`
- Android APK：`http://10.0.2.2:8000`

说明：

- Android 模拟器访问电脑本机后端使用 `http://10.0.2.2:8000`
- 真机安装 APK 时，需要把 `mobile-client/app/src/main/java/com/im/project/mobile/MainActivity.java` 里的 `DEFAULT_API_BASE` 改成电脑局域网 IP，例如 `http://192.168.1.10:8000`，然后重新执行 APK 构建。

## 重新构建 EXE

```powershell
$env:npm_config_cache="D:\desktop\work\.npm-cache"
$env:ELECTRON_CACHE="D:\desktop\work\.electron-cache"
$env:ELECTRON_BUILDER_CACHE="D:\desktop\work\.electron-builder-cache"
$env:ELECTRON_MIRROR="https://npmmirror.com/mirrors/electron/"

cd D:\desktop\work\web-ui\im-ui
npm run build

cd D:\desktop\work\desktop-client
npm run pack
```

## 重新构建 APK

```powershell
$env:ANDROID_HOME="D:\desktop\work\android-sdk"
$env:ANDROID_SDK_ROOT="D:\desktop\work\android-sdk"
$env:GRADLE_USER_HOME="D:\desktop\work\.gradle"
$env:JAVA_HOME="D:\javajava\Java\jdk-17.0.12"

cd D:\desktop\work\web-ui\im-ui
npm run build

cd D:\desktop\work
Remove-Item mobile-client\app\src\main\assets\web -Recurse -Force
New-Item -ItemType Directory -Force -Path mobile-client\app\src\main\assets\web
Copy-Item web-ui\im-ui\dist\* mobile-client\app\src\main\assets\web -Recurse -Force

cd D:\desktop\work\mobile-client
D:\desktop\work\tools\gradle-8.10.2\bin\gradle.bat assembleDebug --no-daemon
```
