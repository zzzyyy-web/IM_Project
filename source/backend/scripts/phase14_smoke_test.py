import json
import time
from pathlib import Path
from urllib import request


BASE_URL = "http://127.0.0.1:8000"
ROOT = Path(__file__).resolve().parents[2]


def call(method: str, path: str, payload: dict | None = None, token: str | None = None) -> dict | list:
    data = None
    headers = {"Content-Type": "application/json"}
    if token:
        headers["Authorization"] = f"Bearer {token}"
    if payload is not None:
        data = json.dumps(payload).encode("utf-8")
    req = request.Request(f"{BASE_URL}{path}", data=data, headers=headers, method=method)
    with request.urlopen(req, timeout=10) as resp:
        return json.loads(resp.read().decode("utf-8"))


def register_user(username: str) -> dict:
    captcha = call("GET", "/api/captcha")
    return call(
        "POST",
        "/api/register",
        {
            "username": username,
            "password": "abc123",
            "captcha": captcha["code"],
            "captcha_token": captcha["captcha_token"],
            "display_name": username,
        },
    )


def assert_frontend_wired() -> None:
    app = (ROOT / "web-ui" / "im-ui" / "src" / "App.tsx").read_text(encoding="utf-8")
    client = (ROOT / "web-ui" / "im-ui" / "src" / "lib" / "imClient.ts").read_text(encoding="utf-8")
    css = (ROOT / "web-ui" / "im-ui" / "src" / "App.css").read_text(encoding="utf-8")

    required_app = [
        'type ViewMode = "sessions"',
        '"settings"',
        "function SettingsPanel",
        "getSettings(token)",
        "updateSettings(token",
        "im-search-history",
        "确定要退出当前账号吗",
    ]
    for marker in required_app:
        assert marker in app, marker

    for marker in ("export type UserSettings", '"/api/settings"', "updateSettings"):
        assert marker in client, marker

    for marker in (".settings-panel", ".switch-row", '[data-theme="dark"]', '[data-font-size="large"]'):
        assert marker in css, marker


def main() -> None:
    suffix = str(int(time.time() * 1000))
    username = f"p14_user_{suffix}"
    auth = register_user(username)
    token = auth["token"]

    defaults = call("GET", "/api/settings", token=token)
    assert defaults["username"] == username, defaults
    assert defaults["notification_enabled"] is True, defaults
    assert defaults["message_preview_enabled"] is True, defaults
    assert defaults["quiet_hours_enabled"] is False, defaults
    assert defaults["theme"] == "system", defaults
    assert defaults["font_size"] == "standard", defaults

    updated = call(
        "PATCH",
        "/api/settings",
        {
            "notification_enabled": False,
            "message_preview_enabled": False,
            "mention_notify_enabled": True,
            "quiet_hours_enabled": True,
            "quiet_hours_start": "21:30",
            "quiet_hours_end": "07:45",
            "theme": "dark",
            "language": "zh-CN",
            "font_size": "large",
            "chat_background": "https://example.com/bg.png",
        },
        token=token,
    )
    assert updated["notification_enabled"] is False, updated
    assert updated["message_preview_enabled"] is False, updated
    assert updated["quiet_hours_enabled"] is True, updated
    assert updated["quiet_hours_start"] == "21:30", updated
    assert updated["theme"] == "dark", updated
    assert updated["font_size"] == "large", updated
    assert updated["chat_background"].endswith("/bg.png"), updated

    loaded = call("GET", "/api/settings", token=token)
    assert loaded["theme"] == "dark", loaded
    assert loaded["font_size"] == "large", loaded

    assert_frontend_wired()

    print("PHASE14_OK", json.dumps({"username": username, "theme": loaded["theme"]}, sort_keys=True))


if __name__ == "__main__":
    main()
