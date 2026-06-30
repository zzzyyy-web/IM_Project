from pathlib import Path
from uuid import uuid4

from fastapi import Depends, FastAPI, File, Header, HTTPException, UploadFile, WebSocket, WebSocketDisconnect
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse
from pydantic import ValidationError

from app.auth import create_captcha, create_token, decode_token, validate_password, validate_username, verify_captcha
from app.config import ATTACHMENT_DIR, MAX_UPLOAD_BYTES
from app.connection_manager import manager
from app.database import (
    add_blacklist,
    authenticate_user,
    admin_list_friend_requests,
    admin_list_friendships,
    admin_list_attachments,
    admin_list_attachment_download_logs,
    admin_list_groups,
    admin_list_messages,
    admin_overview,
    admin_trends,
    add_group_members,
    assign_user_department,
    create_sensitive_word,
    create_attachment,
    create_department,
    create_group,
    clear_conversation,
    create_user,
    delete_department,
    dissolve_group,
    edit_message,
    exit_group,
    favorite_message,
    forward_message,
    create_friend_request,
    get_company_settings,
    get_conversation_draft,
    get_user_settings,
    group_read_members,
    is_blocked_between,
    list_department_tree,
    list_departments_flat,
    list_operation_logs,
    list_sensitive_words,
    list_system_configs,
    list_blacklist,
    get_user,
    get_attachment,
    init_db,
    list_conversation,
    list_friend_requests,
    list_friends,
    list_group_members,
    list_group_messages,
    list_message_audits,
    list_message_favorites,
    list_user_groups,
    list_sessions,
    list_users,
    mark_group_read,
    mark_conversation_read,
    match_sensitive_word,
    remove_group_member,
    remove_friend,
    remove_blacklist,
    remove_friendship_by_id,
    remove_user_department,
    record_login,
    record_screenshot_notice,
    record_attachment_download,
    record_operation,
    recall_message,
    reset_user_password,
    respond_friend_request,
    save_message,
    save_group_message,
    search_im,
    delete_sensitive_word,
    update_company_settings,
    update_department,
    update_friend_remark,
    update_group,
    update_group_nickname,
    update_sensitive_word,
    update_session_settings,
    update_system_config,
    update_user_profile,
    update_user_settings,
    save_conversation_draft,
    transfer_group_owner,
    toggle_message_reaction,
)
from app.schemas import (
    BlacklistCreate,
    AdminPasswordReset,
    ChatMessageIn,
    CompanySettingsUpdate,
    DepartmentCreate,
    DepartmentMemberAssign,
    DepartmentUpdate,
    ErrorMessage,
    GroupCreate,
    GroupMembersAdd,
    GroupNicknameUpdate,
    GroupOwnerTransfer,
    GroupUpdate,
    MessageEdit,
    MessageFavoriteCreate,
    MessageForward,
    MessageReactionToggle,
    SensitiveWordCreate,
    SensitiveWordUpdate,
    ConversationDraftUpdate,
    FriendUpdate,
    FriendRequestAction,
    FriendRequestCreate,
    LoginRequest,
    RegisterRequest,
    ScreenshotNoticeCreate,
    SessionSettingsUpdate,
    SystemConfigUpdate,
    UserProfileUpdate,
    UserSettingsUpdate,
)


app = FastAPI(title="IM Core Backend", version="0.2.0")

ADMIN_ROLES = {"admin", "operator", "audit", "readonly"}
ALLOWED_UPLOAD_CATEGORIES = {"image", "file", "audio"}
ALLOWED_FILE_SUFFIXES = {
    ".jpg", ".jpeg", ".png", ".gif", ".webp",
    ".pdf", ".doc", ".docx", ".xls", ".xlsx", ".ppt", ".pptx",
    ".txt", ".zip", ".rar", ".mp3", ".wav", ".ogg", ".m4a", ".webm",
}
UPLOAD_LIMITS = {
    "image": min(MAX_UPLOAD_BYTES, 10 * 1024 * 1024),
    "audio": min(MAX_UPLOAD_BYTES, 20 * 1024 * 1024),
    "file": MAX_UPLOAD_BYTES,
}

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:5174",
        "http://127.0.0.1:5174",
        "http://localhost:5175",
        "http://127.0.0.1:5175",
        "http://localhost:5176",
        "http://127.0.0.1:5176",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
def on_startup() -> None:
    init_db()


@app.exception_handler(RequestValidationError)
async def validation_exception_handler(_, exc: RequestValidationError) -> JSONResponse:
    first = exc.errors()[0] if exc.errors() else {}
    loc = ".".join(str(item) for item in first.get("loc", []) if item != "body")
    message = "输入内容不符合规范，请检查后重试"
    if loc == "username":
        message = "用户名必须为 3-32 位，只能包含字母、数字和下划线"
    elif loc == "password":
        message = "密码必须为 6-32 位，且至少包含 1 个字母和 1 个数字"
    elif loc == "captcha":
        message = "验证码格式不正确，请重新输入"
    elif loc in {"from_user", "to_user"}:
        message = "好友申请参数不正确，请刷新后重试"
    elif loc == "content":
        message = "消息内容不能为空，且不能超过 2000 字"
    return JSONResponse(status_code=422, content={"detail": message})


