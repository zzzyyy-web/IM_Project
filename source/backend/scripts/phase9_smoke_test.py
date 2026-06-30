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


async def send_ws(sender: str, token: str, receiver: str, content: str, msg_type: str = "text", burn_after_read: bool = False) -> dict:
    ws = await websockets.connect(f"ws://127.0.0.1:8000/ws/{sender}?token={token}")
    await ws.recv()
    await ws.send(json.dumps({"type": "chat", "receiver": receiver, "content": content, "msg_type": msg_type, "burn_after_read": burn_after_read}))
    ack = json.loads(await ws.recv())
    await ws.close()
    return ack


def main() -> None:
    suffix = str(int(time.time() * 1000))
    alice = f"p9_alice_{suffix}"
    bob = f"p9_bob_{suffix}"
    carol = f"p9_carol_{suffix}"

    alice_auth = register_user(alice)
    bob_auth = register_user(bob)
    carol_auth = register_user(carol)

    msg = asyncio.run(send_ws(alice, alice_auth["token"], bob, "phase9 https://example.com hello", burn_after_read=True))
    assert msg["type"] == "ack", msg
    assert msg["burn_after_read"] is True, msg

    favorite = call("POST", f"/api/messages/{msg['id']}/favorite", {"note": "phase9 favorite"}, token=alice_auth["token"])
    assert favorite["message_id"] == int(msg["id"]), favorite

    favorites = call("GET", "/api/message-favorites", token=alice_auth["token"])
    assert any(item["message_id"] == int(msg["id"]) for item in favorites), favorites

    forwarded = call("POST", f"/api/messages/{msg['id']}/forward", {"targets": [carol]}, token=alice_auth["token"])
    assert len(forwarded) == 1, forwarded
    assert forwarded[0]["receiver"] == carol, forwarded
    assert forwarded[0]["content"].startswith("[转发]") or forwarded[0]["content"].startswith("[杞"), forwarded

    edited = call("PATCH", f"/api/messages/{msg['id']}", {"content": "phase9 edited"}, token=alice_auth["token"])
    assert edited["edited_at"], edited

    recalled = call("POST", f"/api/messages/{msg['id']}/recall", token=alice_auth["token"])
    assert recalled["recalled_at"], recalled

    admin = call("POST", "/api/login", {"username": "admin", "password": "123456"})
    audits = call("GET", f"/api/admin/message-audits?message_id={msg['id']}", token=admin["token"])
    actions = {item["action"] for item in audits}
    assert {"edit", "recall"}.issubset(actions), audits

    read_result = call("POST", f"/api/messages/read?username={bob}&peer={alice}", token=bob_auth["token"])
    assert "burned" in read_result, read_result

    print("PHASE9_OK", json.dumps({"message_id": msg["id"], "forwarded_to": carol}, sort_keys=True))


if __name__ == "__main__":
    main()
