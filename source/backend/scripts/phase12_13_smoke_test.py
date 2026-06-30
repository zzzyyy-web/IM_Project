import json
import time
from urllib import request


BASE_URL = "http://127.0.0.1:8000"


def call(method: str, path: str, payload: dict | None = None, token: str | None = None) -> dict | list:
    data = None
    headers = {}
    if token:
        headers["Authorization"] = f"Bearer {token}"
    if payload is not None:
        headers["Content-Type"] = "application/json"
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


def main() -> None:
    suffix = str(int(time.time() * 1000))
    username = f"p12_user_{suffix}"
    auth = register_user(username)
    admin = call("POST", "/api/login", {"username": "admin", "password": "123456"})

    search = call("GET", f"/api/search?username={username}&q={username}", token=auth["token"])
    assert "attachments" in search, search
    assert "departments" in search and "members" in search, search

    overview = call("GET", "/api/admin/overview", token=admin["token"])
    for key in ["groups", "sensitive_words", "download_logs", "message_types"]:
      assert key in overview, overview

    app = open("../web-ui/im-ui/src/App.tsx", encoding="utf-8").read()
    admin_main = open("../admin-ui/src/main.tsx", encoding="utf-8").read()
    for needle in ["searchHistory", "onLocateMessage", "highlightText", "SearchGroup title=\"文件\""]:
      assert needle in app, needle
    for needle in ["消息类型分布", "运维风险摘要", "后台角色权限", "audit-summary"]:
      assert needle in admin_main, needle

    print("PHASE12_13_OK", json.dumps({"user": username}, sort_keys=True))


if __name__ == "__main__":
    main()