def translate_error(message: str) -> str:
    mapping = {
        "missing token": "请先登录",
        "invalid user": "登录用户无效，请重新登录",
        "admin only": "只有管理员可以执行该操作",
        "cannot operate on another user": "不能操作其他用户的数据",
        "cannot send request as another user": "不能替其他用户发送好友申请",
        "cannot add yourself": "不能添加自己为好友",
        "user not found": "用户不存在",
        "already friends": "你们已经是好友",
        "friend request blocked": "对方或你已在黑名单中，不能发送好友申请",
        "message blocked": "对方或你已在黑名单中，不能发送消息",
        "receiver not found": "接收方用户不存在",
        "Invalid chat message": "消息格式不正确",
        "cannot edit another user's message": "不能编辑别人的消息",
        "cannot recall another user's message": "不能撤回别人的消息",
        "message already recalled": "消息已撤回，不能再编辑",
        "message recall expired": "消息已超过 3 分钟，不能撤回",
        "attachment not found": "附件不存在",
        "attachment owner mismatch": "不能发送其他用户上传的附件",
        "sensitive word empty": "敏感词不能为空",
        "sensitive word exists": "敏感词已存在",
        "username already exists": "用户名已存在",
        "invalid action": "好友申请操作不正确",
        "friend request not found": "好友申请不存在",
        "friend not found": "好友不存在",
        "session not found": "会话不存在",
        "box must be inbox or outbox": "好友申请列表参数不正确",
        "admin account cannot be disabled": "不能禁用管理员账号",
        "password policy failed": "密码必须为 6-32 位，且至少包含 1 个字母和 1 个数字",
        "company name empty": "企业名称不能为空",
        "department name empty": "部门名称不能为空",
        "department not found": "部门不存在",
        "department parent invalid": "上级部门不能选择自己",
        "group name empty": "群名称不能为空",
        "group not found": "群聊不存在",
        "group member only": "只有群成员可以执行该操作",
        "group owner only": "只有群主可以修改群信息",
        "cannot remove group owner": "不能移除群主",
        "owner transfer required": "群主退出前需要先转让群主",
        "invalid theme": "主题设置不正确",
        "invalid language": "语言设置不正确",
        "invalid font size": "字体大小设置不正确",
        "invalid quiet hours": "免打扰时间不正确",
        "user settings not found": "用户设置不存在",
        "message not found": "消息不存在",
        "config key empty": "配置项不能为空",
    }
    return mapping.get(message, message)


def upload_category(filename: str, content_type: str) -> str:
    suffix = Path(filename).suffix.lower()
    if suffix not in ALLOWED_FILE_SUFFIXES:
        raise ValueError("不支持的文件类型")
    if content_type.startswith("image/"):
        return "image"
    if content_type.startswith("audio/"):
        return "audio"
    return "file"


def category_text(category: str) -> str:
    return {"image": "图片", "audio": "音频", "file": "文件"}.get(category, "文件")


def with_online_status(user: dict) -> dict:
    return {
        **user,
        "status": "online" if manager.is_online(user["username"]) else "offline",
    }


def with_org_online_status(nodes: list[dict]) -> list[dict]:
    result = []
    for node in nodes:
        result.append(
            {
                **node,
                "members": [with_online_status(member) for member in node.get("members", [])],
                "children": with_org_online_status(node.get("children", [])),
            }
        )
    return result


def current_user_from_token(authorization: str | None = Header(default=None)) -> dict:
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail=translate_error("missing token"))
    try:
        payload = decode_token(authorization.removeprefix("Bearer ").strip())
    except ValueError as exc:
        raise HTTPException(status_code=401, detail=str(exc)) from exc
    user = get_user(payload["sub"])
    if not user or user.get("disabled"):
        raise HTTPException(status_code=401, detail=translate_error("invalid user"))
    return user


def require_admin(user: dict = Depends(current_user_from_token)) -> dict:
    if user.get("role") not in ADMIN_ROLES:
        raise HTTPException(status_code=403, detail=translate_error("admin only"))
    return user


def require_super_admin(user: dict = Depends(current_user_from_token)) -> dict:
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail=translate_error("admin only"))
    return user


def require_self_or_admin(username: str, user: dict) -> None:
    if user["username"] != username and user.get("role") != "admin":
        raise HTTPException(status_code=403, detail=translate_error("cannot operate on another user"))


@app.get("/health")
def health() -> dict:
    return {"status": "ok", "service": "im-core", "version": "0.2.0"}


@app.get("/api/captcha")
def captcha() -> dict:
    item = create_captcha()
    return {**item, "hint": "local development captcha"}


@app.post("/api/register")
def register(payload: RegisterRequest) -> dict:
    if not verify_captcha(payload.captcha, payload.captcha_token):
        raise HTTPException(status_code=400, detail="验证码错误或已过期")
    try:
        username = validate_username(payload.username)
        validate_password(payload.password)
        user = create_user(username, payload.password, payload.display_name)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=translate_error(str(exc))) from exc
    token = create_token(user["username"], user["role"])
    return {"user": {**user, "status": "online"}, "token": token}


