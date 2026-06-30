import json
import time
from urllib import error, request


BASE_URL = "http://127.0.0.1:8000"


def call(method: str, path: str, payload: dict | None = None, token: str | None = None, expect_error: bool = False) -> dict | list | bytes:
    data = None
    headers = {}
    if token:
        headers["Authorization"] = f"Bearer {token}"
    if payload is not None:
        headers["Content-Type"] = "application/json"
        data = json.dumps(payload).encode("utf-8")
    req = request.Request(f"{BASE_URL}{path}", data=data, headers=headers, method=method)
    try:
        with request.urlopen(req, timeout=10) as resp:
            body = resp.read()
            content_type = resp.headers.get("Content-Type", "")
            if "application/json" in content_type:
                return json.loads(body.decode("utf-8"))
            return body
    except error.HTTPError as exc:
        body = exc.read().decode("utf-8")
        if expect_error:
            return json.loads(body)
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


def upload_text(token: str, filename: str, content: bytes) -> dict:
    boundary = f"----phase10{int(time.time() * 1000)}"
    body = b"".join(
        [
            f"--{boundary}\r\n".encode(),
            f'Content-Disposition: form-data; name="file"; filename="{filename}"\r\n'.encode(),
            b"Content-Type: text/plain\r\n\r\n",
            content,
            f"\r\n--{boundary}--\r\n".encode(),
        ]
    )
    req = request.Request(
        f"{BASE_URL}/api/attachments",
        data=body,
        headers={"Authorization": f"Bearer {token}", "Content-Type": f"multipart/form-data; boundary={boundary}"},
        method="POST",
    )
    with request.urlopen(req, timeout=10) as resp:
        return json.loads(resp.read().decode("utf-8"))


def main() -> None:
    suffix = str(int(time.time() * 1000))
    user = f"p10_user_{suffix}"
    auth = register_user(user)
    admin = call("POST", "/api/login", {"username": "admin", "password": "123456"})

    policy = call("GET", "/api/admin/upload-policy", token=admin["token"])
    assert ".txt" in policy["allowed_suffixes"], policy
    assert policy["limits"]["image"] <= policy["max_upload_bytes"], policy

    attachment = upload_text(auth["token"], f"phase10_{suffix}.txt", b"phase10 file")
    assert attachment["category"] == "file", attachment
    assert attachment["uploader"] == user, attachment

    filtered = call("GET", f"/api/admin/attachments?category=file&uploader={user}&limit=20", token=admin["token"])
    assert any(item["id"] == attachment["id"] for item in filtered), filtered

    downloaded = call("GET", f"/api/attachments/{attachment['id']}/download")
    assert downloaded == b"phase10 file", downloaded

    logs = call("GET", "/api/admin/attachment-download-logs?limit=20", token=admin["token"])
    assert any(item["attachment_id"] == attachment["id"] for item in logs), logs

    missing = call("GET", "/api/attachments/99999999/download", expect_error=True)
    assert "附件" in missing["detail"], missing

    print("PHASE10_OK", json.dumps({"attachment_id": attachment["id"], "uploader": user}, sort_keys=True))


if __name__ == "__main__":
    main()
