import sqlite3
from contextlib import contextmanager
from datetime import datetime, timedelta, timezone
from typing import Iterator

from app.config import DB_PATH
from app.auth import hash_password, validate_username, verify_password


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


@contextmanager
def get_conn() -> Iterator[sqlite3.Connection]:
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    try:
        yield conn
        conn.commit()
    finally:
        conn.close()


def _columns(conn: sqlite3.Connection, table: str) -> set[str]:
    rows = conn.execute(f"PRAGMA table_info({table})").fetchall()
    return {row["name"] for row in rows}


def _add_column(conn: sqlite3.Connection, table: str, column: str, definition: str) -> None:
    if column not in _columns(conn, table):
        conn.execute(f"ALTER TABLE {table} ADD COLUMN {column} {definition}")


def normalize_username(username: str) -> str:
    return username.strip()


def pair_key(user_a: str, user_b: str) -> str:
    left, right = sorted([normalize_username(user_a), normalize_username(user_b)])
    return f"{left}:{right}"


def init_db() -> None:
    with get_conn() as conn:
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                username TEXT NOT NULL UNIQUE,
                display_name TEXT NOT NULL,
                avatar TEXT NOT NULL,
                password_hash TEXT NOT NULL DEFAULT '',
                password_salt TEXT NOT NULL DEFAULT '',
                role TEXT NOT NULL DEFAULT 'user',
                email TEXT,
                phone TEXT,
                signature TEXT,
                disabled INTEGER NOT NULL DEFAULT 0,
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL
            )
            """
        )
        _add_column(conn, "users", "email", "TEXT")
        _add_column(conn, "users", "phone", "TEXT")
        _add_column(conn, "users", "signature", "TEXT")
        _add_column(conn, "users", "password_hash", "TEXT NOT NULL DEFAULT ''")
        _add_column(conn, "users", "password_salt", "TEXT NOT NULL DEFAULT ''")
        _add_column(conn, "users", "role", "TEXT NOT NULL DEFAULT 'user'")
        _add_column(conn, "users", "disabled", "INTEGER NOT NULL DEFAULT 0")
        _add_column(conn, "users", "updated_at", "TEXT")
        conn.execute("UPDATE users SET updated_at = created_at WHERE updated_at IS NULL")

        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS messages (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                conversation_id TEXT,
                sender TEXT NOT NULL,
                receiver TEXT NOT NULL,
                content TEXT NOT NULL,
                msg_type TEXT NOT NULL DEFAULT 'text',
                created_at TEXT NOT NULL,
                delivered INTEGER NOT NULL DEFAULT 0,
                read_at TEXT,
                status TEXT NOT NULL DEFAULT 'sent',
                edited_at TEXT,
                recalled_at TEXT,
                burn_after_read INTEGER NOT NULL DEFAULT 0,
                burned_at TEXT
            )
            """
        )
        _add_column(conn, "messages", "conversation_id", "TEXT")
        _add_column(conn, "messages", "msg_type", "TEXT NOT NULL DEFAULT 'text'")
        _add_column(conn, "messages", "read_at", "TEXT")
        _add_column(conn, "messages", "status", "TEXT NOT NULL DEFAULT 'sent'")
        _add_column(conn, "messages", "edited_at", "TEXT")
        _add_column(conn, "messages", "recalled_at", "TEXT")
        _add_column(conn, "messages", "burn_after_read", "INTEGER NOT NULL DEFAULT 0")
        _add_column(conn, "messages", "burned_at", "TEXT")

        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS message_favorites (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                username TEXT NOT NULL,
                message_id INTEGER NOT NULL,
                note TEXT NOT NULL DEFAULT '',
                created_at TEXT NOT NULL,
                UNIQUE(username, message_id)
            )
            """
        )
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS message_reactions (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                message_id INTEGER NOT NULL,
                username TEXT NOT NULL,
                emoji TEXT NOT NULL DEFAULT '👍',
                created_at TEXT NOT NULL,
                UNIQUE(message_id, username, emoji)
            )
            """
        )
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS message_audits (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                message_id INTEGER NOT NULL,
                operator TEXT NOT NULL,
                action TEXT NOT NULL,
                old_content TEXT,
                new_content TEXT,
                created_at TEXT NOT NULL
            )
            """
        )

        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS attachments (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                original_name TEXT NOT NULL,
                stored_name TEXT NOT NULL,
                mime_type TEXT NOT NULL,
                size INTEGER NOT NULL,
                category TEXT NOT NULL,
                storage_path TEXT NOT NULL,
                uploader TEXT NOT NULL,
                message_id INTEGER,
                created_at TEXT NOT NULL
            )
            """
        )
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS attachment_download_logs (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                attachment_id INTEGER NOT NULL,
                downloader TEXT NOT NULL DEFAULT 'anonymous',
                original_name TEXT NOT NULL DEFAULT '',
                created_at TEXT NOT NULL
            )
            """
        )

        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS message_attachments (
                message_id INTEGER NOT NULL,
                attachment_id INTEGER NOT NULL,
                PRIMARY KEY (message_id, attachment_id)
            )
            """
        )

        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS sensitive_words (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                word TEXT NOT NULL UNIQUE,
                enabled INTEGER NOT NULL DEFAULT 1,
                created_by TEXT NOT NULL,
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL
            )
            """
        )

        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS operation_logs (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                operator TEXT NOT NULL,
                action TEXT NOT NULL,
                target TEXT NOT NULL DEFAULT '',
                detail TEXT NOT NULL DEFAULT '',
                created_at TEXT NOT NULL
            )
            """
        )

        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS login_logs (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                username TEXT NOT NULL,
                role TEXT NOT NULL DEFAULT 'user',
                created_at TEXT NOT NULL
            )
            """
        )

        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS user_settings (
                username TEXT PRIMARY KEY,
                notification_enabled INTEGER NOT NULL DEFAULT 1,
                message_preview_enabled INTEGER NOT NULL DEFAULT 1,
                mention_notify_enabled INTEGER NOT NULL DEFAULT 1,
                quiet_hours_enabled INTEGER NOT NULL DEFAULT 0,
                quiet_hours_start TEXT NOT NULL DEFAULT '22:00',
                quiet_hours_end TEXT NOT NULL DEFAULT '08:00',
                theme TEXT NOT NULL DEFAULT 'system',
                language TEXT NOT NULL DEFAULT 'zh-CN',
                font_size TEXT NOT NULL DEFAULT 'standard',
                chat_background TEXT NOT NULL DEFAULT '',
                updated_at TEXT NOT NULL,
                FOREIGN KEY(username) REFERENCES users(username) ON DELETE CASCADE
            )
            """
        )
        _add_column(conn, "user_settings", "message_preview_enabled", "INTEGER NOT NULL DEFAULT 1")
        _add_column(conn, "user_settings", "mention_notify_enabled", "INTEGER NOT NULL DEFAULT 1")
        _add_column(conn, "user_settings", "quiet_hours_enabled", "INTEGER NOT NULL DEFAULT 0")
        _add_column(conn, "user_settings", "quiet_hours_start", "TEXT NOT NULL DEFAULT '22:00'")
        _add_column(conn, "user_settings", "quiet_hours_end", "TEXT NOT NULL DEFAULT '08:00'")
        _add_column(conn, "user_settings", "theme", "TEXT NOT NULL DEFAULT 'system'")
        _add_column(conn, "user_settings", "language", "TEXT NOT NULL DEFAULT 'zh-CN'")
        _add_column(conn, "user_settings", "font_size", "TEXT NOT NULL DEFAULT 'standard'")
        _add_column(conn, "user_settings", "chat_background", "TEXT NOT NULL DEFAULT ''")
        _add_column(conn, "user_settings", "updated_at", "TEXT")
        conn.execute("UPDATE user_settings SET updated_at = ? WHERE updated_at IS NULL", (now_iso(),))

        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS screenshot_logs (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                reporter TEXT NOT NULL,
                conversation_id TEXT NOT NULL,
                target TEXT NOT NULL DEFAULT '',
                created_at TEXT NOT NULL
            )
            """
        )

        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS conversation_drafts (
                username TEXT NOT NULL,
                conversation_id TEXT NOT NULL,
                content TEXT NOT NULL DEFAULT '',
                updated_at TEXT NOT NULL,
                PRIMARY KEY (username, conversation_id)
            )
            """
        )

        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS system_configs (
                key TEXT PRIMARY KEY,
                value TEXT NOT NULL,
                description TEXT NOT NULL DEFAULT '',
                updated_at TEXT NOT NULL
            )
            """
        )

        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS company_settings (
                id INTEGER PRIMARY KEY CHECK (id = 1),
                name TEXT NOT NULL DEFAULT '默认企业',
                description TEXT NOT NULL DEFAULT '',
                updated_at TEXT NOT NULL
            )
            """
        )

        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS departments (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                parent_id INTEGER,
                sort_order INTEGER NOT NULL DEFAULT 0,
                description TEXT NOT NULL DEFAULT '',
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL,
                FOREIGN KEY(parent_id) REFERENCES departments(id) ON DELETE SET NULL
            )
            """
        )

        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS employee_departments (
                department_id INTEGER NOT NULL,
                username TEXT NOT NULL,
                position TEXT NOT NULL DEFAULT '',
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL,
                PRIMARY KEY (department_id, username),
                FOREIGN KEY(department_id) REFERENCES departments(id) ON DELETE CASCADE,
                FOREIGN KEY(username) REFERENCES users(username) ON DELETE CASCADE
            )
            """
        )

        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS groups (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                owner TEXT NOT NULL,
                announcement TEXT NOT NULL DEFAULT '',
                dissolved INTEGER NOT NULL DEFAULT 0,
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL
            )
            """
        )

        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS group_members (
                group_id INTEGER NOT NULL,
                username TEXT NOT NULL,
                role TEXT NOT NULL DEFAULT 'member',
                nickname TEXT NOT NULL DEFAULT '',
                last_read_message_id INTEGER NOT NULL DEFAULT 0,
                joined_at TEXT NOT NULL,
                PRIMARY KEY (group_id, username),
                FOREIGN KEY(group_id) REFERENCES groups(id) ON DELETE CASCADE,
                FOREIGN KEY(username) REFERENCES users(username) ON DELETE CASCADE
            )
            """
        )
        _add_column(conn, "group_members", "nickname", "TEXT NOT NULL DEFAULT ''")
        _add_column(conn, "group_members", "last_read_message_id", "INTEGER NOT NULL DEFAULT 0")

        conn.execute(
            """
            UPDATE messages
            SET conversation_id =
                CASE
                    WHEN sender < receiver THEN sender || ':' || receiver
                    ELSE receiver || ':' || sender
                END
            WHERE conversation_id IS NULL
            """
        )

        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS friend_requests (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                from_user TEXT NOT NULL,
                to_user TEXT NOT NULL,
                message TEXT NOT NULL DEFAULT '',
                status TEXT NOT NULL DEFAULT 'pending',
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL,
                UNIQUE(from_user, to_user)
            )
            """
        )

        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS friendships (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_a TEXT NOT NULL,
                user_b TEXT NOT NULL,
                pair_key TEXT NOT NULL UNIQUE,
                remark_a TEXT,
                remark_b TEXT,
                source TEXT NOT NULL DEFAULT 'friend_request',
                created_at TEXT NOT NULL
            )
            """
        )
        _add_column(conn, "friendships", "remark_a", "TEXT")
        _add_column(conn, "friendships", "remark_b", "TEXT")
        _add_column(conn, "friendships", "source", "TEXT NOT NULL DEFAULT 'friend_request'")

        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS blacklists (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                owner TEXT NOT NULL,
                target TEXT NOT NULL,
                reason TEXT NOT NULL DEFAULT '',
                created_at TEXT NOT NULL,
                UNIQUE(owner, target)
            )
            """
        )

        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS conversations (
                id TEXT PRIMARY KEY,
                type TEXT NOT NULL DEFAULT 'single',
                user_a TEXT NOT NULL,
                user_b TEXT NOT NULL,
                last_message_id INTEGER,
                unread_a INTEGER NOT NULL DEFAULT 0,
                unread_b INTEGER NOT NULL DEFAULT 0,
                pinned_a INTEGER NOT NULL DEFAULT 0,
                pinned_b INTEGER NOT NULL DEFAULT 0,
                muted_a INTEGER NOT NULL DEFAULT 0,
                muted_b INTEGER NOT NULL DEFAULT 0,
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL
            )
            """
        )

        conn.execute("CREATE INDEX IF NOT EXISTS idx_messages_conversation ON messages(conversation_id, id)")
        conn.execute("CREATE INDEX IF NOT EXISTS idx_messages_sender_receiver ON messages(sender, receiver)")
        conn.execute("CREATE INDEX IF NOT EXISTS idx_friend_requests_to_user ON friend_requests(to_user, status)")
        conn.execute("CREATE INDEX IF NOT EXISTS idx_blacklists_owner ON blacklists(owner)")
        conn.execute("CREATE INDEX IF NOT EXISTS idx_attachments_uploader ON attachments(uploader, id)")
        conn.execute("CREATE INDEX IF NOT EXISTS idx_attachments_message ON attachments(message_id)")
        conn.execute("CREATE INDEX IF NOT EXISTS idx_attachment_download_logs_created ON attachment_download_logs(created_at)")
        conn.execute("CREATE INDEX IF NOT EXISTS idx_operation_logs_created ON operation_logs(created_at)")
        conn.execute("CREATE INDEX IF NOT EXISTS idx_login_logs_created ON login_logs(created_at)")
        conn.execute("CREATE INDEX IF NOT EXISTS idx_message_reactions_message ON message_reactions(message_id)")
        conn.execute("CREATE INDEX IF NOT EXISTS idx_screenshot_logs_created ON screenshot_logs(created_at)")
        conn.execute("CREATE INDEX IF NOT EXISTS idx_departments_parent ON departments(parent_id, sort_order)")
        conn.execute("CREATE INDEX IF NOT EXISTS idx_employee_departments_user ON employee_departments(username)")
        conn.execute("CREATE INDEX IF NOT EXISTS idx_group_members_user ON group_members(username)")
        conn.execute("CREATE INDEX IF NOT EXISTS idx_messages_group ON messages(conversation_id, id)")
        conn.execute(
            """
            INSERT OR IGNORE INTO company_settings (id, name, description, updated_at)
            VALUES (1, '默认企业', '', ?)
            """,
            (now_iso(),),
        )
        for key, value, description in [
            ("allow_message_forward", "true", "是否允许消息转发"),
            ("allow_screenshot_notice", "true", "是否记录截屏通知"),
            ("max_group_members", "200", "默认群成员上限"),
            ("upload_original_image", "true", "是否允许原图发送"),
        ]:
            conn.execute(
                "INSERT OR IGNORE INTO system_configs (key, value, description, updated_at) VALUES (?, ?, ?, ?)",
                (key, value, description, now_iso()),
            )

    ensure_admin_user()


