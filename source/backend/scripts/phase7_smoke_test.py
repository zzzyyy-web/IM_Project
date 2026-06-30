import asyncio
import json
import time
from urllib import error, request

import websockets


BASE_URL = "http://127.0.0.1:8000"


def call(method: str, path: str, payload: dict | None = None, token: str | None = None, expect_error: bool = False) -> dict | list:
    data = None
    headers = {"Content-Type": "application/json"}
    if token:
        headers["Authorization"] = f"Bearer {token}"
    if payload is not None:
        data = json.dumps(payload).encode("utf-8")
    req = request.Request(f"{BASE_URL}{path}", data=data, headers=headers, method=method)
    try:
        with request.urlopen(req, timeout=10) as resp:
            return json.loads(resp.read().decode("utf-8"))
    except error.HTTPError as exc:
        body = json.loads(exc.read().decode("utf-8"))
        if expect_error:
            return body
        raise AssertionError(body) from exc


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


async def expect_group_message(sender: str, sender_token: str, receiver: str, receiver_token: str, group_id: int) -> tuple[dict, dict]:
    sender_ws = await websockets.connect(f"ws://127.0.0.1:8000/ws/{sender}?token={sender_token}")
    receiver_ws = await websockets.connect(f"ws://127.0.0.1:8000/ws/{receiver}?token={receiver_token}")
    await sender_ws.recv()
    await receiver_ws.recv()
    await sender_ws.send(json.dumps({"type": "group_chat", "group_id": group_id, "content": f"@{receiver} phase7 hello", "msg_type": "text"}))
    ack = json.loads(await sender_ws.recv())
    pushed = json.loads(await receiver_ws.recv())
    await sender_ws.close()
    await receiver_ws.close()
    return ack, pushed


def main() -> None:
    suffix = str(int(time.time() * 1000))
    alice = f"p7_alice_{suffix}"
    bob = f"p7_bob_{suffix}"
    carol = f"p7_carol_{suffix}"

    alice_auth = register_user(alice)
    bob_auth = register_user(bob)
    carol_auth = register_user(carol)

    group = call(
        "POST",
        "/api/groups",
        {"name": f"phase7_group_{suffix}", "member_usernames": [bob, carol], "announcement": "phase7 announcement"},
        token=alice_auth["token"],
    )
    group_id = group["id"]
    assert group["owner"] == alice, group

    denied = call("PATCH", f"/api/groups/{group_id}", {"name": "bad_update"}, token=bob_auth["token"], expect_error=True)
    assert "detail" in denied, denied

    updated = call(
        "PATCH",
        f"/api/groups/{group_id}",
        {"name": f"phase7_group_new_{suffix}", "announcement": "phase7 new announcement"},
        token=alice_auth["token"],
    )
    assert updated["name"].startswith("phase7_group_new_"), updated
    assert updated["announcement"] == "phase7 new announcement", updated

    nicked = call("PATCH", f"/api/groups/{group_id}/members/me", {"nickname": "BobInGroup"}, token=bob_auth["token"])
    bob_member = next(item for item in nicked["members"] if item["username"] == bob)
    assert bob_member["group_nickname"] == "BobInGroup", nicked

    removed = call("DELETE", f"/api/groups/{group_id}/members/by-username/{carol}", token=alice_auth["token"])
    assert removed["deleted"] is True, removed
    carol_groups = call("GET", "/api/groups", token=carol_auth["token"])
    assert not any(item["id"] == group_id for item in carol_groups), carol_groups

    transfer = call("POST", f"/api/groups/{group_id}/owner", {"username": bob}, token=alice_auth["token"])
    assert transfer["owner"] == bob, transfer
    bob_member = next(item for item in transfer["members"] if item["username"] == bob)
    assert bob_member["group_role"] == "owner", transfer

    owner_exit_denied = call("DELETE", f"/api/groups/{group_id}/members/me", token=bob_auth["token"], expect_error=True)
    assert "detail" in owner_exit_denied, owner_exit_denied

    ack, pushed = asyncio.run(expect_group_message(bob, bob_auth["token"], alice, alice_auth["token"], group_id))
    assert ack["type"] == "ack", ack
    assert ack["group_id"] == group_id, ack
    assert ack["read_count"] >= 1, ack
    assert "unread_count" in ack, ack
    assert pushed["type"] == "group_chat", pushed
    assert pushed["content"].startswith(f"@{alice}"), pushed

    messages = call("GET", f"/api/groups/{group_id}/messages", token=alice_auth["token"])
    target = next(item for item in messages if item["content"].startswith(f"@{alice}"))
    marked = call("POST", f"/api/groups/{group_id}/read?message_id={target['id']}", token=alice_auth["token"])
    assert marked["last_read_message_id"] >= int(target["id"]), marked

    print("PHASE7_OK", json.dumps({"group_id": group_id, "owner": bob, "member": alice}, sort_keys=True))


if __name__ == "__main__":
    main()