@app.post("/api/login")
def login(payload: LoginRequest) -> dict:
    user = authenticate_user(payload.username, payload.password)
    if not user:
        raise HTTPException(status_code=401, detail="用户名或密码错误")
    if user.get("disabled"):
        raise HTTPException(status_code=403, detail="账号已被禁用")
    record_login(user["username"], user["role"])
    if user.get("role") == "admin":
        record_operation(user["username"], "admin_login", user["username"], "管理员登录")
    token = create_token(user["username"], user["role"])
    return {"user": {**user, "status": "online"}, "token": token}


@app.get("/api/users")
def users(current_user: dict = Depends(current_user_from_token)) -> list[dict]:
    items = list_users()
    if current_user.get("role") != "admin":
        items = [item for item in items if item.get("role") != "admin"]
    return [with_online_status(user) for user in items]


@app.get("/api/users/{username}")
def user_detail(username: str, current_user: dict = Depends(current_user_from_token)) -> dict:
    require_self_or_admin(username, current_user)
    user = get_user(username)
    if not user:
        raise HTTPException(status_code=404, detail=translate_error("user not found"))
    return with_online_status(user)


@app.patch("/api/users/{username}")
def patch_user(
    username: str,
    payload: UserProfileUpdate,
    current_user: dict = Depends(current_user_from_token),
) -> dict:
    require_self_or_admin(username, current_user)
    if payload.disabled is not None:
        if current_user.get("role") != "admin":
            raise HTTPException(status_code=403, detail=translate_error("admin only"))
        if username == "admin" and payload.disabled:
            raise HTTPException(status_code=400, detail=translate_error("admin account cannot be disabled"))
    user = update_user_profile(username, payload.model_dump(exclude_unset=True))
    if not user:
        raise HTTPException(status_code=404, detail=translate_error("user not found"))
    if payload.disabled is not None:
        record_operation(current_user["username"], "user_disabled_update", username, f"disabled={payload.disabled}")
    return with_online_status(user)


@app.post("/api/admin/users/{username}/reset-password")
def admin_reset_password(username: str, payload: AdminPasswordReset, current_user: dict = Depends(require_super_admin)) -> dict:
    try:
        validate_password(payload.password)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=translate_error(str(exc))) from exc
    user = reset_user_password(username, payload.password)
    if not user:
        raise HTTPException(status_code=404, detail=translate_error("user not found"))
    record_operation(current_user["username"], "reset_password", username, "重置用户密码")
    return with_online_status(user)


@app.post("/api/friend-requests")
async def add_friend_request(payload: FriendRequestCreate, current_user: dict = Depends(current_user_from_token)) -> dict:
    if payload.from_user != current_user["username"]:
        raise HTTPException(status_code=403, detail=translate_error("cannot send request as another user"))
    try:
        request = create_friend_request(payload.from_user, payload.to_user, payload.message)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=translate_error(str(exc))) from exc

    await manager.send_to_user(payload.to_user, {"type": "friend_request", **request})
    return request


@app.get("/api/friend-requests")
def friend_requests(username: str, box: str = "inbox", current_user: dict = Depends(current_user_from_token)) -> list[dict]:
    require_self_or_admin(username, current_user)
    if box not in {"inbox", "outbox"}:
        raise HTTPException(status_code=400, detail=translate_error("box must be inbox or outbox"))
    return list_friend_requests(username, box)


@app.post("/api/friend-requests/{request_id}/action")
def friend_request_action(request_id: int, payload: FriendRequestAction, current_user: dict = Depends(current_user_from_token)) -> dict:
    current_requests = list_friend_requests(current_user["username"], "inbox")
    if not any(item["id"] == request_id for item in current_requests) and current_user.get("role") != "admin":
        raise HTTPException(status_code=403, detail=translate_error("cannot operate on another user"))
    try:
        request = respond_friend_request(request_id, payload.action, current_user["username"], payload.remark)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=translate_error(str(exc))) from exc
    if not request:
        raise HTTPException(status_code=404, detail=translate_error("friend request not found"))
    return request


@app.get("/api/friends")
def friends(username: str, current_user: dict = Depends(current_user_from_token)) -> list[dict]:
    require_self_or_admin(username, current_user)
    return [with_online_status(user) for user in list_friends(username)]


@app.patch("/api/friends/{friend_username}")
def patch_friend(friend_username: str, username: str, payload: FriendUpdate, current_user: dict = Depends(current_user_from_token)) -> dict:
    require_self_or_admin(username, current_user)
    friend = update_friend_remark(username, friend_username, payload.remark)
    if not friend:
        raise HTTPException(status_code=404, detail=translate_error("friend not found"))
    return with_online_status(friend)


@app.delete("/api/friends/{friend_username}")
def delete_friend(friend_username: str, username: str, current_user: dict = Depends(current_user_from_token)) -> dict:
    require_self_or_admin(username, current_user)
    deleted = remove_friend(username, friend_username)
    return {"deleted": deleted}