def user_to_public(row: sqlite3.Row | dict, status: str = "offline") -> dict:
    return {
        "id": row["username"],
        "username": row["username"],
        "name": row["display_name"],
        "avatar": row["avatar"],
        "email": row["email"] if "email" in row.keys() else None,
        "phone": row["phone"] if "phone" in row.keys() else None,
        "signature": row["signature"] if "signature" in row.keys() else None,
        "role": row["role"] if "role" in row.keys() else "user",
        "status": status,
        "disabled": bool(row["disabled"]) if "disabled" in row.keys() else False,
        "created_at": row["created_at"],
        "updated_at": row["updated_at"] if "updated_at" in row.keys() else row["created_at"],
    }


def _settings_to_public(row: sqlite3.Row) -> dict:
    return {
        "username": row["username"],
        "notification_enabled": bool(row["notification_enabled"]),
        "message_preview_enabled": bool(row["message_preview_enabled"]),
        "mention_notify_enabled": bool(row["mention_notify_enabled"]),
        "quiet_hours_enabled": bool(row["quiet_hours_enabled"]),
        "quiet_hours_start": row["quiet_hours_start"],
        "quiet_hours_end": row["quiet_hours_end"],
        "theme": row["theme"],
        "language": row["language"],
        "font_size": row["font_size"],
        "chat_background": row["chat_background"],
        "updated_at": row["updated_at"],
    }


def _ensure_user_settings(conn: sqlite3.Connection, username: str) -> None:
    timestamp = now_iso()
    conn.execute(
        """
        INSERT OR IGNORE INTO user_settings (username, updated_at)
        VALUES (?, ?)
        """,
        (normalize_username(username), timestamp),
    )


def get_user_settings(username: str) -> dict:
    clean_username = normalize_username(username)
    with get_conn() as conn:
        _ensure_user_settings(conn, clean_username)
        row = conn.execute("SELECT * FROM user_settings WHERE username = ?", (clean_username,)).fetchone()
    if not row:
        raise ValueError("user settings not found")
    return _settings_to_public(row)


def update_user_settings(username: str, fields: dict) -> dict:
    allowed = {
        "notification_enabled",
        "message_preview_enabled",
        "mention_notify_enabled",
        "quiet_hours_enabled",
        "quiet_hours_start",
        "quiet_hours_end",
        "theme",
        "language",
        "font_size",
        "chat_background",
    }
    updates = {key: value for key, value in fields.items() if key in allowed and value is not None}
    if "theme" in updates and updates["theme"] not in {"system", "light", "dark"}:
        raise ValueError("invalid theme")
    if "language" in updates and updates["language"] not in {"zh-CN", "en-US"}:
        raise ValueError("invalid language")
    if "font_size" in updates and updates["font_size"] not in {"small", "standard", "large"}:
        raise ValueError("invalid font size")
    for key in ("quiet_hours_start", "quiet_hours_end"):
        if key in updates:
            value = str(updates[key])
            if len(value) != 5 or value[2] != ":":
                raise ValueError("invalid quiet hours")
            updates[key] = value
    for key in ("notification_enabled", "message_preview_enabled", "mention_notify_enabled", "quiet_hours_enabled"):
        if key in updates:
            updates[key] = 1 if updates[key] else 0

    clean_username = normalize_username(username)
    with get_conn() as conn:
        _ensure_user_settings(conn, clean_username)
        if updates:
            updates["updated_at"] = now_iso()
            assignments = ", ".join(f"{key} = ?" for key in updates)
            conn.execute(
                f"UPDATE user_settings SET {assignments} WHERE username = ?",
                (*updates.values(), clean_username),
            )
        row = conn.execute("SELECT * FROM user_settings WHERE username = ?", (clean_username,)).fetchone()
    if not row:
        raise ValueError("user settings not found")
    return _settings_to_public(row)


def save_conversation_draft(username: str, conversation_id: str, content: str) -> dict:
    user = normalize_username(username)
    timestamp = now_iso()
    with get_conn() as conn:
        conn.execute(
            """
            INSERT INTO conversation_drafts (username, conversation_id, content, updated_at)
            VALUES (?, ?, ?, ?)
            ON CONFLICT(username, conversation_id)
            DO UPDATE SET content = excluded.content, updated_at = excluded.updated_at
            """,
            (user, conversation_id.strip(), content[:2000], timestamp),
        )
    return {"username": user, "conversation_id": conversation_id.strip(), "content": content[:2000], "updated_at": timestamp}


def get_conversation_draft(username: str, conversation_id: str) -> dict:
    user = normalize_username(username)
    with get_conn() as conn:
        row = conn.execute(
            "SELECT * FROM conversation_drafts WHERE username = ? AND conversation_id = ?",
            (user, conversation_id.strip()),
        ).fetchone()
    if not row:
        return {"username": user, "conversation_id": conversation_id.strip(), "content": "", "updated_at": ""}
    return dict(row)


def record_screenshot_notice(reporter: str, conversation_id: str, target: str = "") -> dict:
    timestamp = now_iso()
    with get_conn() as conn:
        cursor = conn.execute(
            """
            INSERT INTO screenshot_logs (reporter, conversation_id, target, created_at)
            VALUES (?, ?, ?, ?)
            """,
            (normalize_username(reporter), conversation_id.strip(), target.strip(), timestamp),
        )
        row_id = cursor.lastrowid
    return {
        "id": row_id,
        "reporter": normalize_username(reporter),
        "conversation_id": conversation_id.strip(),
        "target": target.strip(),
        "created_at": timestamp,
    }


