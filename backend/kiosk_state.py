"""Локальное состояние киоска: счётчик бумаги, статистика заданий, ошибки.

Хранится в JSON-файле kiosk_state.json рядом с backend/. Это намеренно простой
вариант (а не SQLite) — у одного киоска нет нагрузки и шкафа истории.

Если когда-нибудь понадобится централизованная аналитика — слой можно подменить
не меняя API: достаточно сохранить тот же интерфейс KioskState.
"""

import asyncio
import json
import logging
import shutil
import time
from datetime import datetime
from pathlib import Path
from typing import Any

from .config import GS_PATH, PRINTER_NAME

log = logging.getLogger("aucopy-kiosk")

BASE_DIR = Path(__file__).resolve().parent
STATE_FILE = BASE_DIR / "kiosk_state.json"
MAX_ERRORS_KEPT = 20
MAX_JOBS_KEPT = 50

DEFAULT_STATE = {
    "paper": {
        "total": 500,
        "remaining": 500,
        "lastRefillAt": None,
        "warnBelow": 50,
        "blockBelow": 0,
    },
    "jobs": {
        "today": 0,
        "todayDate": None,        # YYYY-MM-DD — обнуляем today при смене дня
        "total": 0,
        "recent": [],             # последние MAX_JOBS_KEPT
    },
    "errors": [],                  # последние MAX_ERRORS_KEPT — техн. ошибки бэка
    "reports": [],                 # отчёты от пользователей с фронта
    "startedAt": None,
    "lastJobAt": None,
}

# Антиспам: лимиты по IP
SPAM_WINDOW_SECONDS = 60          # окно
SPAM_MAX_PER_WINDOW = 3            # макс. репортов с одного IP за окно
SPAM_MIN_TEXT_LEN = 4              # минимальная длина описания (или категория сама не "Другое")
SPAM_COOLDOWN_AFTER_BLOCK = 300    # 5 минут блока если троллит
MAX_REPORTS_KEPT = 100