@app.get("/api/blacklist")
def blacklist(username: str, current_user: dict = Depends(current_user_from_token)) -> list[dict]:
    require_self_or_admin(username, current_user)
    return [with_online_status(user) for user in list_blacklist(username)]


@app.post("/api/blacklist/{target}")
def block_user(target: str, username: str, payload: BlacklistCreate, current_user: dict = Depends(current_user_from_token)) -> dict:
    require_self_or_admin(username, current_user)
    try:
        return add_blacklist(username, target, payload.reason)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=translate_error(str(exc))) from exc


@app.delete("/api/blacklist/{target}")
def unblock_user(target: str, username: str, current_user: dict = Depends(current_user_from_token)) -> dict:
    require_self_or_admin(username, current_user)
    return {"deleted": remove_blacklist(username, target)}


@app.get("/api/sessions")
def sessions(username: str, current_user: dict = Depends(current_user_from_token)) -> list[dict]:
    require_self_or_admin(username, current_user)
    return list_sessions(username)


@app.patch("/api/sessions/{peer}")
def patch_session(peer: str, username: str, payload: SessionSettingsUpdate, current_user: dict = Depends(current_user_from_token)) -> dict:
    require_self_or_admin(username, current_user)
    session = update_session_settings(username, peer, payload.pinned, payload.muted)
    if not session:
        raise HTTPException(status_code=404, detail=translate_error("session not found"))
    return session


@app.get("/api/settings")
def user_settings(current_user: dict = Depends(current_user_from_token)) -> dict:
    try:
        return get_user_settings(current_user["username"])
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=translate_error(str(exc))) from exc


@app.patch("/api/settings")
def patch_user_settings(payload: UserSettingsUpdate, current_user: dict = Depends(current_user_from_token)) -> dict:
    try:
        return update_user_settings(current_user["username"], payload.model_dump(exclude_unset=True))
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=translate_error(str(exc))) from exc


@app.get("/api/drafts")
def conversation_draft(conversation_id: str, current_user: dict = Depends(current_user_from_token)) -> dict:
    return get_conversation_draft(current_user["username"], conversation_id)


@app.put("/api/drafts")
def put_conversation_draft(payload: ConversationDraftUpdate, current_user: dict = Depends(current_user_from_token)) -> dict:
    return save_conversation_draft(current_user["username"], payload.conversation_id, payload.content)


@app.post("/api/screenshot-notices")
async def screenshot_notice(payload: ScreenshotNoticeCreate, current_user: dict = Depends(current_user_from_token)) -> dict:
    notice = record_screenshot_notice(current_user["username"], payload.conversation_id, payload.target)
    event = {"type": "screenshot_notice", **notice}
    if payload.conversation_id.startswith("group:"):
        try:
            group_id = int(payload.conversation_id.split(":", 1)[1])
            for member in list_group_members(group_id):
                if member["username"] != current_user["username"]:
                    await manager.send_to_user(member["username"], event)
        except ValueError:
            pass
    elif payload.target:
        await manager.send_to_user(payload.target, event)
    return notice


@app.get("/api/search")
def search(username: str, q: str, limit: int = 20, current_user: dict = Depends(current_user_from_token)) -> dict:
    require_self_or_admin(username, current_user)
    result = search_im(username, q, limit)
    result["members"] = [with_online_status(member) for member in result.get("members", [])]
    return result


@app.get("/api/org/company")
def org_company(_: dict = Depends(current_user_from_token)) -> dict:
    return get_company_settings()


@app.get("/api/org/tree")
def org_tree(_: dict = Depends(current_user_from_token)) -> list[dict]:
    return with_org_online_status(list_department_tree())


@app.put("/api/admin/org/company")
def admin_update_company(payload: CompanySettingsUpdate, current_user: dict = Depends(require_super_admin)) -> dict:
    try:
        item = update_company_settings(payload.name, payload.description)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=translate_error(str(exc))) from exc
    record_operation(current_user["username"], "update_company", "company", payload.name)
    return item


@app.get("/api/admin/org/company")
def admin_company(_: dict = Depends(require_admin)) -> dict:
    return get_company_settings()


@app.get("/api/admin/org/departments")
def admin_departments(_: dict = Depends(require_admin)) -> list[dict]:
    return list_departments_flat()


@app.get("/api/admin/org/tree")
def admin_org_tree(_: dict = Depends(require_admin)) -> list[dict]:
    return with_org_online_status(list_department_tree())


@app.post("/api/admin/org/departments")
def admin_create_department(payload: DepartmentCreate, current_user: dict = Depends(require_super_admin)) -> dict:
    try:
        item = create_department(payload.name, payload.parent_id, payload.sort_order, payload.description)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=translate_error(str(exc))) from exc
    record_operation(current_user["username"], "create_department", str(item["id"]), item["name"])
    return item


@app.patch("/api/admin/org/departments/{department_id}")
def admin_update_department(department_id: int, payload: DepartmentUpdate, current_user: dict = Depends(require_super_admin)) -> dict:
    try:
        item = update_department(department_id, payload.model_dump(exclude_unset=True))
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=translate_error(str(exc))) from exc
    if not item:
        raise HTTPException(status_code=404, detail=translate_error("department not found"))
    record_operation(current_user["username"], "update_department", str(department_id), str(payload.model_dump(exclude_unset=True)))
    return item


