# IM Desktop Client

This Electron wrapper packages `web-ui/im-ui/dist` as a Windows desktop app.

Build from `D:\desktop\work`:

```powershell
$env:npm_config_cache="D:\desktop\work\.npm-cache"
$env:ELECTRON_CACHE="D:\desktop\work\.electron-cache"
cd D:\desktop\work\web-ui\im-ui
npm run build
cd D:\desktop\work\desktop-client
npm install
npm run pack
```

Output: `D:\desktop\work\desktop-client\release\IM-Desktop-Setup-1.0.0.exe`
