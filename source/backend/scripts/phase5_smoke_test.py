import json
import time
from urllib import request
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


def flatten(nodes: list[dict]) -> list[dict]:
    result: list[dict] = []
    for node in nodes:
        result.append(node)
        result.extend(flatten(node.get("children", [])))
    return result


def main() -> None:
    suffix = str(int(time.time() * 1000))
    alice = f"p5_alice_{suffix}"
    bob = f"p5_bob_{suffix}"
    department_name = f"研发中心_{suffix}"
    child_department_name = f"前端组_{suffix}"

    alice_auth = register_user(alice)
    bob_auth = register_user(bob)
    admin_auth = call("POST", "/api/login", {"username": "admin", "password": "123456"})
    admin_token = admin_auth["token"]

    company = call("PUT", "/api/admin/org/company", {"name": f"阶段五企业_{suffix}", "description": "phase5"}, token=admin_token)
    assert company["name"].startswith("阶段五企业_"), company

    department = call("POST", "/api/admin/org/departments", {"name": department_name, "description": "phase5 root"}, token=admin_token)
    child = call(
        "POST",
        "/api/admin/org/departments",
        {"name": child_department_name, "parent_id": department["id"], "description": "phase5 child"},
        token=admin_token,
    )
    member = call("POST", f"/api/admin/org/departments/{child['id']}/members", {"username": alice, "position": "前端工程师"}, token=admin_token)
    assert member["username"] == alice, member
    assert member["position"] == "前端工程师", member

    call("POST", f"/api/admin/org/departments/{department['id']}/members", {"username": bob, "position": "后端工程师"}, token=admin_token)

    tree = call("GET", "/api/org/tree", token=alice_auth["token"])
    nodes = flatten(tree)
    current = next(item for item in nodes if item["id"] == child["id"])
    assert any(item["username"] == alice and item["position"] == "前端工程师" for item in current["members"]), current

    search_department = call("GET", "/api/search?" + urlencode({"username": alice, "q": child_department_name}), token=alice_auth["token"])
    assert any(item["name"] == child_department_name for item in search_department["departments"]), search_department

    search_member = call("GET", "/api/search?" + urlencode({"username": alice, "q": "前端工程师"}), token=alice_auth["token"])
    assert any(item["username"] == alice for item in search_member["members"]), search_member

    logs = call("GET", "/api/admin/operation-logs?limit=100", token=admin_token)
    actions = {item["action"] for item in logs}
    assert "create_department" in actions, logs
    assert "assign_department_member" in actions, logs

    print("PHASE5_OK", json.dumps({"department": department_name, "member": alice}, ensure_ascii=False, sort_keys=True))


if __name__ == "__main__":
    main()
