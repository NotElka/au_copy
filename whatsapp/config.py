"""Конфиг WhatsApp-бота (WhatsApp Cloud API от Meta).

Секреты берутся из переменных окружения, а если их нет — из файла
`whatsapp/secrets.env` (формат KEY=VALUE, по строке на ключ).
Шаблон — `whatsapp/secrets.example.env`. Сам `secrets.env` в .gitignore.
"""
import os
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent
SECRETS_FILE = BASE_DIR / "secrets.env"


def _load_secrets_file() -> dict[str, str]:
    """Простой парсер KEY=VALUE. Поддерживает комментарии (#) и кавычки."""
    data: dict[str, str] = {}
    if not SECRETS_FILE.exists():
        return data
    # utf-8-sig — на случай если файл сохранён из PowerShell с BOM.
    for raw in SECRETS_FILE.read_text(encoding="utf-8-sig").splitlines():
        line = raw.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, _, val = line.partition("=")
        data[key.strip()] = val.strip().strip('"').strip("'")
    return data


_file = _load_secrets_file()


def _get(key: str, default: str = "") -> str:
    # Переменная окружения приоритетнее файла.
    return os.environ.get(key) or _file.get(key, default)


# --- Секреты WhatsApp Cloud API (заполняются в secrets.env) ---
VERIFY_TOKEN    = _get("WHATSAPP_VERIFY_TOKEN", "aucopy-verify-change-me")
ACCESS_TOKEN    = _get("WHATSAPP_ACCESS_TOKEN")
PHONE_NUMBER_ID = _get("WHATSAPP_PHONE_NUMBER_ID")
APP_SECRET      = _get("WHATSAPP_APP_SECRET")  # опционально: проверка подписи вебхука
API_VERSION     = _get("WHATSAPP_API_VERSION", "v21.0")
GRAPH_BASE      = f"https://graph.facebook.com/{API_VERSION}"

# --- Связь с бэкендом AU Copy (тот же, что и у Telegram-бота) ---
BACKEND_URL  = _get("BACKEND_URL", "http://127.0.0.1:8000")
UPLOAD_TOKEN = _get("UPLOAD_TOKEN", "dev-secret-change-me")  # должен совпадать с backend/config.py

# --- Сервис ---
PORT = int(_get("WHATSAPP_PORT", "8001"))

# --- Лимиты/форматы (как в backend/config.py) ---
MAX_FILE_SIZE = 25 * 1024 * 1024  # 25 МБ
ALLOWED_EXTENSIONS = {
    ".pdf", ".doc", ".docx",
    ".jpg", ".jpeg", ".png", ".bmp", ".webp", ".tiff", ".tif", ".gif",
}
MIME_TO_EXT = {
    "application/pdf": ".pdf",
    "application/msword": ".doc",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document": ".docx",
    "image/jpeg": ".jpg",
    "image/png": ".png",
    "image/bmp": ".bmp",
    "image/webp": ".webp",
    "image/tiff": ".tiff",
    "image/gif": ".gif",
}
