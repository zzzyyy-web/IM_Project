import asyncio
import json
import time
from urllib import error, request
from urllib.parse import urlencode

import websockets


BASE_URL = "http://127.0.0.1:8000"


def call(method: str, path: str, payload: dict | None = None, token: str | None = None, expect_error: int | None = None) -> dict | list:
    data = None
    headers = {"Content-Type": "application/json"}
    if token:
        headers["Authorization"] = f"Bearer {token}"
    if payload is not None:
        data = json.dumps(payload).encode("utf-8")
    req = request.Request(f"{BASE_URL}{path}", data=data, headers=headers, method=method)
    try:
        with request.urlopen(req, timeout=10) as resp:
            result = json.loads(resp.read().decode("utf-8"))
            if expect_error:
                raise AssertionError(f"expected HTTP {expect_error}, got success: {result}")
            return result
    except error.HTTPError as exc:
        body = json.loads(exc.read().decode("utf-8"))
        if expect_error and exc.code == expect_error:
            return body
        raise


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


async def send_blocked_message(sender: str, token: str, receiver: str, word: str) -> dict:
    ws = await websockets.connect(f"ws://127.0.0.1:8000/ws/{sender}?token={token}")
    await ws.recv()
    await ws.send(json.dumps({"type": "chat", "receiver": receiver, "content": f"hello {word}", "msg_type": "text"}))
    result = json.loads(await ws.recv())
    await ws.close()
    return result


def main() -> None:
    suffix = str(int(time.time() * 1000))
    alice = f"p4_alice_{suffix}"
    bob = f"p4_bob_{suffix}"
    word = f"p4bad{suffix}"

    alice_auth = register_user(alice)
    bob_auth = register_user(bob)
    admin_auth = call("POST", "/api/login", {"username": "admin", "password": "123456"})
    admin_token = admin_auth["token"]

    forbidden = call("GET", "/api/admin/overview", token=alice_auth["token"], expect_error=403)
    assert "管理员" in forbidden["detail"], forbidden

    overview = call("GET", "/api/admin/overview", token=admin_token)
    for key in ["users", "messages", "conversations", "pending_friend_requests", "attachments", "daily_active_users", "today_messages"]:
        assert key in overview, overview

    sensitive = call("POST", "/api/admin/sensitive-words", {"word": word, "enabled": True}, token=admin_token)
    assert sensitive["word"] == word, sensitive

    blocked = asyncio.run(send_blocked_message(alice, alice_auth["token"], bob, word))
    assert blocked["type"] == "error", blocked
    assert "敏感词" in blocked["message"], blocked

    reset = call("POST", f"/api/admin/users/{alice}/reset-password", {"password": "newabc123"}, token=admin_token)
    assert reset["username"] == alice, reset
    relogin = call("POST", "/api/login", {"username": alice, "password": "newabc123"})
    assert relogin["user"]["username"] == alice, relogin

    friend_request = call(
        "POST",
        "/api/friend-requests",
        {"from_user": alice, "to_user": bob, "message": "phase4 friend request"},
        token=relogin["token"],
    )
    call("POST", f"/api/friend-requests/{friend_request['id']}/action", {"action": "accept"}, token=bob_auth["token"])
    friendships = call("GET", "/api/admin/friendships?limit=50", token=admin_token)
    friendship = next(item for item in friendships if {item["user_a"], item["user_b"]} == {alice, bob})
    deleted = call("DELETE", f"/api/admin/friendships/{friendship['id']}", token=admin_token)
    assert deleted["deleted"] is True, deleted

    filtered = call("GET", "/api/admin/messages?" + urlencode({"keyword": word, "limit": 20}), token=admin_token)
    assert isinstance(filtered, list), filtered

    logs = call("GET", "/api/admin/operation-logs?limit=100", token=admin_token)
    actions = {item["action"] for item in logs}
    for action in ["admin_login", "create_sensitive_word", "reset_password", "delete_friendship"]:
        assert action in actions, logs

    call("DELETE", f"/api/admin/sensitive-words/{sensitive['id']}", token=admin_token)
    print("PHASE4_OK", json.dumps({"alice": alice, "bob": bob}, sort_keys=True))


if __name__ == "__main__":
    main()
