import asyncio
import json
import time
from urllib import request

import websockets


BASE_URL = "http://127.0.0.1:8000"


def call(method: str, path: str, payload: dict | None = None) -> dict:
    data = None
    headers = {"Content-Type": "application/json"}
    if payload is not None:
        data = json.dumps(payload).encode("utf-8")
    req = request.Request(f"{BASE_URL}{path}", data=data, headers=headers, method=method)
    with request.urlopen(req, timeout=10) as resp:
        return json.loads(resp.read().decode("utf-8"))


def register_user(username: str) -> str:
    captcha = call("GET", "/api/captcha")
    result = call(
        "POST",
        "/api/register",
        {"username": username, "password": "abc123", "captcha": captcha["code"], "captcha_token": captcha["captcha_token"]},
    )
    return result["token"]


async def main() -> None:
    suffix = int(time.time() * 1000)
    alice_name = f"ws_alice_{suffix}"
    bob_name = f"ws_bob_{suffix}"
    alice_token = register_user(alice_name)
    bob_token = register_user(bob_name)

    alice = await websockets.connect(f"ws://127.0.0.1:8000/ws/{alice_name}?token={alice_token}")
    bob = await websockets.connect(f"ws://127.0.0.1:8000/ws/{bob_name}?token={bob_token}")
    await alice.recv()
    await bob.recv()

    await alice.send(json.dumps({"type": "chat", "receiver": bob_name, "content": "hello from websocket test"}))

    ack = json.loads(await alice.recv())
    received = json.loads(await bob.recv())

    print("ACK", ack["type"], ack["sender"], ack["receiver"], ack["content"])
    print("BOB", received["type"], received["sender"], received["receiver"], received["content"])

    await alice.close()
    await bob.close()


if __name__ == "__main__":
    asyncio.run(main())