@app.delete("/api/admin/org/departments/{department_id}")
def admin_delete_department(department_id: int, current_user: dict = Depends(require_super_admin)) -> dict:
    deleted = delete_department(department_id)
    record_operation(current_user["username"], "delete_department", str(department_id), f"deleted={deleted}")
    return {"deleted": deleted}


@app.post("/api/admin/org/departments/{department_id}/members")
def admin_assign_department_member(department_id: int, payload: DepartmentMemberAssign, current_user: dict = Depends(require_super_admin)) -> dict:
    try:
        member = assign_user_department(department_id, payload.username, payload.position)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=translate_error(str(exc))) from exc
    record_operation(current_user["username"], "assign_department_member", str(department_id), payload.username)
    return with_online_status(member)


@app.delete("/api/admin/org/departments/{department_id}/members/{username}")
def admin_remove_department_member(department_id: int, username: str, current_user: dict = Depends(require_super_admin)) -> dict:
    deleted = remove_user_department(department_id, username)
    record_operation(current_user["username"], "remove_department_member", str(department_id), f"{username}; deleted={deleted}")
    return {"deleted": deleted}


@app.post("/api/groups")
def group_create(payload: GroupCreate, current_user: dict = Depends(current_user_from_token)) -> dict:
    try:
        group = create_group(current_user["username"], payload.name, payload.member_usernames, payload.announcement)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=translate_error(str(exc))) from exc
    return group


@app.get("/api/groups")
def groups(current_user: dict = Depends(current_user_from_token)) -> list[dict]:
    return list_user_groups(current_user["username"])


@app.get("/api/groups/{group_id}/members")
def group_members(group_id: int, current_user: dict = Depends(current_user_from_token)) -> list[dict]:
    if not any(item["id"] == group_id for item in list_user_groups(current_user["username"])) and current_user.get("role") != "admin":
        raise HTTPException(status_code=403, detail=translate_error("group member only"))
    return [with_online_status(member) for member in list_group_members(group_id)]


@app.patch("/api/groups/{group_id}")
def group_update(group_id: int, payload: GroupUpdate, current_user: dict = Depends(current_user_from_token)) -> dict:
    try:
        group = update_group(group_id, current_user["username"], payload.name, payload.announcement)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=translate_error(str(exc))) from exc
    if not group:
        raise HTTPException(status_code=404, detail=translate_error("group not found"))
    return group


@app.post("/api/groups/{group_id}/members")
def group_add_members(group_id: int, payload: GroupMembersAdd, current_user: dict = Depends(current_user_from_token)) -> dict:
    try:
        return add_group_members(group_id, current_user["username"], payload.usernames)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=translate_error(str(exc))) from exc


@app.delete("/api/groups/{group_id}/members/by-username/{username}")
def group_remove_member(group_id: int, username: str, current_user: dict = Depends(current_user_from_token)) -> dict:
    try:
        deleted = remove_group_member(group_id, current_user["username"], username)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=translate_error(str(exc))) from exc
    return {"deleted": deleted}


@app.post("/api/groups/{group_id}/owner")
def group_transfer_owner(group_id: int, payload: GroupOwnerTransfer, current_user: dict = Depends(current_user_from_token)) -> dict:
    try:
        return transfer_group_owner(group_id, current_user["username"], payload.username)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=translate_error(str(exc))) from exc


@app.patch("/api/groups/{group_id}/members/me")
def group_update_my_nickname(group_id: int, payload: GroupNicknameUpdate, current_user: dict = Depends(current_user_from_token)) -> dict:
    try:
        return update_group_nickname(group_id, current_user["username"], payload.nickname)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=translate_error(str(exc))) from exc


@app.delete("/api/groups/{group_id}/members/me")
def group_exit(group_id: int, current_user: dict = Depends(current_user_from_token)) -> dict:
    try:
        deleted = exit_group(group_id, current_user["username"])
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=translate_error(str(exc))) from exc
    return {"deleted": deleted}


@app.get("/api/groups/{group_id}/messages")
def group_messages(group_id: int, limit: int = 100, before_id: int | None = None, current_user: dict = Depends(current_user_from_token)) -> list[dict]:
    try:
        items = list_group_messages(group_id, current_user["username"], min(max(limit, 1), 200), before_id)
        if items:
            mark_group_read(group_id, current_user["username"], int(items[-1]["id"]))
        return items
    except ValueError as exc:
        raise HTTPException(status_code=403, detail=translate_error(str(exc))) from exc


@app.post("/api/groups/{group_id}/read")
def group_mark_read(group_id: int, message_id: int | None = None, current_user: dict = Depends(current_user_from_token)) -> dict:
    try:
        return mark_group_read(group_id, current_user["username"], message_id)
    except ValueError as exc:
        raise HTTPException(status_code=403, detail=translate_error(str(exc))) from exc


@app.get("/api/groups/{group_id}/messages/{message_id}/read-members")
def group_message_read_members(group_id: int, message_id: int, current_user: dict = Depends(current_user_from_token)) -> dict:
    if not any(item["id"] == group_id for item in list_user_groups(current_user["username"])) and current_user.get("role") != "admin":
        raise HTTPException(status_code=403, detail=translate_error("group member only"))
    return group_read_members(group_id, message_id)


