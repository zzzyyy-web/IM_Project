import asyncio
import json
import time
from urllib import request
from urllib.parse import urlencode

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


def register_user(username: str, display_name: str) -> dict:
    captcha = call("GET", "/api/captcha")
    return call(
        "POST",
        "/api/register",
        {
            "username": username,
            "password": "abc123",
            "captcha": captcha["code"],
            "captcha_token": captcha["captcha_token"],
            "display_name": display_name,
        },
    )


async def send_message(sender: str, sender_token: str, receiver: str, content: str) -> dict:
    ws = await websockets.connect(f"ws://127.0.0.1:8000/ws/{sender}?token={sender_token}")
    await ws.recv()
    await ws.send(json.dumps({"type": "chat", "receiver": receiver, "content": content, "msg_type": "text"}))
    ack = json.loads(await ws.recv())
    await ws.close()
    return ack


def main() -> None:
    suffix = str(int(time.time() * 1000))
    alice = f"p1_alice_{suffix}"
    bob = f"p1_bob_{suffix}"
    message = "phase1 searchable message"

    alice_auth = register_user(alice, "Phase1 Alice")
    bob_auth = register_user(bob, "Phase1 Bob")
    alice_token = alice_auth["token"]
    bob_token = bob_auth["token"]

    friend_request = call(
        "POST",
        "/api/friend-requests",
        {"from_user": alice, "to_user": bob, "message": "phase1 friend workflow"},
        token=alice_token,
    )
    call("POST", f"/api/friend-requests/{friend_request['id']}/action", {"action": "accept"}, token=bob_token)

    ack = asyncio.run(send_message(alice, alice_token, bob, message))
    assert ack["type"] == "ack"

    search_result = call("GET", "/api/search?" + urlencode({"username": alice, "q": "phase1"}), token=alice_token)
    assert any(item["content"] == message for item in search_result["messages"]), search_result
    assert any(item["target_id"] == bob for item in search_result["sessions"]), search_result

    session = call(
        "PATCH",
        f"/api/sessions/{bob}?" + urlencode({"username": alice}),
        {"pinned": True, "muted": True},
        token=alice_token,
    )
    assert session["is_pinned"] is True
    assert session["is_muted"] is True

    admin_auth = call("POST", "/api/login", {"username": "admin", "password": "123456"})
    friendships = call("GET", "/api/admin/friendships?limit=20", token=admin_auth["token"])
    assert any(item["pair_key"] == f"{alice}:{bob}" for item in friendships), friendships

    call("DELETE", "/api/messages?" + urlencode({"username": alice, "peer": bob}), token=alice_token)
    messages = call("GET", "/api/messages?" + urlencode({"me": alice, "peer": bob}), token=alice_token)
    assert messages == [], messages

    print("PHASE1_OK", json.dumps({"alice": alice, "bob": bob}, sort_keys=True))


if __name__ == "__main__":
    main()
