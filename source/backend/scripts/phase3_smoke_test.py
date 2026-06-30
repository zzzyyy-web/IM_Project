import json
import tempfile
import time
from pathlib import Path
from urllib import request
from urllib.parse import urlencode

import websockets
import asyncio


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


def upload(token: str, filename: str, content: bytes, content_type: str) -> dict:
    boundary = f"----phase3{int(time.time() * 1000)}"
    body = (
        f"--{boundary}\r\n"
        f'Content-Disposition: form-data; name="file"; filename="{filename}"\r\n'
        f"Content-Type: {content_type}\r\n\r\n"
    ).encode("utf-8") + content + f"\r\n--{boundary}--\r\n".encode("utf-8")
    req = request.Request(
        f"{BASE_URL}/api/attachments",
        data=body,
        headers={
            "Authorization": f"Bearer {token}",
            "Content-Type": f"multipart/form-data; boundary={boundary}",
        },
        method="POST",
    )
    with request.urlopen(req, timeout=10) as resp:
        return json.loads(resp.read().decode("utf-8"))


async def send_attachment_message(sender: str, sender_token: str, receiver: str, attachment: dict, msg_type: str) -> dict:
    sender_ws = await websockets.connect(f"ws://127.0.0.1:8000/ws/{sender}?token={sender_token}")
    receiver_ws = await websockets.connect(f"ws://127.0.0.1:8000/ws/{receiver}?token={call_tokens[receiver]}")
    await sender_ws.recv()
    await receiver_ws.recv()
    await sender_ws.send(json.dumps({
        "type": "chat",
        "receiver": receiver,
        "content": attachment["original_name"],
        "msg_type": msg_type,
        "attachment_ids": [attachment["id"]],
    }))
    ack = json.loads(await sender_ws.recv())
    received = json.loads(await receiver_ws.recv())
    await sender_ws.close()
    await receiver_ws.close()
    assert ack["attachments"], ack
    assert received["attachments"], received
    assert received["attachments"][0]["id"] == attachment["id"], received
    return received


call_tokens: dict[str, str] = {}


def main() -> None:
    suffix = str(int(time.time() * 1000))
    alice = f"p3_alice_{suffix}"
    bob = f"p3_bob_{suffix}"
    alice_auth = register_user(alice)
    bob_auth = register_user(bob)
    call_tokens[alice] = alice_auth["token"]
    call_tokens[bob] = bob_auth["token"]

    friend_request = call(
        "POST",
        "/api/friend-requests",
        {"from_user": alice, "to_user": bob, "message": "phase3 friend request"},
        token=alice_auth["token"],
    )
    call("POST", f"/api/friend-requests/{friend_request['id']}/action", {"action": "accept"}, token=bob_auth["token"])

    image = upload(alice_auth["token"], "phase3.png", b"\x89PNG\r\n\x1a\nphase3", "image/png")
    file_item = upload(alice_auth["token"], "phase3.txt", b"phase3 file", "text/plain")
    audio = upload(alice_auth["token"], "phase3.mp3", b"ID3phase3", "audio/mpeg")

    asyncio.run(send_attachment_message(alice, alice_auth["token"], bob, image, "image"))
    asyncio.run(send_attachment_message(alice, alice_auth["token"], bob, file_item, "file"))
    asyncio.run(send_attachment_message(alice, alice_auth["token"], bob, audio, "audio"))

    admin = call("POST", "/api/login", {"username": "admin", "password": "123456"})
    attachments = call("GET", "/api/admin/attachments?limit=20", token=admin["token"])
    attachment_ids = {item["id"] for item in attachments}
    assert image["id"] in attachment_ids, attachments
    assert file_item["id"] in attachment_ids, attachments
    assert audio["id"] in attachment_ids, attachments

    with request.urlopen(f"{BASE_URL}/api/attachments/{file_item['id']}/download", timeout=10) as resp:
        assert resp.read() == b"phase3 file"

    print("PHASE3_OK", json.dumps({"alice": alice, "bob": bob}, sort_keys=True))


if __name__ == "__main__":
    main()