@app.get("/api/admin/groups")
def admin_groups(limit: int = 100, _: dict = Depends(require_admin)) -> list[dict]:
    return admin_list_groups(min(max(limit, 1), 500))


@app.delete("/api/admin/groups/{group_id}")
def admin_dissolve_group(group_id: int, current_user: dict = Depends(require_super_admin)) -> dict:
    dissolved = dissolve_group(group_id)
    record_operation(current_user["username"], "dissolve_group", str(group_id), f"dissolved={dissolved}")
    return {"dissolved": dissolved}


@app.post("/api/attachments")
async def upload_attachment(file: UploadFile = File(...), current_user: dict = Depends(current_user_from_token)) -> dict:
    if not file.filename:
        raise HTTPException(status_code=400, detail="文件名不能为空")
    try:
        category = upload_category(file.filename, file.content_type or "application/octet-stream")
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    data = await file.read()
    size = len(data)
    if size <= 0:
        raise HTTPException(status_code=400, detail="不能上传空文件")
    category_limit = UPLOAD_LIMITS.get(category, MAX_UPLOAD_BYTES)
    if size > category_limit:
        raise HTTPException(status_code=400, detail=f"{category_text(category)}不能超过 {category_limit // 1024 // 1024}MB")

    ATTACHMENT_DIR.mkdir(parents=True, exist_ok=True)
    suffix = Path(file.filename).suffix.lower()
    stored_name = f"{uuid4().hex}{suffix}"
    storage_path = ATTACHMENT_DIR / stored_name
    storage_path.write_bytes(data)
    return create_attachment(
        original_name=file.filename,
        stored_name=stored_name,
        mime_type=file.content_type or "application/octet-stream",
        size=size,
        category=category,
        storage_path=str(storage_path),
        uploader=current_user["username"],
    )


@app.get("/api/attachments/{attachment_id}/download")
def download_attachment(attachment_id: int) -> FileResponse:
    attachment = get_attachment(attachment_id)
    if not attachment:
        raise HTTPException(status_code=404, detail="附件不存在")
    path = Path(attachment["storage_path"])
    if not path.exists():
        raise HTTPException(status_code=404, detail="附件文件不存在")
    record_attachment_download(attachment_id)
    return FileResponse(
        path,
        media_type=attachment["mime_type"],
        filename=attachment["original_name"],
    )


@app.get("/api/messages")
def messages(me: str, peer: str, limit: int = 100, before_id: int | None = None, current_user: dict = Depends(current_user_from_token)) -> list[dict]:
    require_self_or_admin(me, current_user)
    return list_conversation(me.strip(), peer.strip(), min(max(limit, 1), 200), before_id)


@app.patch("/api/messages/{message_id}")
async def patch_message(message_id: int, payload: MessageEdit, current_user: dict = Depends(current_user_from_token)) -> dict:
    try:
        updated = edit_message(message_id, current_user["username"], payload.content)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=translate_error(str(exc))) from exc
    if not updated:
        raise HTTPException(status_code=404, detail="消息不存在")
    event = {"type": "message_update", **updated}
    await manager.send_to_user(updated["sender"], event)
    if updated["receiver"] != updated["sender"]:
        await manager.send_to_user(updated["receiver"], event)
    return updated


@app.post("/api/messages/{message_id}/recall")
async def recall_message_api(message_id: int, current_user: dict = Depends(current_user_from_token)) -> dict:
    try:
        updated = recall_message(message_id, current_user["username"], current_user.get("role") == "admin")
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=translate_error(str(exc))) from exc
    if not updated:
        raise HTTPException(status_code=404, detail="消息不存在")
    event = {"type": "message_recall", **updated}
    await manager.send_to_user(updated["sender"], event)
    if updated["receiver"] != updated["sender"]:
        await manager.send_to_user(updated["receiver"], event)
    return updated


@app.post("/api/messages/{message_id}/forward")
def forward_message_api(message_id: int, payload: MessageForward, current_user: dict = Depends(current_user_from_token)) -> list[dict]:
    try:
        return forward_message(current_user["username"], message_id, payload.targets)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=translate_error(str(exc))) from exc


@app.post("/api/messages/{message_id}/favorite")
def favorite_message_api(message_id: int, payload: MessageFavoriteCreate, current_user: dict = Depends(current_user_from_token)) -> dict:
    try:
        return favorite_message(current_user["username"], message_id, payload.note)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=translate_error(str(exc))) from exc


@app.post("/api/messages/{message_id}/reaction")
async def reaction_message_api(message_id: int, payload: MessageReactionToggle, current_user: dict = Depends(current_user_from_token)) -> dict:
    try:
        result = toggle_message_reaction(message_id, current_user["username"], payload.emoji)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=translate_error(str(exc))) from exc
    message = result["message"]
    event = {"type": "message_reaction", **message}
    if str(message["conversation_id"]).startswith("group:"):
        group_id = int(str(message["conversation_id"]).split(":", 1)[1])
        for member in list_group_members(group_id):
            await manager.send_to_user(member["username"], event)
    else:
        await manager.send_to_user(message["sender"], event)
        if message["receiver"] != message["sender"]:
            await manager.send_to_user(message["receiver"], event)
    return result


