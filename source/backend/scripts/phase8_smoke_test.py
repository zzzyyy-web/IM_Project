from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]
APP = ROOT / "web-ui" / "im-ui" / "src" / "App.tsx"
CSS = ROOT / "web-ui" / "im-ui" / "src" / "App.css"


def require(text: str, needle: str) -> None:
    if needle not in text:
        raise AssertionError(f"missing: {needle}")


def main() -> None:
    app = APP.read_text(encoding="utf-8")
    css = CSS.read_text(encoding="utf-8")

    for needle in [
        "groupUsersByInitial",
        "flattenDepartments",
        "findDepartmentPath",
        "我的部门",
        "当前位置：",
        "最近查看",
        "SearchGroup title=\"部门\"",
        "SearchGroup title=\"成员\"",
        "SearchGroup title=\"联系人\"",
        "发消息",
        "设置备注",
    ]:
        require(app, needle)

    for needle in [
        ".az-group",
        ".az-title",
        ".org-toolbar",
        ".recent-departments",
        ".search-group",
        ".profile-actions",
    ]:
        require(css, needle)

    print("PHASE8_OK")


if __name__ == "__main__":
    main()
