import os
from pathlib import Path


BASE_DIR = Path(__file__).resolve().parent.parent
DB_PATH = Path(os.environ.get("IM_DB_PATH", BASE_DIR / "im.sqlite3"))
ATTACHMENT_DIR = Path(os.environ.get("IM_ATTACHMENT_DIR", BASE_DIR / "uploads"))
MAX_UPLOAD_BYTES = int(os.environ.get("IM_MAX_UPLOAD_BYTES", str(20 * 1024 * 1024)))