@app.get("/api/message-favorites")
def message_favorites(limit: int = 100, current_user: dict = Depends(current_user_from_token)) -> list[dict]:
    return list_message_favorites(current_user["username"], min(max(limit, 1), 200))


@app.get("/api/admin/message-audits")
def admin_message_audits(message_id: int | None = None, limit: int = 100, _: dict = Depends(require_admin)) -> list[dict]:
    return list_message_audits(message_id, min(max(limit, 1), 500))


@app.post("/api/messages/read")
def read_messages(username: str, peer: str, current_user: dict = Depends(current_user_from_token)) -> dict:
    require_self_or_admin(username, current_user)
    return mark_conversation_read(username, peer)


@app.delete("/api/messages")
def clear_messages(username: str, peer: str, current_user: dict = Depends(current_user_from_token)) -> dict:
    require_self_or_admin(username, current_user)
    return clear_conversation(username, peer)


@app.get("/api/admin/overview")
def admin_dashboard(_: dict = Depends(require_admin)) -> dict:
    overview = admin_overview()
    overview["online_users"] = len(manager.online_users())
    return overview


@app.get("/api/admin/trends")
def admin_dashboard_trends(days: int = 7, _: dict = Depends(require_admin)) -> list[dict]:
    return admin_trends(days)


@app.get("/api/admin/system-configs")
def admin_system_configs(_: dict = Depends(require_admin)) -> list[dict]:
    return list_system_configs()


@app.patch("/api/admin/system-configs/{key}")
def admin_update_system_config(key: str, payload: SystemConfigUpdate, current_user: dict = Depends(require_super_admin)) -> dict:
    try:
        return update_system_config(key, payload.value, current_user["username"])
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=translate_error(str(exc))) from exc


@app.get("/api/admin/users")
def admin_users(_: dict = Depends(require_admin)) -> list[dict]:
    return [with_online_status(user) for user in list_users()]


@app.get("/api/admin/online-users")
def admin_online_users(_: dict = Depends(require_admin)) -> list[str]:
    return sorted(manager.online_users())


@app.get("/api/admin/messages")
def admin_messages(
    limit: int = 100,
    keyword: str = "",
    username: str = "",
    msg_type: str = "",
    date_from: str = "",
    date_to: str = "",
    _: dict = Depends(require_admin),
) -> list[dict]:
    return admin_list_messages(min(max(limit, 1), 500), keyword, username, msg_type, date_from, date_to)


@app.get("/api/admin/friend-requests")
def admin_friend_requests(limit: int = 100, _: dict = Depends(require_admin)) -> list[dict]:
    return admin_list_friend_requests(min(max(limit, 1), 500))


@app.get("/api/admin/friendships")
def admin_friendships(limit: int = 100, _: dict = Depends(require_admin)) -> list[dict]:
    return admin_list_friendships(min(max(limit, 1), 500))


@app.delete("/api/admin/friendships/{friendship_id}")
def admin_delete_friendship(friendship_id: int, current_user: dict = Depends(require_super_admin)) -> dict:
    deleted = remove_friendship_by_id(friendship_id)
    record_operation(current_user["username"], "delete_friendship", str(friendship_id), f"deleted={deleted}")
    return {"deleted": deleted}


@app.get("/api/admin/attachments")
def admin_attachments(
    limit: int = 100,
    category: str | None = None,
    uploader: str | None = None,
    date_from: str | None = None,
    date_to: str | None = None,
    _: dict = Depends(require_admin),
) -> list[dict]:
    return admin_list_attachments(min(max(limit, 1), 500), category, uploader, date_from, date_to)


@app.get("/api/admin/attachment-download-logs")
def admin_attachment_download_logs(limit: int = 100, _: dict = Depends(require_admin)) -> list[dict]:
    return admin_list_attachment_download_logs(min(max(limit, 1), 500))


@app.get("/api/admin/upload-policy")
def admin_upload_policy(_: dict = Depends(require_admin)) -> dict:
    return {
        "allowed_suffixes": sorted(ALLOWED_FILE_SUFFIXES),
        "max_upload_bytes": MAX_UPLOAD_BYTES,
        "limits": UPLOAD_LIMITS,
    }


@app.get("/api/admin/sensitive-words")
def admin_sensitive_words(limit: int = 200, _: dict = Depends(require_admin)) -> list[dict]:
    return list_sensitive_words(min(max(limit, 1), 500))


@app.post("/api/admin/sensitive-words")
def admin_create_sensitive_word(payload: SensitiveWordCreate, current_user: dict = Depends(require_super_admin)) -> dict:
    try:
        item = create_sensitive_word(payload.word, current_user["username"], payload.enabled)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=translate_error(str(exc))) from exc
    record_operation(current_user["username"], "create_sensitive_word", payload.word, f"enabled={payload.enabled}")
    return item


