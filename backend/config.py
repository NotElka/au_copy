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
PRINTER_NAME = os.environ.get("AU_PRINTER", "Microsoft Print to PDF")

# --- Цена печати ---
# Серверная истина для расчёта суммы оплаты (фронту не доверяем).
# Должна совпадать с PRICE_PER_SHEET во фронте (frontend/src/hooks/usePrintPrice.js).
PRICE_PER_SHEET = int(os.environ.get("AU_PRICE_PER_SHEET", "24"))

# --- Kaspi Smart POS (физический терминал в локальной сети) ---
# Документация: Smart-POS-Dokymentatsia-po-integratsii.pdf (в корне проекта).
#   AU_KASPI_POS_IP     — статический IP терминала в той же сети (порт 8080).
#   AU_KASPI_POS_NAME   — имя кассы; задаётся один раз при регистрации и НЕ меняется.
#   AU_KASPI_OWN_CHEQUE — "1" = чек обрабатывает касса (терминал НЕ печатает);
#                         "0" = чек об оплате печатает сам терминал (по умолчанию).
KASPI_POS_IP     = os.environ.get("AU_KASPI_POS_IP", "192.168.1.116")
KASPI_POS_PORT   = int(os.environ.get("AU_KASPI_POS_PORT", "8080"))
KASPI_POS_NAME   = os.environ.get("AU_KASPI_POS_NAME", "AuCopy")
KASPI_OWN_CHEQUE = os.environ.get("AU_KASPI_OWN_CHEQUE", "0") == "1"
