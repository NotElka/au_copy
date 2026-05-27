import os
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent
STORAGE_DIR = BASE_DIR / "storage"
STORAGE_DIR.mkdir(exist_ok=True)

SESSION_TTL_SECONDS = 30 * 60  # 30 минут — соответствует UI "Действует 30 минут"
MAX_FILE_SIZE = 25 * 1024 * 1024  # 25 МБ (лимит Telegram Bot API)

ALLOWED_EXTENSIONS = {".pdf", ".doc", ".docx", ".jpg", ".jpeg", ".png", ".bmp", ".webp", ".tiff", ".tif", ".gif"}
ALLOWED_MIME_TYPES = {
    "application/pdf",
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "image/jpeg",
    "image/png",
    "image/bmp",
    "image/webp",
    "image/tiff",
    "image/gif",
}

CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"
CODE_LENGTH = 6

CORS_ORIGINS = [
    "http://localhost:5173",
    "http://localhost:4173",
    "http://127.0.0.1:5173",
    "http://127.0.0.1:4173",
]

UPLOAD_TOKEN = "dev-secret-change-me"

# --- Печать через Ghostscript ---
# AU_GS_PATH    — путь до gswin64c.exe. По умолчанию ищется в PATH.
# AU_PRINTER    — имя принтера Windows (как в "Принтеры и сканеры").
#                 Пусто = принтер по умолчанию.
GS_PATH      = os.environ.get("AU_GS_PATH", r"C:\Program Files\gs\gs10.07.1\bin\gswin64c.exe")
# Если env-переменная указывает на несуществующий путь — подставляем дефолт
import os as _os
if not _os.path.exists(GS_PATH):
    GS_PATH = r"C:\Program Files\gs\gs10.07.1\bin\gswin64c.exe"
PRINTER_NAME = os.environ.get("AU_PRINTER", "EPSON M3180 Series")