@app.patch("/api/admin/sensitive-words/{word_id}")
def admin_update_sensitive_word(word_id: int, payload: SensitiveWordUpdate, current_user: dict = Depends(require_super_admin)) -> dict:
    try:
        item = update_sensitive_word(word_id, payload.enabled, payload.word)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=translate_error(str(exc))) from exc
    if not item:
        raise HTTPException(status_code=404, detail="敏感词不存在")
    record_operation(current_user["username"], "update_sensitive_word", str(word_id), str(payload.model_dump(exclude_unset=True)))
    return item


@app.delete("/api/admin/sensitive-words/{word_id}")
def admin_delete_sensitive_word(word_id: int, current_user: dict = Depends(require_super_admin)) -> dict:
    deleted = delete_sensitive_word(word_id)
    record_operation(current_user["username"], "delete_sensitive_word", str(word_id), f"deleted={deleted}")
    return {"deleted": deleted}


@app.get("/api/admin/operation-logs")
def admin_operation_logs(limit: int = 100, _: dict = Depends(require_admin)) -> list[dict]:
    return list_operation_logs(min(max(limit, 1), 500))


@app.websocket("/ws/{username}")
async def websocket_endpoint(websocket: WebSocket, username: str, token: str | None = None) -> None:
    username = username.strip()
    if not username:
        await websocket.close(code=1008, reason="username is required")
        return

    if not token:
        await websocket.close(code=1008, reason="token is required")
        return
    try:
        payload = decode_token(token)
    except ValueError:
        await websocket.close(code=1008, reason="invalid token")
        return
    if payload.get("sub") != username:
        await websocket.close(code=1008, reason="token username mismatch")
        return

    user = get_user(username)
    if not user:
        await websocket.close(code=1008, reason="user not registered")
        return
    if user.get("disabled"):
        await websocket.close(code=1008, reason="user disabled")
        return

    await manager.connect(username, websocket)
    await websocket.send_json({"type": "system", "event": "connected", "username": username})

    try:
        while True:
            raw_message = await websocket.receive_json()
            if raw_message.get("type") == "ping":
                await websocket.send_json({"type": "pong"})
                continue
            if raw_message.get("type") == "typing":
                receiver = str(raw_message.get("receiver", "")).strip()
                if receiver and get_user(receiver):
                    await manager.send_to_user(
                        receiver,
                        {"type": "typing", "sender": username, "receiver": receiver},
                    )
                continue
            if raw_message.get("type") == "group_chat":
                try:
                    group_id = int(raw_message.get("group_id"))
                except (TypeError, ValueError):
                    await websocket.send_json(ErrorMessage(message="群聊参数不正确").model_dump())
                    continue
                content = str(raw_message.get("content", "")).strip()
                msg_type = str(raw_message.get("msg_type", "text")).strip() or "text"
                attachment_ids = raw_message.get("attachment_ids") or []
                if not content:
                    await websocket.send_json(ErrorMessage(message="消息内容不能为空").model_dump())
                    continue
                blocked_word = match_sensitive_word(content)
                if blocked_word:
                    await websocket.send_json(ErrorMessage(message=f"消息包含敏感词：{blocked_word}").model_dump())
                    continue
                try:
                    saved = save_group_message(group_id, username, content, msg_type, attachment_ids)
                    members = list_group_members(group_id)
                except ValueError as exc:
                    await websocket.send_json(ErrorMessage(message=translate_error(str(exc))).model_dump())
                    continue
                outgoing = {"type": "group_chat", **saved}
                await websocket.send_json({"type": "ack", **saved})
                for member in members:
                    if member["username"] != username:
                        await manager.send_to_user(member["username"], outgoing)
                continue

            try:
                incoming = ChatMessageIn.model_validate(raw_message)
            except ValidationError:
                await websocket.send_json(ErrorMessage(message=translate_error("Invalid chat message")).model_dump())
                continue

            receiver = incoming.receiver.strip()
            if not get_user(receiver):
                await websocket.send_json(ErrorMessage(message=translate_error("receiver not found")).model_dump())
                continue
            if is_blocked_between(username, receiver):
                await websocket.send_json(ErrorMessage(message=translate_error("message blocked")).model_dump())
                continue
            blocked_word = match_sensitive_word(incoming.content)
            if blocked_word:
                await websocket.send_json(ErrorMessage(message=f"消息包含敏感词：{blocked_word}").model_dump())
                continue
            delivered = manager.is_online(receiver)
            try:
                saved = save_message(
                    sender=username,
                    receiver=receiver,
                    content=incoming.content,
                    delivered=delivered,
                    msg_type=incoming.msg_type,
                    attachment_ids=incoming.attachment_ids,
                    burn_after_read=incoming.burn_after_read,
                )
            except ValueError as exc:
                await websocket.send_json(ErrorMessage(message=translate_error(str(exc))).model_dump())
                continue
            outgoing = {"type": "chat", **saved}

            await websocket.send_json({"type": "ack", **saved})
            if receiver != username:
                await manager.send_to_user(receiver, outgoing)
    except WebSocketDisconnect:
        manager.disconnect(username, websocket)
    except Exception:
        manager.disconnect(username, websocket)
        raise
