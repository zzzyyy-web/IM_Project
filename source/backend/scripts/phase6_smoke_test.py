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


async def expect_group_delivery(alice: str, alice_token: str, bob: str, bob_token: str, group_id: int) -> tuple[dict, dict]:
    alice_ws = await websockets.connect(f"ws://127.0.0.1:8000/ws/{alice}?token={alice_token}")
    bob_ws = await websockets.connect(f"ws://127.0.0.1:8000/ws/{bob}?token={bob_token}")
    await alice_ws.recv()
    await bob_ws.recv()
    await alice_ws.send(json.dumps({"type": "group_chat", "group_id": group_id, "content": "phase6 group hello", "msg_type": "text"}))
    ack = json.loads(await alice_ws.recv())
    pushed = json.loads(await bob_ws.recv())
    await alice_ws.close()
    await bob_ws.close()
    return ack, pushed


def main() -> None:
    suffix = str(int(time.time() * 1000))
    alice = f"p6_alice_{suffix}"
    bob = f"p6_bob_{suffix}"
    carol = f"p6_carol_{suffix}"

    alice_auth = register_user(alice)
    bob_auth = register_user(bob)
    carol_auth = register_user(carol)

    group = call(
        "POST",
        "/api/groups",
        {"name": f"phase6_group_{suffix}", "member_usernames": [bob], "announcement": "phase6 announcement"},
        token=alice_auth["token"],
    )
    group_id = group["id"]
    assert any(item["username"] == alice for item in group["members"]), group
    assert any(item["username"] == bob for item in group["members"]), group

    ack, pushed = asyncio.run(expect_group_delivery(alice, alice_auth["token"], bob, bob_auth["token"], group_id))
    assert ack["type"] == "ack", ack
    assert ack["group_id"] == group_id, ack
    assert pushed["type"] == "group_chat", pushed
    assert pushed["content"] == "phase6 group hello", pushed

    messages = call("GET", f"/api/groups/{group_id}/messages", token=bob_auth["token"])
    assert any(item["content"] == "phase6 group hello" for item in messages), messages

    updated = call("POST", f"/api/groups/{group_id}/members", {"usernames": [carol]}, token=alice_auth["token"])
    assert any(item["username"] == carol for item in updated["members"]), updated

    carol_groups = call("GET", "/api/groups", token=carol_auth["token"])
    assert any(item["id"] == group_id for item in carol_groups), carol_groups

    exited = call("DELETE", f"/api/groups/{group_id}/members/me", token=carol_auth["token"])
    assert exited["deleted"] is True, exited

    admin = call("POST", "/api/login", {"username": "admin", "password": "123456"})
    admin_groups = call("GET", "/api/admin/groups?limit=50", token=admin["token"])
    admin_group = next(item for item in admin_groups if item["id"] == group_id)
    assert any(item["username"] == alice for item in admin_group["members"]), admin_group
    assert any(item["username"] == bob for item in admin_group["members"]), admin_group

    dissolved = call("DELETE", f"/api/admin/groups/{group_id}", token=admin["token"])
    assert dissolved["dissolved"] is True, dissolved

    print("PHASE6_OK", json.dumps({"group_id": group_id, "alice": alice, "bob": bob, "carol": carol}, sort_keys=True))


if __name__ == "__main__":
    main()
