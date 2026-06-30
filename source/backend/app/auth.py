import base64
import hashlib
import hmac
import json
import os
import re
import secrets
import time

USERNAME_RE = re.compile(r"^[A-Za-z0-9_]{3,32}$")
PASSWORD_RE = re.compile(r"^(?=.*[A-Za-z])(?=.*\d).{6,32}$")
SECRET_KEY = os.getenv("IM_SECRET_KEY", "im-project-local-secret")
TOKEN_TTL_SECONDS = 60 * 60 * 24
CAPTCHA_TTL_SECONDS = 5 * 60

_captchas: dict[str, tuple[str, float]] = {}


def _b64_encode(raw: bytes) -> str:
    return base64.urlsafe_b64encode(raw).decode("ascii").rstrip("=")


def _b64_decode(value: str) -> bytes:
    padding = "=" * (-len(value) % 4)
    return base64.urlsafe_b64decode(value + padding)


def validate_username(username: str) -> str:
    clean = (username or "").strip()
    if not USERNAME_RE.fullmatch(clean):
        raise ValueError("用户名必须为 3-32 位，只能包含字母、数字和下划线")
    return clean


def validate_password(password: str) -> str:
    if not PASSWORD_RE.fullmatch(password or ""):
        raise ValueError("密码必须为 6-32 位，且至少包含 1 个字母和 1 个数字")
    return password


def hash_password(password: str, salt: str | None = None) -> tuple[str, str]:
    password_salt = salt or secrets.token_hex(16)
    digest = hashlib.pbkdf2_hmac(
        "sha256",
        password.encode("utf-8"),
        password_salt.encode("utf-8"),
        120_000,
    )
    return _b64_encode(digest), password_salt


def verify_password(password: str, password_hash: str, password_salt: str) -> bool:
    if not password or not password_hash or not password_salt:
        return False
    expected_hash, _ = hash_password(password, password_salt)
    return hmac.compare_digest(expected_hash, password_hash)


def create_token(username: str, role: str = "user") -> str:
    payload = {"sub": username, "role": role, "exp": int(time.time()) + TOKEN_TTL_SECONDS}
    payload_raw = json.dumps(payload, separators=(",", ":"), ensure_ascii=False).encode("utf-8")
    payload_part = _b64_encode(payload_raw)
    signature = hmac.new(SECRET_KEY.encode("utf-8"), payload_part.encode("ascii"), hashlib.sha256).digest()
    return f"{payload_part}.{_b64_encode(signature)}"


def decode_token(token: str) -> dict:
    try:
        payload_part, signature_part = token.split(".", 1)
        expected_signature = hmac.new(
            SECRET_KEY.encode("utf-8"),
            payload_part.encode("ascii"),
            hashlib.sha256,
        ).digest()
        if not hmac.compare_digest(_b64_encode(expected_signature), signature_part):
            raise ValueError
        payload = json.loads(_b64_decode(payload_part).decode("utf-8"))
    except Exception as exc:
        raise ValueError("登录已失效，请重新登录") from exc
    if int(payload.get("exp", 0)) < int(time.time()):
        raise ValueError("登录已过期，请重新登录")
    if not payload.get("sub"):
        raise ValueError("登录已失效，请重新登录")
    return payload


def create_captcha() -> dict:
    token = secrets.token_urlsafe(24)
    code = f"{secrets.randbelow(9000) + 1000}"
    _captchas[token] = (code, time.time() + CAPTCHA_TTL_SECONDS)
    return {"captcha_token": token, "code": code}


def verify_captcha(code: str, captcha_token: str) -> bool:
    item = _captchas.pop(captcha_token or "", None)
    if not item:
        return False
    expected, expires_at = item
    if expires_at < time.time():
        return False
    return hmac.compare_digest(expected, (code or "").strip())
