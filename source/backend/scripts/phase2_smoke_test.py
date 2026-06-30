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


async def expect_blocked_message(sender: str, sender_token: str, receiver: str) -> dict:
    ws = await websockets.connect(f"ws://127.0.0.1:8000/ws/{sender}?token={sender_token}")
    await ws.recv()
    await ws.send(json.dumps({"type": "chat", "receiver": receiver, "content": "blocked message", "msg_type": "text"}))
    result = json.loads(await ws.recv())
    await ws.close()
    return result


async def expect_friend_request_push(sender: str, sender_token: str, receiver: str, receiver_token: str) -> tuple[dict, dict]:
    ws = await websockets.connect(f"ws://127.0.0.1:8000/ws/{receiver}?token={receiver_token}")
    await ws.recv()
    friend_request = call(
        "POST",
        "/api/friend-requests",
        {"from_user": sender, "to_user": receiver, "message": "phase2 friend request"},
        token=sender_token,
    )
    pushed = json.loads(await ws.recv())
    await ws.close()
    return friend_request, pushed


async def expect_stage2_message_features(alice: str, alice_token: str, bob: str, bob_token: str) -> None:
    alice_ws = await websockets.connect(f"ws://127.0.0.1:8000/ws/{alice}?token={alice_token}")
    bob_ws = await websockets.connect(f"ws://127.0.0.1:8000/ws/{bob}?token={bob_token}")
    await alice_ws.recv()
    await bob_ws.recv()

    await alice_ws.send(json.dumps({"type": "typing", "receiver": bob}))
    typing = json.loads(await bob_ws.recv())
    assert typing["type"] == "typing", typing
    assert typing["sender"] == alice, typing

    await alice_ws.send(json.dumps({"type": "chat", "receiver": bob, "content": "phase2 editable message", "msg_type": "text"}))
    ack = json.loads(await alice_ws.recv())
    received = json.loads(await bob_ws.recv())
    assert ack["type"] == "ack", ack
    assert received["type"] == "chat", received
    assert received["content"] == "phase2 editable message", received

    edited = call("PATCH", f"/api/messages/{ack['id']}", {"content": "phase2 edited message"}, token=alice_token)
    pushed_edit = json.loads(await bob_ws.recv())
    assert edited["edited_at"], edited
    assert pushed_edit["type"] == "message_update", pushed_edit
    assert pushed_edit["content"] == "phase2 edited message", pushed_edit

    recalled = call("POST", f"/api/messages/{ack['id']}/recall", token=alice_token)
    pushed_recall = json.loads(await bob_ws.recv())
    assert recalled["status"] == "recalled", recalled
    assert recalled["recalled_at"], recalled
    assert pushed_recall["type"] == "message_recall", pushed_recall
    assert pushed_recall["status"] == "recalled", pushed_recall

    await alice_ws.close()
    await bob_ws.close()


def main() -> None:
    suffix = str(int(time.time() * 1000))
    alice = f"p2_alice_{suffix}"
    bob = f"p2_bob_{suffix}"

    alice_auth = register_user(alice, "Phase2 Alice")
    bob_auth = register_user(bob, "Phase2 Bob")
    alice_token = alice_auth["token"]
    bob_token = bob_auth["token"]

    friend_request, pushed_request = asyncio.run(expect_friend_request_push(alice, alice_token, bob, bob_token))
    assert pushed_request["type"] == "friend_request", pushed_request
    assert pushed_request["from_user"] == alice, pushed_request
    assert pushed_request["to_user"] == bob, pushed_request
    inbox = call("GET", "/api/friend-requests?" + urlencode({"username": bob, "box": "inbox"}), token=bob_token)
    assert any(item["id"] == friend_request["id"] and item["status"] == "pending" for item in inbox), inbox

    call(
        "POST",
        f"/api/friend-requests/{friend_request['id']}/action",
        {"action": "accept", "remark": "Alice Remark"},
        token=bob_token,
    )

    bob_friends = call("GET", "/api/friends?" + urlencode({"username": bob}), token=bob_token)
    alice_item = next(item for item in bob_friends if item["username"] == alice)
    assert alice_item["remark"] == "Alice Remark", alice_item
    assert alice_item["friend_source"] == "friend_request", alice_item

    updated = call(
        "PATCH",
        f"/api/friends/{alice}?" + urlencode({"username": bob}),
        {"remark": "Alice Final"},
        token=bob_token,
    )
    assert updated["remark"] == "Alice Final", updated

    sessions = call("GET", "/api/sessions?" + urlencode({"username": bob}), token=bob_token)
    session = next(item for item in sessions if item["target_id"] == alice)
    assert session["name"] == "Alice Final", session

    call("POST", f"/api/blacklist/{alice}?" + urlencode({"username": bob}), {"reason": "phase2 block"}, token=bob_token)
    blacklist = call("GET", "/api/blacklist?" + urlencode({"username": bob}), token=bob_token)
    assert any(item["username"] == alice for item in blacklist), blacklist

    blocked = asyncio.run(expect_blocked_message(alice, alice_token, bob))
    assert blocked["type"] == "error"
    assert blocked["message"] == "对方或你已在黑名单中，不能发送消息", blocked

    call("DELETE", f"/api/blacklist/{alice}?" + urlencode({"username": bob}), token=bob_token)
    blacklist = call("GET", "/api/blacklist?" + urlencode({"username": bob}), token=bob_token)
    assert not any(item["username"] == alice for item in blacklist), blacklist

    asyncio.run(expect_stage2_message_features(alice, alice_token, bob, bob_token))

    deleted = call("DELETE", f"/api/friends/{alice}?" + urlencode({"username": bob}), token=bob_token)
    assert deleted["deleted"] is True, deleted

    bob_friends = call("GET", "/api/friends?" + urlencode({"username": bob}), token=bob_token)
    assert not any(item["username"] == alice for item in bob_friends), bob_friends

    print("PHASE2_OK", json.dumps({"alice": alice, "bob": bob}, sort_keys=True))


if __name__ == "__main__":
    main()
