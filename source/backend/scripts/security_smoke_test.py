import json
import time
from urllib import error, request
from urllib.parse import urlencode


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


def expect_http_error(method: str, path: str, status: int, payload: dict | None = None, token: str | None = None) -> None:
    try:
        call(method, path, payload, token)
    except error.HTTPError as exc:
        assert exc.code == status, (exc.code, status, path)
        return
    raise AssertionError(f"expected HTTP {status} for {path}")


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
        },
    )


def main() -> None:
    suffix = str(int(time.time() * 1000))
    alice = f"sec_alice_{suffix}"
    bob = f"sec_bob_{suffix}"

    expect_http_error("POST", "/api/register", 400, {"username": f"bad_{suffix}", "password": "abc123", "captcha": "0000", "captcha_token": "bad"})

    alice_auth = register_user(alice)
    bob_auth = register_user(bob)
    alice_token = alice_auth["token"]
    bob_token = bob_auth["token"]

    expect_http_error("GET", "/api/users", 401)
    expect_http_error("GET", "/api/admin/overview", 403, token=alice_token)
    expect_http_error("GET", "/api/friends?" + urlencode({"username": bob}), 403, token=alice_token)
    expect_http_error("PATCH", f"/api/users/{bob}", 403, {"signature": "hacked"}, token=alice_token)
    expect_http_error("POST", "/api/friend-requests", 403, {"from_user": bob, "to_user": alice, "message": "fake"}, token=alice_token)

    own = call("PATCH", f"/api/users/{alice}", {"signature": "secured"}, token=alice_token)
    assert own["signature"] == "secured"

    admin = call("POST", "/api/login", {"username": "admin", "password": "123456"})
    overview = call("GET", "/api/admin/overview", token=admin["token"])

    print("SECURITY_OK", json.dumps({"users": overview["users"], "alice": alice, "bob": bob}, sort_keys=True))


if __name__ == "__main__":
    main()
