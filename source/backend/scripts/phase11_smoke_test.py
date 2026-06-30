from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]
APP = ROOT / "web-ui" / "im-ui" / "src" / "App.tsx"
CSS = ROOT / "web-ui" / "im-ui" / "src" / "App.css"
CLIENT = ROOT / "web-ui" / "im-ui" / "src" / "lib" / "imClient.ts"


def require(text: str, needle: str) -> None:
    if needle not in text:
        raise AssertionError(f"missing: {needle}")


def main() -> None:
    app = APP.read_text(encoding="utf-8")
    css = CSS.read_text(encoding="utf-8")
    client = CLIENT.read_text(encoding="utf-8")

    for needle in [
        "FriendDetailPanel",
        "GroupSettingsPanel",
        "共同群聊",
        "历史文件",
        "群历史文件",
        "我的群昵称",
        "转让群主",
        "头像地址",
        "detailsOpen",
        "MiniFileList",
    ]:
        require(app, needle)

    for needle in [
        ".detail-card",
        ".detail-grid",
        ".detail-actions",
        ".member-grid",
        ".mini-file-list",
    ]:
        require(css, needle)

    for needle in ["friend_source", "friend_created_at", "avatar?: string"]:
        require(client, needle)

    print("PHASE11_OK")


if __name__ == "__main__":
    main()