def create_user(username: str, password: str, display_name: str | None = None, role: str = "user") -> dict:
    clean_username = validate_username(username)
    avatar = f"https://api.dicebear.com/7.x/initials/svg?seed={clean_username}"
    password_hash, password_salt = hash_password(password)
    created_at = now_iso()
    with get_conn() as conn:
        try:
            conn.execute(
                """
                INSERT INTO users (
                    username, display_name, avatar, password_hash, password_salt,
                    role, created_at, updated_at
                )
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    clean_username,
                    display_name or clean_username,
                    avatar,
                    password_hash,
                    password_salt,
                    role,
                    created_at,
                    created_at,
                ),
            )
        except sqlite3.IntegrityError as exc:
            raise ValueError("username already exists") from exc
    user = get_user(clean_username)
    if not user:
        raise ValueError("failed to create user")
    return user


def ensure_admin_user() -> None:
    password_hash, password_salt = hash_password("123456")
    timestamp = now_iso()
    avatar = "https://api.dicebear.com/7.x/initials/svg?seed=admin"
    with get_conn() as conn:
        row = conn.execute("SELECT username FROM users WHERE username = 'admin'").fetchone()
        if row:
            conn.execute(
                """
                UPDATE users
                SET password_hash = ?, password_salt = ?, role = 'admin',
                    disabled = 0, updated_at = ?
                WHERE username = 'admin'
                """,
                (password_hash, password_salt, timestamp),
            )
            return
        conn.execute(
            """
            INSERT INTO users (
                username, display_name, avatar, password_hash, password_salt,
                role, disabled, created_at, updated_at
            )
            VALUES ('admin', 'Administrator', ?, ?, ?, 'admin', 0, ?, ?)
            """,
            (avatar, password_hash, password_salt, timestamp, timestamp),
        )


def authenticate_user(username: str, password: str) -> dict | None:
    with get_conn() as conn:
        row = conn.execute(
            """
            SELECT username, display_name, avatar, email, phone, signature, role,
                   disabled, created_at, updated_at, password_hash, password_salt
            FROM users
            WHERE username = ?
            """,
            (normalize_username(username),),
        ).fetchone()
    if not row or not row["password_hash"] or not verify_password(password, row["password_hash"], row["password_salt"]):
        return None
    return user_to_public(row)


def get_user(username: str) -> dict | None:
    with get_conn() as conn:
        row = conn.execute(
            """
            SELECT username, display_name, avatar, email, phone, signature, role, disabled, created_at, updated_at
            FROM users
            WHERE username = ?
            """,
            (normalize_username(username),),
        ).fetchone()
        return user_to_public(row) if row else None


def list_users() -> list[dict]:
    with get_conn() as conn:
        rows = conn.execute(
            """
            SELECT username, display_name, avatar, email, phone, signature, role, disabled, created_at, updated_at
            FROM users
            ORDER BY username ASC
            """
        ).fetchall()
        return [user_to_public(row) for row in rows]


def update_user_profile(username: str, fields: dict) -> dict | None:
    allowed = {"display_name", "email", "phone", "signature", "avatar", "disabled"}
    updates = {key: value for key, value in fields.items() if key in allowed and value is not None}
    if not updates:
        return get_user(username)

    updates["updated_at"] = now_iso()
    assignments = ", ".join(f"{key} = ?" for key in updates)
    values = list(updates.values()) + [normalize_username(username)]
    with get_conn() as conn:
        conn.execute(f"UPDATE users SET {assignments} WHERE username = ?", values)
    return get_user(username)


def reset_user_password(username: str, password: str) -> dict | None:
    password_hash, password_salt = hash_password(password)
    timestamp = now_iso()
    with get_conn() as conn:
        cursor = conn.execute(
            """
            UPDATE users
            SET password_hash = ?, password_salt = ?, updated_at = ?
            WHERE username = ?
            """,
            (password_hash, password_salt, timestamp, normalize_username(username)),
        )
    return get_user(username) if cursor.rowcount else None


def record_login(username: str, role: str = "user") -> None:
    with get_conn() as conn:
        conn.execute(
            "INSERT INTO login_logs (username, role, created_at) VALUES (?, ?, ?)",
            (normalize_username(username), role, now_iso()),
        )


def record_operation(operator: str, action: str, target: str = "", detail: str = "") -> dict:
    timestamp = now_iso()
    with get_conn() as conn:
        cursor = conn.execute(
            """
            INSERT INTO operation_logs (operator, action, target, detail, created_at)
            VALUES (?, ?, ?, ?, ?)
            """,
            (normalize_username(operator), action, target, detail, timestamp),
        )
        row = conn.execute("SELECT * FROM operation_logs WHERE id = ?", (cursor.lastrowid,)).fetchone()
    return dict(row)


def list_operation_logs(limit: int = 100) -> list[dict]:
    with get_conn() as conn:
        rows = conn.execute(
            "SELECT * FROM operation_logs ORDER BY id DESC LIMIT ?",
            (limit,),
        ).fetchall()
    return [dict(row) for row in rows]


def get_company_settings() -> dict:
    with get_conn() as conn:
        row = conn.execute("SELECT * FROM company_settings WHERE id = 1").fetchone()
    return dict(row) if row else {"id": 1, "name": "默认企业", "description": "", "updated_at": now_iso()}


def update_company_settings(name: str, description: str = "") -> dict:
    timestamp = now_iso()
    clean_name = name.strip()
    if not clean_name:
        raise ValueError("company name empty")
    with get_conn() as conn:
        conn.execute(
            """
            INSERT INTO company_settings (id, name, description, updated_at)
            VALUES (1, ?, ?, ?)
            ON CONFLICT(id) DO UPDATE SET
                name = excluded.name,
                description = excluded.description,
                updated_at = excluded.updated_at
            """,
            (clean_name, description.strip(), timestamp),
        )
        row = conn.execute("SELECT * FROM company_settings WHERE id = 1").fetchone()
    return dict(row)


def department_to_public(row: sqlite3.Row | dict, members: list[dict] | None = None, children: list[dict] | None = None) -> dict:
    return {
        "id": row["id"],
        "name": row["name"],
        "parent_id": row["parent_id"],
        "sort_order": row["sort_order"],
        "description": row["description"],
        "created_at": row["created_at"],
        "updated_at": row["updated_at"],
        "members": members or [],
        "children": children or [],
    }


def list_departments_flat() -> list[dict]:
    with get_conn() as conn:
        rows = conn.execute(
            """
            SELECT *
            FROM departments
            ORDER BY parent_id IS NOT NULL, parent_id, sort_order, id
            """
        ).fetchall()
    return [department_to_public(row) for row in rows]


def create_department(name: str, parent_id: int | None = None, sort_order: int = 0, description: str = "") -> dict:
    clean_name = name.strip()
    if not clean_name:
        raise ValueError("department name empty")
    timestamp = now_iso()
    with get_conn() as conn:
        if parent_id is not None:
            parent = conn.execute("SELECT id FROM departments WHERE id = ?", (parent_id,)).fetchone()
            if not parent:
                raise ValueError("department not found")
        cursor = conn.execute(
            """
            INSERT INTO departments (name, parent_id, sort_order, description, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?)
            """,
            (clean_name, parent_id, sort_order, description.strip(), timestamp, timestamp),
        )
        row = conn.execute("SELECT * FROM departments WHERE id = ?", (cursor.lastrowid,)).fetchone()
    return department_to_public(row)


def update_department(department_id: int, fields: dict) -> dict | None:
    allowed = {"name", "parent_id", "sort_order", "description"}
    updates = {key: value for key, value in fields.items() if key in allowed}
    if "name" in updates:
        updates["name"] = str(updates["name"]).strip()
        if not updates["name"]:
            raise ValueError("department name empty")
    if not updates:
        return get_department(department_id)
    if updates.get("parent_id") == department_id:
        raise ValueError("department parent invalid")
    updates["updated_at"] = now_iso()
    assignments = ", ".join(f"{key} = ?" for key in updates)
    values = list(updates.values()) + [department_id]
    with get_conn() as conn:
        if "parent_id" in updates and updates["parent_id"] is not None:
            parent = conn.execute("SELECT id FROM departments WHERE id = ?", (updates["parent_id"],)).fetchone()
            if not parent:
                raise ValueError("department not found")
        cursor = conn.execute(f"UPDATE departments SET {assignments} WHERE id = ?", values)
    return get_department(department_id) if cursor.rowcount else None


def get_department(department_id: int) -> dict | None:
    with get_conn() as conn:
        row = conn.execute("SELECT * FROM departments WHERE id = ?", (department_id,)).fetchone()
    return department_to_public(row) if row else None


def delete_department(department_id: int) -> bool:
    with get_conn() as conn:
        cursor = conn.execute("DELETE FROM departments WHERE id = ?", (department_id,))
    return cursor.rowcount > 0


def assign_user_department(department_id: int, username: str, position: str = "") -> dict:
    user = normalize_username(username)
    timestamp = now_iso()
    with get_conn() as conn:
        department = conn.execute("SELECT id FROM departments WHERE id = ?", (department_id,)).fetchone()
        if not department:
            raise ValueError("department not found")
        existing_user = conn.execute("SELECT username FROM users WHERE username = ? AND disabled = 0", (user,)).fetchone()
        if not existing_user:
            raise ValueError("user not found")
        conn.execute(
            """
            INSERT INTO employee_departments (department_id, username, position, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?)
            ON CONFLICT(department_id, username) DO UPDATE SET
                position = excluded.position,
                updated_at = excluded.updated_at
            """,
            (department_id, user, position.strip(), timestamp, timestamp),
        )
    return get_department_member(department_id, user)


def remove_user_department(department_id: int, username: str) -> bool:
    with get_conn() as conn:
        cursor = conn.execute(
            "DELETE FROM employee_departments WHERE department_id = ? AND username = ?",
            (department_id, normalize_username(username)),
        )
    return cursor.rowcount > 0


def get_department_member(department_id: int, username: str) -> dict | None:
    with get_conn() as conn:
        row = conn.execute(
            """
            SELECT ed.department_id, ed.position, ed.created_at, ed.updated_at,
                   u.username, u.display_name, u.avatar, u.email, u.phone, u.signature,
                   u.role, u.disabled, u.created_at AS user_created_at, u.updated_at AS user_updated_at
            FROM employee_departments ed
            JOIN users u ON u.username = ed.username
            WHERE ed.department_id = ? AND ed.username = ?
            """,
            (department_id, normalize_username(username)),
        ).fetchone()
    if not row:
        return None
    user = user_to_public(
        {
            "username": row["username"],
            "display_name": row["display_name"],
            "avatar": row["avatar"],
            "email": row["email"],
            "phone": row["phone"],
            "signature": row["signature"],
            "role": row["role"],
            "disabled": row["disabled"],
            "created_at": row["user_created_at"],
            "updated_at": row["user_updated_at"],
            "keys": lambda: {
                "username",
                "display_name",
                "avatar",
                "email",
                "phone",
                "signature",
                "role",
                "disabled",
                "created_at",
                "updated_at",
            },
        }
    )
    return {**user, "department_id": row["department_id"], "position": row["position"], "member_updated_at": row["updated_at"]}


def list_department_members() -> dict[int, list[dict]]:
    with get_conn() as conn:
        rows = conn.execute(
            """
            SELECT ed.department_id, ed.position, ed.updated_at,
                   u.username, u.display_name, u.avatar, u.email, u.phone, u.signature,
                   u.role, u.disabled, u.created_at AS user_created_at, u.updated_at AS user_updated_at
            FROM employee_departments ed
            JOIN users u ON u.username = ed.username
            WHERE u.disabled = 0
            ORDER BY ed.department_id, u.display_name
            """
        ).fetchall()
    grouped: dict[int, list[dict]] = {}
    for row in rows:
        user = user_to_public(
            {
                "username": row["username"],
                "display_name": row["display_name"],
                "avatar": row["avatar"],
                "email": row["email"],
                "phone": row["phone"],
                "signature": row["signature"],
                "role": row["role"],
                "disabled": row["disabled"],
                "created_at": row["user_created_at"],
                "updated_at": row["user_updated_at"],
                "keys": lambda: {
                    "username",
                    "display_name",
                    "avatar",
                    "email",
                    "phone",
                    "signature",
                    "role",
                    "disabled",
                    "created_at",
                    "updated_at",
                },
            }
        )
        grouped.setdefault(row["department_id"], []).append({**user, "department_id": row["department_id"], "position": row["position"]})
    return grouped


def list_department_tree() -> list[dict]:
    departments = list_departments_flat()
    members = list_department_members()
    nodes = {item["id"]: {**item, "members": members.get(item["id"], []), "children": []} for item in departments}
    roots: list[dict] = []
    for item in nodes.values():
        parent_id = item["parent_id"]
        if parent_id and parent_id in nodes:
            nodes[parent_id]["children"].append(item)
        else:
            roots.append(item)
    return roots


def search_departments_and_members(query: str, limit: int = 20) -> dict:
    keyword = query.strip()
    if not keyword:
        return {"departments": [], "members": []}
    like = f"%{keyword}%"
    capped_limit = min(max(limit, 1), 50)
    with get_conn() as conn:
        departments = conn.execute(
            """
            SELECT *
            FROM departments
            WHERE name LIKE ? OR description LIKE ?
            ORDER BY sort_order, id
            LIMIT ?
            """,
            (like, like, capped_limit),
        ).fetchall()
        members = conn.execute(
            """
            SELECT ed.department_id, ed.position,
                   d.name AS department_name,
                   u.username, u.display_name, u.avatar, u.email, u.phone, u.signature,
                   u.role, u.disabled, u.created_at, u.updated_at
            FROM employee_departments ed
            JOIN users u ON u.username = ed.username
            JOIN departments d ON d.id = ed.department_id
            WHERE u.disabled = 0
              AND (u.username LIKE ? OR u.display_name LIKE ? OR ed.position LIKE ? OR d.name LIKE ?)
            ORDER BY d.sort_order, u.display_name
            LIMIT ?
            """,
            (like, like, like, like, capped_limit),
        ).fetchall()
    return {
        "departments": [department_to_public(row) for row in departments],
        "members": [
            {
                **user_to_public(row),
                "department_id": row["department_id"],
                "department_name": row["department_name"],
                "position": row["position"],
            }
            for row in members
        ],
    }


def create_friend_request(from_user: str, to_user: str, message: str = "") -> dict:
    sender = normalize_username(from_user)
    receiver = normalize_username(to_user)
    if sender == receiver:
        raise ValueError("cannot add yourself")

    sender_user = get_user(sender)
    receiver_user = get_user(receiver)
    if not sender_user or not receiver_user:
        raise ValueError("user not found")
    if receiver_user.get("role") == "admin":
        raise ValueError("不能添加管理员账号为好友")
    if are_friends(sender, receiver):
        raise ValueError("already friends")
    if is_blocked_between(sender, receiver):
        raise ValueError("friend request blocked")

    timestamp = now_iso()
    with get_conn() as conn:
        existing = conn.execute(
            "SELECT * FROM friend_requests WHERE from_user = ? AND to_user = ?",
            (sender, receiver),
        ).fetchone()
        if existing:
            conn.execute(
                """
                UPDATE friend_requests
                SET message = ?, status = 'pending', updated_at = ?
                WHERE id = ?
                """,
                (message, timestamp, existing["id"]),
            )
            request_id = existing["id"]
        else:
            cursor = conn.execute(
                """
                INSERT INTO friend_requests (from_user, to_user, message, status, created_at, updated_at)
                VALUES (?, ?, ?, 'pending', ?, ?)
                """,
                (sender, receiver, message, timestamp, timestamp),
            )
            request_id = cursor.lastrowid
        row = conn.execute("SELECT * FROM friend_requests WHERE id = ?", (request_id,)).fetchone()
        return dict(row)


def list_friend_requests(username: str, box: str = "inbox") -> list[dict]:
    user = normalize_username(username)
    column = "to_user" if box == "inbox" else "from_user"
    with get_conn() as conn:
        rows = conn.execute(
            f"SELECT * FROM friend_requests WHERE {column} = ? ORDER BY id DESC",
            (user,),
        ).fetchall()
        return [dict(row) for row in rows]


def respond_friend_request(request_id: int, action: str, operator: str | None = None, remark: str | None = None) -> dict | None:
    if action not in {"accept", "reject"}:
        raise ValueError("invalid action")

    timestamp = now_iso()
    next_status = "accepted" if action == "accept" else "rejected"
    with get_conn() as conn:
        row = conn.execute("SELECT * FROM friend_requests WHERE id = ?", (request_id,)).fetchone()
        if not row:
            return None

        conn.execute(
            "UPDATE friend_requests SET status = ?, updated_at = ? WHERE id = ?",
            (next_status, timestamp, request_id),
        )

        if action == "accept":
            user_a, user_b = sorted([row["from_user"], row["to_user"]])
            remark_a = remark if operator == user_a else None
            remark_b = remark if operator == user_b else None
            conn.execute(
                """
                INSERT OR IGNORE INTO friendships (user_a, user_b, pair_key, remark_a, remark_b, source, created_at)
                VALUES (?, ?, ?, ?, ?, 'friend_request', ?)
                """,
                (user_a, user_b, pair_key(user_a, user_b), remark_a, remark_b, timestamp),
            )
            if remark:
                column = "remark_a" if operator == user_a else "remark_b"
                conn.execute(
                    f"UPDATE friendships SET {column} = ? WHERE pair_key = ?",
                    (remark, pair_key(user_a, user_b)),
                )
            ensure_conversation(conn, row["from_user"], row["to_user"], timestamp)

        updated = conn.execute("SELECT * FROM friend_requests WHERE id = ?", (request_id,)).fetchone()
        return dict(updated)


def are_friends(user_a: str, user_b: str) -> bool:
    with get_conn() as conn:
        row = conn.execute(
            "SELECT id FROM friendships WHERE pair_key = ?",
            (pair_key(user_a, user_b),),
        ).fetchone()
        return row is not None


def list_friends(username: str) -> list[dict]:
    user = normalize_username(username)
    with get_conn() as conn:
        rows = conn.execute(
            """
            SELECT u.username, u.display_name, u.avatar, u.email, u.phone, u.signature,
                   u.role, u.disabled, u.created_at, u.updated_at,
                   f.user_a, f.user_b, f.remark_a, f.remark_b, f.source,
                   f.created_at AS friend_created_at,
                   b.id AS blacklist_id
            FROM friendships f
            JOIN users u
              ON u.username = CASE WHEN f.user_a = ? THEN f.user_b ELSE f.user_a END
            LEFT JOIN blacklists b
              ON b.owner = ? AND b.target = u.username
            WHERE f.user_a = ? OR f.user_b = ?
            ORDER BY COALESCE(CASE WHEN f.user_a = ? THEN f.remark_a ELSE f.remark_b END, u.display_name) ASC
            """,
            (user, user, user, user, user),
        ).fetchall()
        result = []
        for row in rows:
            item = user_to_public(row)
            item["remark"] = row["remark_a"] if row["user_a"] == user else row["remark_b"]
            item["display_name"] = row["display_name"]
            item["friend_created_at"] = row["friend_created_at"]
            item["friend_source"] = row["source"]
            item["is_blocked"] = row["blacklist_id"] is not None
            result.append(item)
        return result


def update_friend_remark(username: str, friend_username: str, remark: str | None) -> dict | None:
    user = normalize_username(username)
    friend = normalize_username(friend_username)
    key = pair_key(user, friend)
    row = None
    with get_conn() as conn:
        friendship = conn.execute("SELECT user_a, user_b FROM friendships WHERE pair_key = ?", (key,)).fetchone()
        if not friendship:
            return None
        column = "remark_a" if friendship["user_a"] == user else "remark_b"
        conn.execute(f"UPDATE friendships SET {column} = ? WHERE pair_key = ?", (remark or None, key))
        row = conn.execute(
            """
            SELECT u.username, u.display_name, u.avatar, u.email, u.phone, u.signature,
                   u.role, u.disabled, u.created_at, u.updated_at,
                   f.user_a, f.user_b, f.remark_a, f.remark_b, f.source,
                   f.created_at AS friend_created_at,
                   b.id AS blacklist_id
            FROM friendships f
            JOIN users u ON u.username = CASE WHEN f.user_a = ? THEN f.user_b ELSE f.user_a END
            LEFT JOIN blacklists b ON b.owner = ? AND b.target = u.username
            WHERE f.pair_key = ?
            """,
            (user, user, key),
        ).fetchone()
    if not row:
        return None
    item = user_to_public(row)
    item["remark"] = row["remark_a"] if row["user_a"] == user else row["remark_b"]
    item["display_name"] = row["display_name"]
    item["friend_created_at"] = row["friend_created_at"]
    item["friend_source"] = row["source"]
    item["is_blocked"] = row["blacklist_id"] is not None
    return item


def remove_friend(username: str, friend_username: str) -> bool:
    key = pair_key(username, friend_username)
    with get_conn() as conn:
        cursor = conn.execute("DELETE FROM friendships WHERE pair_key = ?", (key,))
        return cursor.rowcount > 0


def remove_friendship_by_id(friendship_id: int) -> bool:
    with get_conn() as conn:
        cursor = conn.execute("DELETE FROM friendships WHERE id = ?", (friendship_id,))
        return cursor.rowcount > 0


def create_sensitive_word(word: str, operator: str, enabled: bool = True) -> dict:
    clean = word.strip()
    if not clean:
        raise ValueError("sensitive word empty")
    timestamp = now_iso()
    with get_conn() as conn:
        try:
            cursor = conn.execute(
                """
                INSERT INTO sensitive_words (word, enabled, created_by, created_at, updated_at)
                VALUES (?, ?, ?, ?, ?)
                """,
                (clean, 1 if enabled else 0, normalize_username(operator), timestamp, timestamp),
            )
        except sqlite3.IntegrityError as exc:
            raise ValueError("sensitive word exists") from exc
        row = conn.execute("SELECT * FROM sensitive_words WHERE id = ?", (cursor.lastrowid,)).fetchone()
    return dict(row)


def update_sensitive_word(word_id: int, enabled: bool | None = None, word: str | None = None) -> dict | None:
    updates = {"updated_at": now_iso()}
    if enabled is not None:
        updates["enabled"] = 1 if enabled else 0
    if word is not None:
        clean = word.strip()
        if not clean:
            raise ValueError("sensitive word empty")
        updates["word"] = clean
    assignments = ", ".join(f"{key} = ?" for key in updates)
    values = list(updates.values()) + [word_id]
    with get_conn() as conn:
        cursor = conn.execute(f"UPDATE sensitive_words SET {assignments} WHERE id = ?", values)
        if not cursor.rowcount:
            return None
        row = conn.execute("SELECT * FROM sensitive_words WHERE id = ?", (word_id,)).fetchone()
    return dict(row)


def delete_sensitive_word(word_id: int) -> bool:
    with get_conn() as conn:
        cursor = conn.execute("DELETE FROM sensitive_words WHERE id = ?", (word_id,))
        return cursor.rowcount > 0


def list_sensitive_words(limit: int = 200) -> list[dict]:
    with get_conn() as conn:
        rows = conn.execute(
            "SELECT * FROM sensitive_words ORDER BY id DESC LIMIT ?",
            (limit,),
        ).fetchall()
    return [dict(row) for row in rows]


def match_sensitive_word(content: str) -> str | None:
    text = (content or "").lower()
    if not text:
        return None
    with get_conn() as conn:
        rows = conn.execute("SELECT word FROM sensitive_words WHERE enabled = 1").fetchall()
    for row in rows:
        word = row["word"]
        if word and word.lower() in text:
            return word
    return None


def add_blacklist(username: str, target: str, reason: str = "") -> dict:
    owner = normalize_username(username)
    blocked = normalize_username(target)
    if owner == blocked:
        raise ValueError("cannot block yourself")
    if not get_user(blocked):
        raise ValueError("user not found")
    timestamp = now_iso()
    with get_conn() as conn:
        conn.execute(
            """
            INSERT INTO blacklists (owner, target, reason, created_at)
            VALUES (?, ?, ?, ?)
            ON CONFLICT(owner, target) DO UPDATE SET reason = excluded.reason
            """,
            (owner, blocked, reason, timestamp),
        )
    return {"owner": owner, "target": blocked, "reason": reason, "created_at": timestamp}


def remove_blacklist(username: str, target: str) -> bool:
    owner = normalize_username(username)
    blocked = normalize_username(target)
    with get_conn() as conn:
        cursor = conn.execute("DELETE FROM blacklists WHERE owner = ? AND target = ?", (owner, blocked))
        return cursor.rowcount > 0


def list_blacklist(username: str) -> list[dict]:
    owner = normalize_username(username)
    with get_conn() as conn:
        rows = conn.execute(
            """
            SELECT b.id, b.owner, b.target, b.reason, b.created_at,
                   u.username, u.display_name, u.avatar, u.email, u.phone, u.signature,
                   u.role, u.disabled, u.created_at AS user_created_at, u.updated_at
            FROM blacklists b
            JOIN users u ON u.username = b.target
            WHERE b.owner = ?
            ORDER BY b.id DESC
            """,
            (owner,),
        ).fetchall()
    result = []
    for row in rows:
        item = user_to_public(
            {
                "username": row["username"],
                "display_name": row["display_name"],
                "avatar": row["avatar"],
                "email": row["email"],
                "phone": row["phone"],
                "signature": row["signature"],
                "role": row["role"],
                "disabled": row["disabled"],
                "created_at": row["user_created_at"],
                "updated_at": row["updated_at"],
                "keys": lambda: {
                    "username",
                    "display_name",
                    "avatar",
                    "email",
                    "phone",
                    "signature",
                    "role",
                    "disabled",
                    "created_at",
                    "updated_at",
                },
            }
        )
        item["blocked_at"] = row["created_at"]
        item["reason"] = row["reason"]
        result.append(item)
    return result


def is_blocked_between(user_a: str, user_b: str) -> bool:
    left = normalize_username(user_a)
    right = normalize_username(user_b)
    with get_conn() as conn:
        row = conn.execute(
            """
            SELECT id FROM blacklists
            WHERE (owner = ? AND target = ?) OR (owner = ? AND target = ?)
            """,
            (left, right, right, left),
        ).fetchone()
        return row is not None


def ensure_conversation(conn: sqlite3.Connection, user_a: str, user_b: str, timestamp: str | None = None) -> str:
    conversation_id = pair_key(user_a, user_b)
    left, right = conversation_id.split(":", 1)
    now = timestamp or now_iso()
    conn.execute(
        """
        INSERT OR IGNORE INTO conversations (id, type, user_a, user_b, created_at, updated_at)
        VALUES (?, 'single', ?, ?, ?, ?)
        """,
        (conversation_id, left, right, now, now),
    )
    return conversation_id


def attachment_to_public(row: sqlite3.Row | dict) -> dict:
    return {
        "id": row["id"],
        "original_name": row["original_name"],
        "mime_type": row["mime_type"],
        "size": row["size"],
        "category": row["category"],
        "url": f"/api/attachments/{row['id']}/download",
        "uploader": row["uploader"],
        "message_id": row["message_id"],
        "created_at": row["created_at"],
    }


def create_attachment(
    original_name: str,
    stored_name: str,
    mime_type: str,
    size: int,
    category: str,
    storage_path: str,
    uploader: str,
) -> dict:
    timestamp = now_iso()
    with get_conn() as conn:
        cursor = conn.execute(
            """
            INSERT INTO attachments (
                original_name, stored_name, mime_type, size, category,
                storage_path, uploader, created_at
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (original_name, stored_name, mime_type, size, category, storage_path, normalize_username(uploader), timestamp),
        )
        row = conn.execute("SELECT * FROM attachments WHERE id = ?", (cursor.lastrowid,)).fetchone()
    return attachment_to_public(row)


def get_attachment(attachment_id: int) -> dict | None:
    with get_conn() as conn:
        row = conn.execute("SELECT * FROM attachments WHERE id = ?", (attachment_id,)).fetchone()
    return dict(row) if row else None


def record_attachment_download(attachment_id: int, downloader: str = "anonymous") -> dict:
    attachment = get_attachment(attachment_id)
    if not attachment:
        raise ValueError("attachment not found")
    timestamp = now_iso()
    with get_conn() as conn:
        cursor = conn.execute(
            """
            INSERT INTO attachment_download_logs (attachment_id, downloader, original_name, created_at)
            VALUES (?, ?, ?, ?)
            """,
            (attachment_id, normalize_username(downloader) if downloader != "anonymous" else "anonymous", attachment["original_name"], timestamp),
        )
        row = conn.execute("SELECT * FROM attachment_download_logs WHERE id = ?", (cursor.lastrowid,)).fetchone()
    return dict(row)


def list_message_attachments(message_id: int) -> list[dict]:
    with get_conn() as conn:
        rows = conn.execute(
            """
            SELECT a.*
            FROM attachments a
            JOIN message_attachments ma ON ma.attachment_id = a.id
            WHERE ma.message_id = ?
            ORDER BY a.id ASC
            """,
            (message_id,),
        ).fetchall()
    return [attachment_to_public(row) for row in rows]


def list_message_attachments_in_conn(conn: sqlite3.Connection, message_id: int) -> list[dict]:
    rows = conn.execute(
        """
        SELECT a.*
        FROM attachments a
        JOIN message_attachments ma ON ma.attachment_id = a.id
        WHERE ma.message_id = ?
        ORDER BY a.id ASC
        """,
        (message_id,),
    ).fetchall()
    return [attachment_to_public(row) for row in rows]


def link_message_attachments(conn: sqlite3.Connection, message_id: int, attachment_ids: list[int], uploader: str) -> None:
    if not attachment_ids:
        return
    rows = conn.execute(
        f"""
        SELECT id, uploader, message_id
        FROM attachments
        WHERE id IN ({",".join("?" for _ in attachment_ids)})
        """,
        attachment_ids,
    ).fetchall()
    found = {row["id"]: row for row in rows}
    for attachment_id in attachment_ids:
        row = found.get(attachment_id)
        if not row:
            raise ValueError("attachment not found")
        if row["uploader"] != normalize_username(uploader):
            raise ValueError("attachment owner mismatch")
        conn.execute(
            "INSERT OR IGNORE INTO message_attachments (message_id, attachment_id) VALUES (?, ?)",
            (message_id, attachment_id),
        )
        conn.execute(
            "UPDATE attachments SET message_id = COALESCE(message_id, ?) WHERE id = ?",
            (message_id, attachment_id),
        )


def save_message(sender: str, receiver: str, content: str, delivered: bool, msg_type: str = "text", attachment_ids: list[int] | None = None, burn_after_read: bool = False) -> dict:
    sender = normalize_username(sender)
    receiver = normalize_username(receiver)
    if is_blocked_between(sender, receiver):
        raise ValueError("message blocked")
    created_at = now_iso()
    with get_conn() as conn:
        conversation_id = ensure_conversation(conn, sender, receiver, created_at)
        cursor = conn.execute(
            """
            INSERT INTO messages (conversation_id, sender, receiver, content, msg_type, created_at, delivered, status, burn_after_read)
            VALUES (?, ?, ?, ?, ?, ?, ?, 'sent', ?)
            """,
            (conversation_id, sender, receiver, content, msg_type, created_at, 1 if delivered else 0, 1 if burn_after_read else 0),
        )
        message_id = cursor.lastrowid
        link_message_attachments(conn, message_id, attachment_ids or [], sender)
        unread_column = "unread_a" if receiver < sender else "unread_b"
        conn.execute(
            f"""
            UPDATE conversations
            SET last_message_id = ?, updated_at = ?, {unread_column} = {unread_column} + 1
            WHERE id = ?
            """,
            (message_id, created_at, conversation_id),
        )
        result = {
            "id": str(message_id),
            "conversation_id": conversation_id,
            "sender": sender,
            "receiver": receiver,
            "content": content,
            "msg_type": msg_type,
            "created_at": created_at,
            "delivered": delivered,
            "read_at": None,
            "status": "sent",
            "edited_at": None,
            "recalled_at": None,
            "burn_after_read": burn_after_read,
            "burned_at": None,
        }
        result["attachments"] = list_message_attachments_in_conn(conn, message_id)
        result["reactions"] = []
        return result


def group_conversation_id(group_id: int) -> str:
    return f"group:{group_id}"


def group_to_public(row: sqlite3.Row | dict, members: list[dict] | None = None) -> dict:
    return {
        "id": row["id"],
        "name": row["name"],
        "owner": row["owner"],
        "announcement": row["announcement"],
        "dissolved": bool(row["dissolved"]),
        "created_at": row["created_at"],
        "updated_at": row["updated_at"],
        "members": members or [],
    }


def list_group_members(group_id: int) -> list[dict]:
    with get_conn() as conn:
        rows = conn.execute(
            """
            SELECT gm.group_id, gm.role, gm.nickname, gm.last_read_message_id, gm.joined_at,
                   u.username, u.display_name, u.avatar, u.email, u.phone, u.signature,
                   u.role AS user_role, u.disabled, u.created_at, u.updated_at
            FROM group_members gm
            JOIN users u ON u.username = gm.username
            WHERE gm.group_id = ?
            ORDER BY gm.role DESC, u.display_name
            """,
            (group_id,),
        ).fetchall()
    members = []
    for row in rows:
        user = user_to_public(
            {
                "username": row["username"],
                "display_name": row["display_name"],
                "avatar": row["avatar"],
                "email": row["email"],
                "phone": row["phone"],
                "signature": row["signature"],
                "role": row["user_role"],
                "disabled": row["disabled"],
                "created_at": row["created_at"],
                "updated_at": row["updated_at"],
                "keys": lambda: {
                    "username", "display_name", "avatar", "email", "phone", "signature",
                    "role", "disabled", "created_at", "updated_at",
                },
            }
        )
        members.append({
            **user,
            "group_role": row["role"],
            "group_nickname": row["nickname"],
            "last_read_message_id": row["last_read_message_id"],
            "joined_at": row["joined_at"],
        })
    return members


def get_group(group_id: int, include_members: bool = True) -> dict | None:
    with get_conn() as conn:
        row = conn.execute("SELECT * FROM groups WHERE id = ?", (group_id,)).fetchone()
    if not row:
        return None
    return group_to_public(row, list_group_members(group_id) if include_members else [])


def is_group_member(group_id: int, username: str) -> bool:
    with get_conn() as conn:
        row = conn.execute(
            "SELECT 1 FROM group_members WHERE group_id = ? AND username = ?",
            (group_id, normalize_username(username)),
        ).fetchone()
    return bool(row)


def is_group_owner(group_id: int, username: str) -> bool:
    with get_conn() as conn:
        row = conn.execute(
            "SELECT 1 FROM groups WHERE id = ? AND owner = ? AND dissolved = 0",
            (group_id, normalize_username(username)),
        ).fetchone()
    return bool(row)


def create_group(owner: str, name: str, member_usernames: list[str], announcement: str = "") -> dict:
    clean_owner = normalize_username(owner)
    clean_name = name.strip()
    if not clean_name:
        raise ValueError("group name empty")
    if not get_user(clean_owner):
        raise ValueError("user not found")
    members = {clean_owner, *(normalize_username(item) for item in member_usernames if item)}
    timestamp = now_iso()
    with get_conn() as conn:
        for username in members:
            if not conn.execute("SELECT username FROM users WHERE username = ? AND disabled = 0", (username,)).fetchone():
                raise ValueError("user not found")
        cursor = conn.execute(
            """
            INSERT INTO groups (name, owner, announcement, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?)
            """,
            (clean_name, clean_owner, announcement.strip(), timestamp, timestamp),
        )
        group_id = cursor.lastrowid
        for username in members:
            role = "owner" if username == clean_owner else "member"
            conn.execute(
                "INSERT INTO group_members (group_id, username, role, joined_at) VALUES (?, ?, ?, ?)",
                (group_id, username, role, timestamp),
            )
        conn.execute(
            """
            INSERT INTO messages (conversation_id, sender, receiver, content, msg_type, created_at, delivered, status)
            VALUES (?, ?, ?, ?, 'system', ?, 1, 'sent')
            """,
            (group_conversation_id(group_id), clean_owner, str(group_id), f"{clean_owner} 创建群聊", timestamp),
        )
    return get_group(group_id)


def list_user_groups(username: str) -> list[dict]:
    user = normalize_username(username)
    with get_conn() as conn:
        rows = conn.execute(
            """
            SELECT g.*
            FROM groups g
            JOIN group_members gm ON gm.group_id = g.id
            WHERE gm.username = ? AND g.dissolved = 0
            ORDER BY g.updated_at DESC
            """,
            (user,),
        ).fetchall()
    return [group_to_public(row, list_group_members(row["id"])) for row in rows]


def update_group(group_id: int, operator: str, name: str | None = None, announcement: str | None = None) -> dict | None:
    group = get_group(group_id, False)
    if not group or group["dissolved"]:
        return None
    if group["owner"] != normalize_username(operator):
        raise ValueError("group owner only")
    updates = {}
    if name is not None:
        clean_name = name.strip()
        if not clean_name:
            raise ValueError("group name empty")
        updates["name"] = clean_name
    if announcement is not None:
        updates["announcement"] = announcement.strip()
    if not updates:
        return get_group(group_id)
    updates["updated_at"] = now_iso()
    assignments = ", ".join(f"{key} = ?" for key in updates)
    with get_conn() as conn:
        conn.execute(f"UPDATE groups SET {assignments} WHERE id = ?", list(updates.values()) + [group_id])
        if "name" in updates:
            conn.execute(
                """
                INSERT INTO messages (conversation_id, sender, receiver, content, msg_type, created_at, delivered, status)
                VALUES (?, ?, ?, ?, 'system', ?, 1, 'sent')
                """,
                (group_conversation_id(group_id), normalize_username(operator), str(group_id), f"群名修改为 {updates['name']}", updates["updated_at"]),
            )
    return get_group(group_id)


def add_group_members(group_id: int, operator: str, usernames: list[str]) -> dict:
    group = get_group(group_id, False)
    if not group or group["dissolved"]:
        raise ValueError("group not found")
    if not is_group_owner(group_id, operator):
        raise ValueError("group owner only")
    members = [normalize_username(item) for item in usernames if item]
    timestamp = now_iso()
    with get_conn() as conn:
        for username in members:
            if not conn.execute("SELECT username FROM users WHERE username = ? AND disabled = 0", (username,)).fetchone():
                raise ValueError("user not found")
            conn.execute(
                "INSERT OR IGNORE INTO group_members (group_id, username, role, joined_at) VALUES (?, ?, 'member', ?)",
                (group_id, username, timestamp),
            )
            conn.execute(
                """
                INSERT INTO messages (conversation_id, sender, receiver, content, msg_type, created_at, delivered, status)
                VALUES (?, ?, ?, ?, 'system', ?, 1, 'sent')
                """,
                (group_conversation_id(group_id), normalize_username(operator), str(group_id), f"{username} 加入群聊", timestamp),
            )
        conn.execute("UPDATE groups SET updated_at = ? WHERE id = ?", (timestamp, group_id))
    return get_group(group_id)


def remove_group_member(group_id: int, operator: str, username: str) -> bool:
    group = get_group(group_id, False)
    if not group or group["dissolved"]:
        raise ValueError("group not found")
    op = normalize_username(operator)
    target = normalize_username(username)
    if not is_group_owner(group_id, op):
        raise ValueError("group owner only")
    if target == group["owner"]:
        raise ValueError("cannot remove group owner")
    timestamp = now_iso()
    with get_conn() as conn:
        cursor = conn.execute("DELETE FROM group_members WHERE group_id = ? AND username = ?", (group_id, target))
        if cursor.rowcount:
            conn.execute(
                """
                INSERT INTO messages (conversation_id, sender, receiver, content, msg_type, created_at, delivered, status)
                VALUES (?, ?, ?, ?, 'system', ?, 1, 'sent')
                """,
                (group_conversation_id(group_id), op, str(group_id), f"{target} 被移出群聊", timestamp),
            )
            conn.execute("UPDATE groups SET updated_at = ? WHERE id = ?", (timestamp, group_id))
    return cursor.rowcount > 0


def transfer_group_owner(group_id: int, operator: str, new_owner: str) -> dict:
    group = get_group(group_id, False)
    if not group or group["dissolved"]:
        raise ValueError("group not found")
    op = normalize_username(operator)
    target = normalize_username(new_owner)
    if group["owner"] != op:
        raise ValueError("group owner only")
    if not is_group_member(group_id, target):
        raise ValueError("group member only")
    timestamp = now_iso()
    with get_conn() as conn:
        conn.execute("UPDATE groups SET owner = ?, updated_at = ? WHERE id = ?", (target, timestamp, group_id))
        conn.execute("UPDATE group_members SET role = 'member' WHERE group_id = ? AND username = ?", (group_id, op))
        conn.execute("UPDATE group_members SET role = 'owner' WHERE group_id = ? AND username = ?", (group_id, target))
        conn.execute(
            """
            INSERT INTO messages (conversation_id, sender, receiver, content, msg_type, created_at, delivered, status)
            VALUES (?, ?, ?, ?, 'system', ?, 1, 'sent')
            """,
            (group_conversation_id(group_id), op, str(group_id), f"群主已转让给 {target}", timestamp),
        )
    return get_group(group_id)


def update_group_nickname(group_id: int, username: str, nickname: str) -> dict:
    user = normalize_username(username)
    if not is_group_member(group_id, user):
        raise ValueError("group member only")
    with get_conn() as conn:
        conn.execute(
            "UPDATE group_members SET nickname = ? WHERE group_id = ? AND username = ?",
            (nickname.strip(), group_id, user),
        )
    group = get_group(group_id)
    return group


def exit_group(group_id: int, username: str) -> bool:
    user = normalize_username(username)
    group = get_group(group_id, False)
    if not group or group["dissolved"]:
        raise ValueError("group not found")
    if group["owner"] == user:
        raise ValueError("owner transfer required")
    timestamp = now_iso()
    with get_conn() as conn:
        cursor = conn.execute("DELETE FROM group_members WHERE group_id = ? AND username = ?", (group_id, user))
        if cursor.rowcount:
            conn.execute(
                """
                INSERT INTO messages (conversation_id, sender, receiver, content, msg_type, created_at, delivered, status)
                VALUES (?, ?, ?, ?, 'system', ?, 1, 'sent')
                """,
                (group_conversation_id(group_id), user, str(group_id), f"{user} 退出群聊", timestamp),
            )
            conn.execute("UPDATE groups SET updated_at = ? WHERE id = ?", (timestamp, group_id))
    return cursor.rowcount > 0


def dissolve_group(group_id: int) -> bool:
    timestamp = now_iso()
    with get_conn() as conn:
        cursor = conn.execute("UPDATE groups SET dissolved = 1, updated_at = ? WHERE id = ?", (timestamp, group_id))
    return cursor.rowcount > 0


def save_group_message(group_id: int, sender: str, content: str, msg_type: str = "text", attachment_ids: list[int] | None = None) -> dict:
    sender = normalize_username(sender)
    group = get_group(group_id, False)
    if not group or group["dissolved"]:
        raise ValueError("group not found")
    if not is_group_member(group_id, sender):
        raise ValueError("group member only")
    created_at = now_iso()
    conversation_id = group_conversation_id(group_id)
    with get_conn() as conn:
        cursor = conn.execute(
            """
            INSERT INTO messages (conversation_id, sender, receiver, content, msg_type, created_at, delivered, status)
            VALUES (?, ?, ?, ?, ?, ?, 1, 'sent')
            """,
            (conversation_id, sender, str(group_id), content, msg_type, created_at),
        )
        message_id = cursor.lastrowid
        link_message_attachments(conn, message_id, attachment_ids or [], sender)
        conn.execute(
            "UPDATE group_members SET last_read_message_id = ? WHERE group_id = ? AND username = ?",
            (message_id, group_id, sender),
        )
        conn.execute("UPDATE groups SET updated_at = ? WHERE id = ?", (created_at, group_id))
        row = conn.execute(
            """
            SELECT id, conversation_id, sender, receiver, content, msg_type, created_at,
                   delivered, read_at, status, edited_at, recalled_at, burn_after_read, burned_at
            FROM messages WHERE id = ?
            """,
            (message_id,),
        ).fetchone()
    item = message_to_public(row)
    item["group_id"] = group_id
    item.update(group_read_stats(group_id, int(item["id"])))
    return item


def mark_group_read(group_id: int, username: str, message_id: int | None = None) -> dict:
    user = normalize_username(username)
    if not is_group_member(group_id, user):
        raise ValueError("group member only")
    if message_id is None:
        with get_conn() as conn:
            row = conn.execute(
                "SELECT COALESCE(MAX(id), 0) AS id FROM messages WHERE conversation_id = ?",
                (group_conversation_id(group_id),),
            ).fetchone()
            message_id = row["id"]
    with get_conn() as conn:
        conn.execute(
            "UPDATE group_members SET last_read_message_id = MAX(last_read_message_id, ?) WHERE group_id = ? AND username = ?",
            (message_id, group_id, user),
        )
    return {"group_id": group_id, "reader": user, "last_read_message_id": message_id}


def group_read_stats(group_id: int, message_id: int) -> dict:
    with get_conn() as conn:
        total = conn.execute("SELECT COUNT(*) AS count FROM group_members WHERE group_id = ?", (group_id,)).fetchone()["count"]
        read_count = conn.execute(
            "SELECT COUNT(*) AS count FROM group_members WHERE group_id = ? AND last_read_message_id >= ?",
            (group_id, message_id),
        ).fetchone()["count"]
    return {"read_count": read_count, "unread_count": max(total - read_count, 0)}


def group_read_members(group_id: int, message_id: int) -> dict:
    with get_conn() as conn:
        rows = conn.execute(
            """
            SELECT gm.last_read_message_id, gm.nickname, gm.role,
                   u.username, u.display_name, u.avatar, u.email, u.phone, u.signature,
                   u.role AS user_role, u.disabled, u.created_at, u.updated_at
            FROM group_members gm
            JOIN users u ON u.username = gm.username
            WHERE gm.group_id = ?
            ORDER BY gm.last_read_message_id DESC, u.display_name
            """,
            (group_id,),
        ).fetchall()
    read = []
    unread = []
    for row in rows:
        user = user_to_public(
            {
                "username": row["username"],
                "display_name": row["display_name"],
                "avatar": row["avatar"],
                "email": row["email"],
                "phone": row["phone"],
                "signature": row["signature"],
                "role": row["user_role"],
                "disabled": row["disabled"],
                "created_at": row["created_at"],
                "updated_at": row["updated_at"],
                "keys": lambda: {
                    "username", "display_name", "avatar", "email", "phone", "signature",
                    "role", "disabled", "created_at", "updated_at",
                },
            }
        )
        item = {
            **user,
            "group_role": row["role"],
            "group_nickname": row["nickname"],
            "last_read_message_id": row["last_read_message_id"],
        }
        if row["last_read_message_id"] >= message_id:
            read.append(item)
        else:
            unread.append(item)
    return {"message_id": str(message_id), "read": read, "unread": unread}


def list_group_messages(group_id: int, username: str, limit: int = 100, before_id: int | None = None) -> list[dict]:
    if not is_group_member(group_id, username):
        raise ValueError("group member only")
    params: list = [group_conversation_id(group_id)]
    before_clause = ""
    if before_id:
        before_clause = "AND id < ?"
        params.append(before_id)
    params.append(limit)
    with get_conn() as conn:
        rows = conn.execute(
            f"""
            SELECT id, conversation_id, sender, receiver, content, msg_type, created_at,
                   delivered, read_at, status, edited_at, recalled_at, burn_after_read, burned_at
            FROM messages
            WHERE conversation_id = ? {before_clause}
            ORDER BY id DESC
            LIMIT ?
            """,
            params,
        ).fetchall()
    result = []
    for row in reversed(rows):
        item = message_to_public(row) | {"group_id": group_id}
        item.update(group_read_stats(group_id, int(item["id"])))
        result.append(item)
    return result


def admin_list_groups(limit: int = 100) -> list[dict]:
    with get_conn() as conn:
        rows = conn.execute("SELECT * FROM groups ORDER BY id DESC LIMIT ?", (limit,)).fetchall()
    return [group_to_public(row, list_group_members(row["id"])) for row in rows]


def message_to_public(row: sqlite3.Row | dict) -> dict:
    item = {
        "id": str(row["id"]),
        "conversation_id": row["conversation_id"],
        "sender": row["sender"],
        "receiver": row["receiver"],
        "content": row["content"],
        "msg_type": row["msg_type"],
        "created_at": row["created_at"],
        "delivered": bool(row["delivered"]),
        "read_at": row["read_at"],
        "status": row["status"],
        "edited_at": row["edited_at"] if "edited_at" in row.keys() else None,
        "recalled_at": row["recalled_at"] if "recalled_at" in row.keys() else None,
        "burn_after_read": bool(row["burn_after_read"]) if "burn_after_read" in row.keys() else False,
        "burned_at": row["burned_at"] if "burned_at" in row.keys() else None,
    }
    item["attachments"] = list_message_attachments(int(row["id"]))
    item["reactions"] = list_message_reactions(int(row["id"]))
    return item


def list_message_reactions(message_id: int) -> list[dict]:
    with get_conn() as conn:
        rows = conn.execute(
            """
            SELECT emoji, COUNT(*) AS count, GROUP_CONCAT(username) AS users
            FROM message_reactions
            WHERE message_id = ?
            GROUP BY emoji
            ORDER BY count DESC, emoji
            """,
            (message_id,),
        ).fetchall()
    return [
        {"emoji": row["emoji"], "count": row["count"], "users": (row["users"] or "").split(",") if row["users"] else []}
        for row in rows
    ]


def toggle_message_reaction(message_id: int, username: str, emoji: str = "👍") -> dict:
    clean_emoji = (emoji or "👍").strip()[:16] or "👍"
    user = normalize_username(username)
    timestamp = now_iso()
    with get_conn() as conn:
        existing = conn.execute(
            "SELECT id FROM message_reactions WHERE message_id = ? AND username = ? AND emoji = ?",
            (message_id, user, clean_emoji),
        ).fetchone()
        if existing:
            conn.execute("DELETE FROM message_reactions WHERE id = ?", (existing["id"],))
            reacted = False
        else:
            conn.execute(
                "INSERT INTO message_reactions (message_id, username, emoji, created_at) VALUES (?, ?, ?, ?)",
                (message_id, user, clean_emoji, timestamp),
            )
            reacted = True
    message = get_message(message_id)
    if not message:
        raise ValueError("message not found")
    return {"reacted": reacted, "message": message}


def list_conversation(user_a: str, user_b: str, limit: int = 100, before_id: int | None = None) -> list[dict]:
    conversation_id = pair_key(user_a, user_b)
    params: list = [conversation_id]
    before_clause = ""
    if before_id:
        before_clause = "AND id < ?"
        params.append(before_id)
    params.append(limit)
    with get_conn() as conn:
        rows = conn.execute(
            f"""
            SELECT id, conversation_id, sender, receiver, content, msg_type, created_at,
                   delivered, read_at, status, edited_at, recalled_at, burn_after_read, burned_at
            FROM messages
            WHERE conversation_id = ? {before_clause}
            ORDER BY id DESC
            LIMIT ?
            """,
            params,
        ).fetchall()
    return [message_to_public(row) for row in reversed(rows)]


def get_message(message_id: int) -> dict | None:
    with get_conn() as conn:
        row = conn.execute(
            """
            SELECT id, conversation_id, sender, receiver, content, msg_type, created_at,
                    delivered, read_at, status, edited_at, recalled_at, burn_after_read, burned_at
            FROM messages
            WHERE id = ?
            """,
            (message_id,),
        ).fetchone()
    return message_to_public(row) if row else None


def edit_message(message_id: int, username: str, content: str) -> dict | None:
    user = normalize_username(username)
    timestamp = now_iso()
    with get_conn() as conn:
        row = conn.execute(
            """
            SELECT id, sender, receiver, content, recalled_at
            FROM messages
            WHERE id = ?
            """,
            (message_id,),
        ).fetchone()
        if not row:
            return None
        if row["sender"] != user:
            raise ValueError("cannot edit another user's message")
        if row["recalled_at"]:
            raise ValueError("message already recalled")
        conn.execute(
            """
            UPDATE messages
            SET content = ?, edited_at = ?
            WHERE id = ?
            """,
            (content, timestamp, message_id),
        )
        conn.execute(
            """
            INSERT INTO message_audits (message_id, operator, action, old_content, new_content, created_at)
            VALUES (?, ?, 'edit', ?, ?, ?)
            """,
            (message_id, user, row["content"], content, timestamp),
        )
        updated = conn.execute(
            """
            SELECT id, conversation_id, sender, receiver, content, msg_type, created_at,
                   delivered, read_at, status, edited_at, recalled_at, burn_after_read, burned_at
            FROM messages
            WHERE id = ?
            """,
            (message_id,),
        ).fetchone()
    return message_to_public(updated) if updated else None


def recall_message(message_id: int, username: str, is_admin: bool = False) -> dict | None:
    user = normalize_username(username)
    timestamp = now_iso()
    with get_conn() as conn:
        row = conn.execute(
            """
            SELECT id, conversation_id, sender, receiver, content, msg_type, created_at,
                   delivered, read_at, status, edited_at, recalled_at, burn_after_read, burned_at
            FROM messages
            WHERE id = ?
            """,
            (message_id,),
        ).fetchone()
        if not row:
            return None
        if row["sender"] != user and not is_admin:
            raise ValueError("cannot recall another user's message")
        if row["recalled_at"]:
            return message_to_public(row)
        if not is_admin:
            created_at = datetime.fromisoformat(row["created_at"])
            elapsed = datetime.now(timezone.utc) - created_at
            if elapsed.total_seconds() > 180:
                raise ValueError("message recall expired")
        conn.execute(
            """
            UPDATE messages
            SET content = ?, status = 'recalled', recalled_at = ?
            WHERE id = ?
            """,
            ("[消息已撤回]", timestamp, message_id),
        )
        conn.execute(
            """
            INSERT INTO message_audits (message_id, operator, action, old_content, new_content, created_at)
            VALUES (?, ?, 'recall', ?, ?, ?)
            """,
            (message_id, user, row["content"], "[message recalled]", timestamp),
        )
        updated = conn.execute(
            """
            SELECT id, conversation_id, sender, receiver, content, msg_type, created_at,
                   delivered, read_at, status, edited_at, recalled_at, burn_after_read, burned_at
            FROM messages
            WHERE id = ?
            """,
            (message_id,),
        ).fetchone()
    return message_to_public(updated) if updated else None


def favorite_message(username: str, message_id: int, note: str = "") -> dict:
    user = normalize_username(username)
    message = get_message(message_id)
    if not message:
        raise ValueError("message not found")
    if user not in {message["sender"], message["receiver"]} and not message["conversation_id"].startswith("group:"):
        raise ValueError("cannot operate on another user's message")
    timestamp = now_iso()
    with get_conn() as conn:
        conn.execute(
            """
            INSERT INTO message_favorites (username, message_id, note, created_at)
            VALUES (?, ?, ?, ?)
            ON CONFLICT(username, message_id) DO UPDATE SET note = excluded.note
            """,
            (user, message_id, note.strip(), timestamp),
        )
        row = conn.execute(
            """
            SELECT mf.*, m.content, m.msg_type, m.sender, m.receiver
            FROM message_favorites mf
            JOIN messages m ON m.id = mf.message_id
            WHERE mf.username = ? AND mf.message_id = ?
            """,
            (user, message_id),
        ).fetchone()
    return dict(row)


def list_message_favorites(username: str, limit: int = 100) -> list[dict]:
    user = normalize_username(username)
    with get_conn() as conn:
        rows = conn.execute(
            """
            SELECT mf.*, m.content, m.msg_type, m.sender, m.receiver, m.created_at AS message_created_at
            FROM message_favorites mf
            JOIN messages m ON m.id = mf.message_id
            WHERE mf.username = ?
            ORDER BY mf.id DESC
            LIMIT ?
            """,
            (user, limit),
        ).fetchall()
    return [dict(row) for row in rows]


def list_message_audits(message_id: int | None = None, limit: int = 100) -> list[dict]:
    params: list = []
    where = ""
    if message_id is not None:
        where = "WHERE message_id = ?"
        params.append(message_id)
    params.append(limit)
    with get_conn() as conn:
        rows = conn.execute(
            f"SELECT * FROM message_audits {where} ORDER BY id DESC LIMIT ?",
            params,
        ).fetchall()
    return [dict(row) for row in rows]


def forward_message(username: str, message_id: int, targets: list[str]) -> list[dict]:
    user = normalize_username(username)
    message = get_message(message_id)
    if not message:
        raise ValueError("message not found")
    if user not in {message["sender"], message["receiver"]} and not message["conversation_id"].startswith("group:"):
        raise ValueError("cannot operate on another user's message")
    forwarded = []
    prefix = "[转发] "
    for target in targets:
        clean_target = normalize_username(target)
        if not get_user(clean_target):
            raise ValueError("receiver not found")
        forwarded.append(save_message(user, clean_target, prefix + message["content"], True, message["msg_type"]))
    return forwarded


def burn_read_messages(username: str, peer: str) -> int:
    user = normalize_username(username)
    conversation_id = pair_key(user, peer)
    timestamp = now_iso()
    with get_conn() as conn:
        cursor = conn.execute(
            """
            UPDATE messages
            SET content = '[阅后即焚消息已销毁]', status = 'burned', burned_at = ?
            WHERE conversation_id = ?
              AND receiver = ?
              AND burn_after_read = 1
              AND burned_at IS NULL
            """,
            (timestamp, conversation_id, user),
        )
    return cursor.rowcount


def mark_conversation_read(username: str, peer: str) -> dict:
    user = normalize_username(username)
    conversation_id = pair_key(user, peer)
    read_at = now_iso()
    with get_conn() as conn:
        conn.execute(
            """
            UPDATE messages
            SET read_at = ?, status = 'read'
            WHERE conversation_id = ? AND receiver = ? AND read_at IS NULL
            """,
            (read_at, conversation_id, user),
        )
        unread_column = "unread_a" if user < normalize_username(peer) else "unread_b"
        conn.execute(
            f"UPDATE conversations SET {unread_column} = 0 WHERE id = ?",
            (conversation_id,),
        )
    burned = burn_read_messages(user, peer)
    return {"conversation_id": conversation_id, "reader": user, "read_at": read_at, "burned": burned}


def list_sessions(username: str) -> list[dict]:
    user = normalize_username(username)
    with get_conn() as conn:
        rows = conn.execute(
            """
            SELECT c.*,
                   m.id AS msg_id, m.sender, m.receiver, m.content, m.msg_type,
                   m.created_at AS msg_created_at, m.delivered, m.read_at, m.status,
                   u.username AS peer_username, u.display_name, u.avatar, u.disabled,
                   f.remark_a, f.remark_b
            FROM conversations c
            LEFT JOIN messages m ON m.id = c.last_message_id
            JOIN users u ON u.username = CASE WHEN c.user_a = ? THEN c.user_b ELSE c.user_a END
            LEFT JOIN friendships f ON f.pair_key = c.id
            WHERE c.user_a = ? OR c.user_b = ?
            ORDER BY
              CASE WHEN c.user_a = ? THEN c.pinned_a ELSE c.pinned_b END DESC,
              c.updated_at DESC
            """,
            (user, user, user, user),
        ).fetchall()

    sessions = []
    for row in rows:
        is_a = row["user_a"] == user
        last_message = None
        if row["msg_id"]:
            last_message = {
                "id": str(row["msg_id"]),
                "conversation_id": row["id"],
                "sender": row["sender"],
                "receiver": row["receiver"],
                "content": row["content"],
                "msg_type": row["msg_type"],
                "created_at": row["msg_created_at"],
                "delivered": bool(row["delivered"]),
                "read_at": row["read_at"],
                "status": row["status"],
                "edited_at": row["edited_at"] if "edited_at" in row.keys() else None,
                "recalled_at": row["recalled_at"] if "recalled_at" in row.keys() else None,
            }
        sessions.append(
            {
                "id": row["id"],
                "type": row["type"],
                "target_id": row["peer_username"],
                "name": (row["remark_a"] if is_a else row["remark_b"]) or row["display_name"],
                "display_name": row["display_name"],
                "remark": row["remark_a"] if is_a else row["remark_b"],
                "avatar": row["avatar"],
                "unread_count": row["unread_a"] if is_a else row["unread_b"],
                "is_pinned": bool(row["pinned_a"] if is_a else row["pinned_b"]),
                "is_muted": bool(row["muted_a"] if is_a else row["muted_b"]),
                "updated_at": row["updated_at"],
                "last_message": last_message,
            }
        )
    return sessions


def update_session_settings(username: str, peer: str, pinned: bool | None, muted: bool | None) -> dict | None:
    user = normalize_username(username)
    conversation_id = pair_key(user, peer)
    is_a = user < normalize_username(peer)
    updates = {}
    if pinned is not None:
        updates["pinned_a" if is_a else "pinned_b"] = 1 if pinned else 0
    if muted is not None:
        updates["muted_a" if is_a else "muted_b"] = 1 if muted else 0
    if not updates:
        sessions = [item for item in list_sessions(user) if item["id"] == conversation_id]
        return sessions[0] if sessions else None

    assignments = ", ".join(f"{key} = ?" for key in updates)
    values = list(updates.values()) + [conversation_id]
    with get_conn() as conn:
        conn.execute(f"UPDATE conversations SET {assignments} WHERE id = ?", values)

    sessions = [item for item in list_sessions(user) if item["id"] == conversation_id]
    return sessions[0] if sessions else None


def clear_conversation(username: str, peer: str) -> dict:
    user = normalize_username(username)
    other = normalize_username(peer)
    conversation_id = pair_key(user, other)
    timestamp = now_iso()
    with get_conn() as conn:
        conn.execute("DELETE FROM messages WHERE conversation_id = ?", (conversation_id,))
        conn.execute(
            """
            UPDATE conversations
            SET last_message_id = NULL, unread_a = 0, unread_b = 0, updated_at = ?
            WHERE id = ?
            """,
            (timestamp, conversation_id),
        )
    return {"conversation_id": conversation_id, "cleared": True}


def search_im(username: str, query: str, limit: int = 20) -> dict:
    user = normalize_username(username)
    keyword = query.strip()
    if not keyword:
        return {"users": [], "friends": [], "sessions": [], "messages": [], "departments": [], "members": []}

    like = f"%{keyword}%"
    capped_limit = min(max(limit, 1), 50)
    with get_conn() as conn:
        users = conn.execute(
            """
            SELECT username, display_name, avatar, email, phone, signature, role, disabled, created_at, updated_at
            FROM users
            WHERE username != ?
              AND disabled = 0
              AND (username LIKE ? OR display_name LIKE ? OR phone LIKE ? OR email LIKE ?)
            ORDER BY display_name ASC
            LIMIT ?
            """,
            (user, like, like, like, like, capped_limit),
        ).fetchall()

        friends = conn.execute(
            """
            SELECT u.username, u.display_name, u.avatar, u.email, u.phone, u.signature,
                   u.role, u.disabled, u.created_at, u.updated_at
            FROM friendships f
            JOIN users u
              ON u.username = CASE WHEN f.user_a = ? THEN f.user_b ELSE f.user_a END
            WHERE (f.user_a = ? OR f.user_b = ?)
              AND (u.username LIKE ? OR u.display_name LIKE ? OR u.phone LIKE ? OR u.email LIKE ?)
            ORDER BY u.display_name ASC
            LIMIT ?
            """,
            (user, user, user, like, like, like, like, capped_limit),
        ).fetchall()

        sessions = conn.execute(
            """
            SELECT c.id, c.type, c.updated_at,
                   u.username AS peer_username, u.display_name, u.avatar,
                   m.id AS msg_id, m.sender, m.receiver, m.content, m.msg_type,
                   m.created_at AS msg_created_at, m.delivered, m.read_at, m.status
            FROM conversations c
            JOIN users u ON u.username = CASE WHEN c.user_a = ? THEN c.user_b ELSE c.user_a END
            LEFT JOIN messages m ON m.id = c.last_message_id
            WHERE (c.user_a = ? OR c.user_b = ?)
              AND (u.username LIKE ? OR u.display_name LIKE ? OR m.content LIKE ?)
            ORDER BY c.updated_at DESC
            LIMIT ?
            """,
            (user, user, user, like, like, like, capped_limit),
        ).fetchall()

        messages = conn.execute(
            """
            SELECT id, conversation_id, sender, receiver, content, msg_type, created_at, delivered, read_at, status
            FROM messages
            WHERE (sender = ? OR receiver = ?)
              AND content LIKE ?
            ORDER BY id DESC
            LIMIT ?
            """,
            (user, user, like, capped_limit),
        ).fetchall()

        attachments = conn.execute(
            """
            SELECT *
            FROM attachments
            WHERE uploader = ?
              AND original_name LIKE ?
            ORDER BY id DESC
            LIMIT ?
            """,
            (user, like, capped_limit),
        ).fetchall()

    org_results = search_departments_and_members(keyword, capped_limit)
    return {
        "users": [user_to_public(row) for row in users],
        "friends": [user_to_public(row) for row in friends],
        "sessions": [
            {
                "id": row["id"],
                "type": row["type"],
                "target_id": row["peer_username"],
                "name": row["display_name"],
                "avatar": row["avatar"],
                "updated_at": row["updated_at"],
                "last_message": message_to_public(
                    {
                        "id": row["msg_id"],
                        "conversation_id": row["id"],
                        "sender": row["sender"],
                        "receiver": row["receiver"],
                        "content": row["content"],
                        "msg_type": row["msg_type"],
                        "created_at": row["msg_created_at"],
                        "delivered": row["delivered"],
                        "read_at": row["read_at"],
                        "status": row["status"],
                    }
                )
                if row["msg_id"]
                else None,
            }
            for row in sessions
        ],
        "messages": [message_to_public(row) for row in messages],
        "attachments": [attachment_to_public(row) for row in attachments],
        "departments": org_results["departments"],
        "members": org_results["members"],
    }


def admin_overview() -> dict:
    with get_conn() as conn:
        users_count = conn.execute("SELECT COUNT(*) AS count FROM users").fetchone()["count"]
        messages_count = conn.execute("SELECT COUNT(*) AS count FROM messages").fetchone()["count"]
        friendships_count = conn.execute("SELECT COUNT(*) AS count FROM friendships").fetchone()["count"]
        attachments_count = conn.execute("SELECT COUNT(*) AS count FROM attachments").fetchone()["count"]
        attachments_size = conn.execute("SELECT COALESCE(SUM(size), 0) AS size FROM attachments").fetchone()["size"]
        pending_requests = conn.execute(
            "SELECT COUNT(*) AS count FROM friend_requests WHERE status = 'pending'"
        ).fetchone()["count"]
        conversations_count = conn.execute("SELECT COUNT(*) AS count FROM conversations").fetchone()["count"]
        groups_count = conn.execute("SELECT COUNT(*) AS count FROM groups WHERE dissolved = 0").fetchone()["count"]
        sensitive_words_count = conn.execute("SELECT COUNT(*) AS count FROM sensitive_words WHERE enabled = 1").fetchone()["count"]
        download_logs_count = conn.execute("SELECT COUNT(*) AS count FROM attachment_download_logs").fetchone()["count"]
        message_types = conn.execute(
            "SELECT msg_type, COUNT(*) AS count FROM messages GROUP BY msg_type"
        ).fetchall()
        today = datetime.now(timezone.utc).date().isoformat()
        daily_active = conn.execute(
            "SELECT COUNT(DISTINCT username) AS count FROM login_logs WHERE substr(created_at, 1, 10) = ?",
            (today,),
        ).fetchone()["count"]
        today_messages = conn.execute(
            "SELECT COUNT(*) AS count FROM messages WHERE substr(created_at, 1, 10) = ?",
            (today,),
        ).fetchone()["count"]
    return {
        "users": users_count,
        "messages": messages_count,
        "today_messages": today_messages,
        "friendships": friendships_count,
        "pending_friend_requests": pending_requests,
        "conversations": conversations_count,
        "groups": groups_count,
        "attachments": attachments_count,
        "attachment_storage_bytes": attachments_size,
        "daily_active_users": daily_active,
        "sensitive_words": sensitive_words_count,
        "download_logs": download_logs_count,
        "message_types": {row["msg_type"]: row["count"] for row in message_types},
    }


def admin_trends(days: int = 7) -> list[dict]:
    safe_days = min(max(days, 1), 30)
    today = datetime.now(timezone.utc).date()
    start = today - timedelta(days=safe_days - 1)
    result = []
    with get_conn() as conn:
        for index in range(safe_days):
            day = (start + timedelta(days=index)).isoformat()
            messages = conn.execute(
                "SELECT COUNT(*) AS count FROM messages WHERE substr(created_at, 1, 10) = ?",
                (day,),
            ).fetchone()["count"]
            active_users = conn.execute(
                "SELECT COUNT(DISTINCT username) AS count FROM login_logs WHERE substr(created_at, 1, 10) = ?",
                (day,),
            ).fetchone()["count"]
            new_users = conn.execute(
                "SELECT COUNT(*) AS count FROM users WHERE substr(created_at, 1, 10) = ?",
                (day,),
            ).fetchone()["count"]
            new_groups = conn.execute(
                "SELECT COUNT(*) AS count FROM groups WHERE substr(created_at, 1, 10) = ?",
                (day,),
            ).fetchone()["count"]
            result.append({"date": day, "messages": messages, "active_users": active_users, "new_users": new_users, "new_groups": new_groups})
    return result


def list_system_configs() -> list[dict]:
    with get_conn() as conn:
        rows = conn.execute("SELECT * FROM system_configs ORDER BY key").fetchall()
    return [dict(row) for row in rows]


def update_system_config(key: str, value: str, operator: str = "") -> dict:
    clean_key = key.strip()
    if not clean_key:
        raise ValueError("config key empty")
    timestamp = now_iso()
    with get_conn() as conn:
        row = conn.execute("SELECT key FROM system_configs WHERE key = ?", (clean_key,)).fetchone()
        if not row:
            conn.execute(
                "INSERT INTO system_configs (key, value, description, updated_at) VALUES (?, ?, '', ?)",
                (clean_key, value, timestamp),
            )
        else:
            conn.execute(
                "UPDATE system_configs SET value = ?, updated_at = ? WHERE key = ?",
                (value, timestamp, clean_key),
            )
        updated = conn.execute("SELECT * FROM system_configs WHERE key = ?", (clean_key,)).fetchone()
    if operator:
        record_operation(operator, "update_system_config", clean_key, value)
    return dict(updated)


def admin_list_messages(limit: int = 100, keyword: str = "", username: str = "", msg_type: str = "", date_from: str = "", date_to: str = "") -> list[dict]:
    clauses = []
    params: list = []
    if keyword:
        clauses.append("content LIKE ?")
        params.append(f"%{keyword}%")
    if username:
        clauses.append("(sender = ? OR receiver = ?)")
        params.extend([username, username])
    if msg_type:
        clauses.append("msg_type = ?")
        params.append(msg_type)
    if date_from:
        clauses.append("created_at >= ?")
        params.append(date_from)
    if date_to:
        clauses.append("created_at <= ?")
        params.append(date_to)
    where = f"WHERE {' AND '.join(clauses)}" if clauses else ""
    params.append(limit)
    with get_conn() as conn:
        rows = conn.execute(
            f"""
            SELECT id, conversation_id, sender, receiver, content, msg_type, created_at,
                   delivered, read_at, status, edited_at, recalled_at
            FROM messages
            {where}
            ORDER BY id DESC
            LIMIT ?
            """,
            params,
        ).fetchall()
        return [message_to_public(row) for row in rows]


def admin_list_friend_requests(limit: int = 100) -> list[dict]:
    with get_conn() as conn:
        rows = conn.execute(
            "SELECT * FROM friend_requests ORDER BY id DESC LIMIT ?",
            (limit,),
        ).fetchall()
        return [dict(row) for row in rows]


def admin_list_friendships(limit: int = 100) -> list[dict]:
    with get_conn() as conn:
        rows = conn.execute(
            """
            SELECT f.id, f.user_a, f.user_b, f.pair_key, f.remark_a, f.remark_b,
                   f.source, f.created_at,
                   ua.display_name AS user_a_name,
                   ub.display_name AS user_b_name
            FROM friendships f
            JOIN users ua ON ua.username = f.user_a
            JOIN users ub ON ub.username = f.user_b
            ORDER BY f.id DESC
            LIMIT ?
            """,
            (limit,),
        ).fetchall()
        return [dict(row) for row in rows]


def admin_list_attachments(limit: int = 100, category: str | None = None, uploader: str | None = None, date_from: str | None = None, date_to: str | None = None) -> list[dict]:
    clauses = []
    params: list = []
    if category:
        clauses.append("category = ?")
        params.append(category)
    if uploader:
        clauses.append("uploader = ?")
        params.append(normalize_username(uploader))
    if date_from:
        clauses.append("created_at >= ?")
        params.append(date_from)
    if date_to:
        clauses.append("created_at <= ?")
        params.append(date_to)
    where = f"WHERE {' AND '.join(clauses)}" if clauses else ""
    params.append(limit)
    with get_conn() as conn:
        rows = conn.execute(
            f"""
            SELECT *
            FROM attachments
            {where}
            ORDER BY id DESC
            LIMIT ?
            """,
            params,
        ).fetchall()
    return [attachment_to_public(row) for row in rows]


def admin_list_attachment_download_logs(limit: int = 100) -> list[dict]:
    with get_conn() as conn:
        rows = conn.execute(
            """
            SELECT *
            FROM attachment_download_logs
            ORDER BY id DESC
            LIMIT ?
            """,
            (limit,),
        ).fetchall()
    return [dict(row) for row in rows]
