import asyncio
import json
import time
from urllib import request

import websockets


BASE_URL = "http://127.0.0.1:8000"


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


def login_admin() -> str:
    result = call("POST", "/api/login", {"username": "admin", "password": "123456"})
    return result["token"]


async def send_group_message(sender: str, token: str, group_id: int) -> dict:
    ws = await websockets.connect(f"ws://127.0.0.1:8000/ws/{sender}?token={token}")
    await ws.recv()
    await ws.send(json.dumps({"type": "group_chat", "group_id": group_id, "content": "phase15 group message", "msg_type": "text"}))
    ack = json.loads(await ws.recv())
    await ws.close()
    assert ack["type"] == "ack", ack
    return ack


def main() -> None:
    suffix = str(int(time.time() * 1000))
    alice = f"p15a_{suffix}"
    bob = f"p15b_{suffix}"
    carol = f"p15c_{suffix}"
    alice_auth = register_user(alice)
    bob_auth = register_user(bob)
    carol_auth = register_user(carol)
    alice_token = alice_auth["token"]
    bob_token = bob_auth["token"]

    group = call(
        "POST",
        "/api/groups",
        {"name": f"phase15_{suffix}", "member_usernames": [bob, carol], "announcement": "phase15"},
        token=alice_token,
    )
    message = asyncio.run(send_group_message(alice, alice_token, group["id"]))

    reaction = call("POST", f"/api/messages/{message['id']}/reaction", {"emoji": "👍"}, token=bob_token)
    assert reaction["reacted"] is True, reaction
    assert reaction["message"]["reactions"][0]["count"] >= 1, reaction

    call("POST", f"/api/groups/{group['id']}/read?message_id={message['id']}", token=bob_token)
    members = call("GET", f"/api/groups/{group['id']}/messages/{message['id']}/read-members", token=alice_token)
    assert any(item["username"] == bob for item in members["read"]), members
    assert any(item["username"] == carol for item in members["unread"]), members

    draft = call("PUT", "/api/drafts", {"conversation_id": f"group:{group['id']}", "content": "draft text"}, token=alice_token)
    assert draft["content"] == "draft text", draft
    loaded_draft = call("GET", f"/api/drafts?conversation_id=group:{group['id']}", token=alice_token)
    assert loaded_draft["content"] == "draft text", loaded_draft

    notice = call("POST", "/api/screenshot-notices", {"conversation_id": f"group:{group['id']}"}, token=alice_token)
    assert notice["conversation_id"] == f"group:{group['id']}", notice

    admin_token = login_admin()
    trends = call("GET", "/api/admin/trends?days=7", token=admin_token)
    assert len(trends) == 7, trends
    configs = call("GET", "/api/admin/system-configs", token=admin_token)
    assert any(item["key"] == "allow_message_forward" for item in configs), configs
    updated_config = call("PATCH", "/api/admin/system-configs/allow_message_forward", {"value": "true"}, token=admin_token)
    assert updated_config["value"] == "true", updated_config

    print("PHASE15_17_OK", json.dumps({"group_id": group["id"], "message_id": message["id"]}, sort_keys=True))


if __name__ == "__main__":
    main()