class KioskState:
    def __init__(self) -> None:
        self._lock = asyncio.Lock()
        self._data: dict[str, Any] = self._load()
        # in-memory антиспам — не сохраняется в файл
        self._spam_log: dict[str, list[float]] = {}  # ip → [timestamps]
        self._spam_blocked_until: dict[str, float] = {}
        if self._data.get("startedAt") is None:
            self._data["startedAt"] = datetime.now().isoformat(timespec="seconds")
            self._save()

    # ── persistence ──────────────────────────────────────────────────────

    def _load(self) -> dict[str, Any]:
        if not STATE_FILE.exists():
            return json.loads(json.dumps(DEFAULT_STATE))  # deep copy
        try:
            with STATE_FILE.open("r", encoding="utf-8") as f:
                data = json.load(f)
            # дополним недостающие ключи
            for k, v in DEFAULT_STATE.items():
                data.setdefault(k, v)
            return data
        except Exception:
            log.exception("kiosk_state load failed, returning defaults")
            return json.loads(json.dumps(DEFAULT_STATE))

    def _save(self) -> None:
        try:
            tmp = STATE_FILE.with_suffix(".tmp")
            with tmp.open("w", encoding="utf-8") as f:
                json.dump(self._data, f, ensure_ascii=False, indent=2)
            tmp.replace(STATE_FILE)
        except Exception:
            log.exception("kiosk_state save failed")

    # ── public API ───────────────────────────────────────────────────────

    async def snapshot(self) -> dict[str, Any]:
        """Текущий снимок состояния + рантайм-инфа (принтер, GS, аптайм)."""
        async with self._lock:
            self._roll_today_if_needed()
            data = json.loads(json.dumps(self._data))   # deep copy
        data["runtime"] = {
            "printer": PRINTER_NAME or "(по умолчанию)",
            "gsPath": GS_PATH,
            "gsAvailable": Path(GS_PATH).is_file() or bool(shutil.which(GS_PATH)),
            "now": datetime.now().isoformat(timespec="seconds"),
            "uptimeSec": self._uptime_seconds(),
        }
        return data

    async def consume_paper(self, sheets: int) -> None:
        async with self._lock:
            paper = self._data["paper"]
            paper["remaining"] = max(0, paper["remaining"] - max(0, sheets))
            self._save()
        log.info("paper consumed: -%d, remaining=%d", sheets, paper["remaining"])

    async def record_job(self, *, sheets: int, mode: str, file_name: str,
                         settings: dict, error: str | None = None) -> None:
        async with self._lock:
            self._roll_today_if_needed()
            self._data["jobs"]["today"] += 1
            self._data["jobs"]["total"] += 1
            self._data["lastJobAt"] = datetime.now().isoformat(timespec="seconds")
            entry = {
                "at": self._data["lastJobAt"],
                "sheets": sheets,
                "mode": mode,
                "file": file_name,
                "settings": settings,
                "error": error,
            }
            recent = self._data["jobs"]["recent"]
            recent.insert(0, entry)
            del recent[MAX_JOBS_KEPT:]
            self._save()

    async def record_error(self, message: str, context: dict | None = None) -> None:
        async with self._lock:
            entry = {
                "at": datetime.now().isoformat(timespec="seconds"),
                "message": message,
                "context": context or {},
            }
            self._data["errors"].insert(0, entry)
            del self._data["errors"][MAX_ERRORS_KEPT:]
            self._save()

    async def refill_paper(self, total: int | None = None) -> dict[str, Any]:
        async with self._lock:
            paper = self._data["paper"]
            if total is not None and total > 0:
                paper["total"] = int(total)
            paper["remaining"] = paper["total"]
            paper["lastRefillAt"] = datetime.now().isoformat(timespec="seconds")
            self._save()
            return dict(paper)

    # ── отчёты от пользователей ─────────────────────────────────────────

    def check_spam(self, ip: str) -> tuple[bool, str | None]:
        """Возвращает (allowed, error_message). Не требует await — чистая память."""
        now = time.time()
        # активная блокировка?
        blocked_until = self._spam_blocked_until.get(ip, 0)
        if blocked_until > now:
            return False, f"Слишком много обращений. Попробуйте через {int(blocked_until - now)} секунд."
        # окно
        timestamps = self._spam_log.setdefault(ip, [])
        timestamps[:] = [t for t in timestamps if now - t < SPAM_WINDOW_SECONDS]
        if len(timestamps) >= SPAM_MAX_PER_WINDOW:
            self._spam_blocked_until[ip] = now + SPAM_COOLDOWN_AFTER_BLOCK
            return False, f"Слишком много обращений. Попробуйте через {SPAM_COOLDOWN_AFTER_BLOCK // 60} минут."
        return True, None

    def _register_spam(self, ip: str) -> None:
        self._spam_log.setdefault(ip, []).append(time.time())

    @staticmethod
    def _validate_report(category: str, description: str) -> str | None:
        """Возвращает текст ошибки или None если валидно."""
        if not category or not isinstance(category, str):
            return "Не указана категория"
        if len(category) > 100:
            return "Категория слишком длинная"
        if description and len(description) > 1000:
            return "Описание слишком длинное (макс 1000 символов)"
        # Если категория «Другое», нужно описание
        if category.strip().lower() in ("другое", "other", "басқа") and (not description or len(description.strip()) < SPAM_MIN_TEXT_LEN):
            return "Для категории «Другое» нужно описание (минимум 4 символа)"
        # Простой фильтр повторяющихся символов
        if description:
            stripped = description.strip()
            if stripped and len(set(stripped)) <= 2 and len(stripped) > 5:
                return "Описание похоже на спам"
        return None

    async def add_report(self, *, category: str, description: str, ip: str,
                         lang: str = "ru", screen: int | None = None) -> dict:
        # 1. Антиспам по IP
        allowed, spam_err = self.check_spam(ip)
        if not allowed:
            raise ValueError(spam_err)
        # 2. Валидация контента
        validation_err = self._validate_report(category, description)
        if validation_err:
            raise ValueError(validation_err)

        async with self._lock:
            entry = {
                "id": int(time.time() * 1000),
                "at": datetime.now().isoformat(timespec="seconds"),
                "category": category.strip(),
                "description": (description or "").strip(),
                "ip": ip,
                "lang": lang,
                "screen": screen,
                "resolved": False,
            }
            reports = self._data.setdefault("reports", [])
            reports.insert(0, entry)
            del reports[MAX_REPORTS_KEPT:]
            self._save()
            self._register_spam(ip)
            return entry

    async def resolve_report(self, report_id: int) -> bool:
        async with self._lock:
            for r in self._data.get("reports", []):
                if r["id"] == report_id:
                    r["resolved"] = True
                    self._save()
                    return True
        return False

    async def reset_today(self) -> None:
        async with self._lock:
            self._data["jobs"]["today"] = 0
            self._data["jobs"]["todayDate"] = datetime.now().strftime("%Y-%m-%d")
            self._save()

    async def can_print(self, needed_sheets: int) -> tuple[bool, str | None]:
        async with self._lock:
            paper = self._data["paper"]
            if paper["remaining"] < paper.get("blockBelow", 0):
                return False, "В принтере нет бумаги. Обратитесь к администратору."
            if needed_sheets > paper["remaining"]:
                return False, (
                    f"В принтере осталось {paper['remaining']} листов, "
                    f"а нужно {needed_sheets}. Уменьшите количество копий."
                )
            return True, None

    # ── helpers ──────────────────────────────────────────────────────────

    def _roll_today_if_needed(self) -> None:
        today = datetime.now().strftime("%Y-%m-%d")
        if self._data["jobs"].get("todayDate") != today:
            self._data["jobs"]["todayDate"] = today
            self._data["jobs"]["today"] = 0

    def _uptime_seconds(self) -> int:
        started = self._data.get("startedAt")
        if not started:
            return 0
        try:
            t0 = datetime.fromisoformat(started)
            return int((datetime.now() - t0).total_seconds())
        except Exception:
            return 0


# глобальный синглтон
state = KioskState()
