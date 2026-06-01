"""Клиент Kaspi Smart POS + хранилище состояния платежей.

Документация терминала: Smart-POS-Dokymentatsia-po-integratsii.pdf (в корне),
текст — в _pdf_text.txt. Кратко:
  • HTTPS, порт 8080, терминал в той же локальной сети (self-signed по IP).
  • Авторизация — заголовок `accesstoken`; токен живёт 24 часа, обновляется
    через /v2/revoke по refreshToken. Регистрация (/v2/register) — разовая,
    требует нажать «Разрешить» на самом терминале.
  • Поток оплаты: /v2/payment?amount=N → processId → поллинг /v2/status?processId=…
    (status: wait → success | fail | unknown). При unknown — /v2/actualize.
  • Ответ всегда {statusCode:int, data, errorText}; statusCode=0 — успех вызова
    (это НЕ http-код: транзакция может быть fail при statusCode=0).

Три слоя:
  KaspiPOS        — тонкий HTTP-клиент терминала.
  Payment         — карточка одного платежа (code → processId → статус).
  PaymentService  — «правда» об оплате на сервере: идемпотентность (один code =
                    один активный платёж), опрос статуса, авто-актуализация.
                    Эндпойнты в main.py зовут именно service.

Если терминал недоступен или касса не зарегистрирована — методы кидают
KaspiError; эндпойнты превращают его в {ok:false}, а экран показывает
«Оплата сейчас недоступна».
"""

import asyncio
import json
import logging
import time
from dataclasses import dataclass, field
from datetime import datetime, timedelta

import httpx

from .config import (
    BASE_DIR,
    KASPI_OWN_CHEQUE,
    KASPI_POS_IP,
    KASPI_POS_NAME,
    KASPI_POS_PORT,
)
from .pricing import compute_price

log = logging.getLogger("aucopy-kaspi")

TOKEN_FILE = BASE_DIR / "kaspi_token.json"
HTTP_TIMEOUT = httpx.Timeout(10.0)
TOKEN_REFRESH_MARGIN = timedelta(hours=1)   # обновляем токен заранее, не дожидаясь 403
ACTUALIZE_MIN_INTERVAL = 10                 # сек; минимум по документации


class KaspiError(Exception):
    """Любая проблема при общении с терминалом (сеть, токен, бизнес-ошибка)."""


def _parse_date(s: str | None) -> datetime | None:
    if not s:
        return None
    for fmt in ("%Y-%m-%d %H:%M:%S", "%d.%m.%y %H:%M:%S", "%Y-%m-%dT%H:%M:%S"):
        try:
            return datetime.strptime(s.strip(), fmt)
        except ValueError:
            continue
    return None


# ──────────────────────────────────────────────────────────────────────────
# HTTP-клиент терминала


class KaspiPOS:
    def __init__(self) -> None:
        self.base_url = f"https://{KASPI_POS_IP}:{KASPI_POS_PORT}"
        self.name = KASPI_POS_NAME
        self._access_token: str | None = None
        self._refresh_token: str | None = None
        self._expires: datetime | None = None
        self._terminal_id: str | None = None
        self._load_tokens()

    # --- персистентность токенов -------------------------------------------------

    def _load_tokens(self) -> None:
        try:
            data = json.loads(TOKEN_FILE.read_text("utf-8"))
        except (OSError, ValueError):
            return  # файла ещё нет — токены остаются пустыми (касса не зарегистрирована)
        self._access_token = data.get("accessToken")
        self._refresh_token = data.get("refreshToken")
        self._expires = _parse_date(data.get("expirationDate"))
        self._terminal_id = data.get("terminalId")
        if data.get("name"):
            self.name = data["name"]

    def _save_tokens(self) -> None:
        payload = {
            "name": self.name,
            "accessToken": self._access_token,
            "refreshToken": self._refresh_token,
            "expirationDate": self._expires.strftime("%Y-%m-%d %H:%M:%S") if self._expires else None,
            "terminalId": self._terminal_id,
        }
        try:
            TOKEN_FILE.write_text(json.dumps(payload, ensure_ascii=False, indent=2), "utf-8")
        except OSError as exc:
            log.warning("не удалось сохранить %s: %s", TOKEN_FILE.name, exc)

    def _store_token(self, data: dict) -> None:
        self._access_token = data.get("accessToken")
        self._refresh_token = data.get("refreshToken")
        self._expires = _parse_date(data.get("expirationDate"))
        self._save_tokens()

    # --- базовый запрос ----------------------------------------------------------

    async def _request(
        self,
        path: str,
        params: dict | None = None,
        *,
        with_token: bool = True,
        extra_headers: dict | None = None,
        _retried: bool = False,
    ) -> dict:
        """GET к терминалу. Возвращает data из ответа или кидает KaspiError.

        Обрабатывает: 401 (нет/плохой токен), 403 (токен истёк → revoke и 1 повтор),
        и бизнес-ошибки (statusCode != 0).
        """
        headers = {"accesstoken": self._access_token or ""} if with_token else {}
        if extra_headers:
            headers.update(extra_headers)

        try:
            async with httpx.AsyncClient(verify=False, timeout=HTTP_TIMEOUT) as client:
                resp = await client.get(self.base_url + path, params=params, headers=headers)
        except httpx.RequestError as exc:
            raise KaspiError(f"нет связи с терминалом ({self.base_url}): {exc}") from exc

        # 403 = токен истёк → обновляем и повторяем запрос один раз.
        if resp.status_code == 403 and with_token and not _retried:
            await self._revoke()
            return await self._request(
                path, params, with_token=with_token, extra_headers=extra_headers, _retried=True
            )
        if resp.status_code == 401:
            raise KaspiError("терминал отклонил токен (401) — нужна повторная регистрация кассы")

        try:
            body = resp.json()
        except ValueError as exc:
            raise KaspiError(f"терминал вернул не-JSON (HTTP {resp.status_code})") from exc

        # statusCode в ТЕЛЕ — это НЕ http-код. 0 = успех вызова.
        if body.get("statusCode") != 0:
            msg = (
                (body.get("data") or {}).get("message")
                or body.get("errorText")
                or f"statusCode={body.get('statusCode')}"
            )
            raise KaspiError(msg)
        return body.get("data") or {}

    # --- токены ------------------------------------------------------------------

    async def register(self) -> dict:
        """Разовая регистрация. На терминале должно быть нажато «Настроить доступ»,
        а после этого запроса — «Разрешить». accesstoken тут не передаётся."""
        log.info("регистрация кассы '%s' на %s", self.name, self.base_url)
        data = await self._request("/v2/register", {"name": self.name}, with_token=False)
        self._store_token(data)
        return data

    async def _revoke(self) -> dict:
        if not self._refresh_token:
            raise KaspiError(
                "касса не зарегистрирована — выполните: python -m backend.kaspi_pos register"
            )
        data = await self._request(
            "/v2/revoke",
            {"name": self.name, "refreshToken": self._refresh_token},
            with_token=False,
        )
        self._store_token(data)
        return data

    async def ensure_token(self) -> None:
        """Гарантирует свежий accessToken перед запросом."""
        if not self._access_token:
            raise KaspiError(
                "касса не зарегистрирована — выполните: python -m backend.kaspi_pos register"
            )
        # обновляем заранее — за час до истечения, не дожидаясь 403
        if self._expires and datetime.now() >= self._expires - TOKEN_REFRESH_MARGIN:
            await self._revoke()

    # --- операции ----------------------------------------------------------------

    async def device_info(self) -> dict:
        """Лёгкая проверка доступа к API (+ источник terminalId)."""
        await self.ensure_token()
        data = await self._request("/v2/deviceinfo")
        if data.get("terminalId"):
            self._terminal_id = data["terminalId"]
            self._save_tokens()
        return data

    async def start_payment(self, amount: int) -> dict:
        """/v2/payment?amount=N → {processId, status}. amount — целое в тенге."""
        await self.ensure_token()
        params: dict = {"amount": int(amount)}
        if KASPI_OWN_CHEQUE:
            params["owncheque"] = "true"
        return await self._request("/v2/payment", params)

    async def get_status(self, process_id: str) -> dict:
        """/v2/status?processId=… → {status, subStatus, chequeInfo?, message?}."""
        await self.ensure_token()
        # Документация требует в /v2/status ещё заголовок terminalId — берём его
        # один раз из /v2/deviceinfo и кэшируем.
        if not self._terminal_id:
            try:
                await self.device_info()
            except KaspiError:
                pass
        extra = {"terminalId": self._terminal_id} if self._terminal_id else None
        return await self._request("/v2/status", {"processId": process_id}, extra_headers=extra)

    async def actualize(self, process_id: str) -> dict:
        """/v2/actualize — дожать «unknown» до финального статуса."""
        await self.ensure_token()
        return await self._request("/v2/actualize", {"processId": process_id})


# ──────────────────────────────────────────────────────────────────────────
# Состояние платежей на сервере


@dataclass
class Payment:
    code: str
    process_id: str
    amount: int
    sheets: int
    settings: dict
    status: str = "wait"          # wait | success | fail | unknown
    sub_status: str = ""
    method: str | None = None     # qr | card | alaqan
    transaction_id: str | None = None  # orderNumber (QR) / rrn (card) — для возвратов
    message: str | None = None    # человекочитаемый текст при fail
    paid: bool = False
    printed: bool = False
    created_at: float = field(default_factory=time.time)
    last_actualize: float = 0.0

    @property
    def is_final(self) -> bool:
        return self.status in ("success", "fail")


class PaymentService:
    def __init__(self) -> None:
        self.pos = KaspiPOS()
        self._by_code: dict[str, Payment] = {}
        self._by_process: dict[str, Payment] = {}
        self._lock = asyncio.Lock()

    async def start(self, code: str, page_count: int | None, settings: dict) -> Payment:
        """Старт оплаты для кода. Идемпотентно: повторный или одновременный вызов
        при активном платеже вернёт его же — без второго обращения к терминалу.

        Блокировку держим на ВЕСЬ старт, включая вызов терминала. Иначе два почти
        одновременных запроса (в dev React.StrictMode монтирует экран дважды) оба
        прошли бы проверку и дважды дёрнули /v2/payment — второй упёрся бы в
        «терминал занят», и пользователь увидел бы ложное «недоступно»."""
        # Сумму считает сервер по настройкам печати, а не из тела запроса.
        sheets, amount = compute_price(page_count, settings)

        async with self._lock:
            existing = self._by_code.get(code)
            # Переиспользуем всё, кроме окончательно проваленного (fail) — тот можно перезапустить.
            if existing is not None and existing.status != "fail":
                return existing

            data = await self.pos.start_payment(amount)
            process_id = str(data.get("processId") or "")
            if not process_id:
                raise KaspiError("терминал не вернул processId")

            payment = Payment(
                code=code,
                process_id=process_id,
                amount=amount,
                sheets=sheets,
                settings=settings,
                status=data.get("status", "wait"),
            )
            self._by_code[code] = payment
            self._by_process[process_id] = payment

        log.info("оплата начата: code=%s pid=%s amount=%s", code, process_id, amount)
        return payment

    async def poll(self, process_id: str) -> Payment:
        """Опрос статуса. Финальный статус отдаём из кэша (не дёргаем терминал).
        При unknown — сами актуализируем (не чаще раза в 10 сек)."""
        async with self._lock:
            payment = self._by_process.get(process_id)
        if payment is None:
            raise KaspiError("платёж не найден")
        if payment.is_final:
            return payment

        data = await self.pos.get_status(process_id)
        self._apply(payment, data)

        if payment.status == "unknown":
            now = time.time()
            if now - payment.last_actualize >= ACTUALIZE_MIN_INTERVAL:
                payment.last_actualize = now
                try:
                    self._apply(payment, await self.pos.actualize(process_id))
                except KaspiError as exc:
                    log.warning("actualize pid=%s: %s", process_id, exc)
        return payment

    @staticmethod
    def _apply(payment: Payment, data: dict) -> None:
        """Переносит свежие данные из ответа терминала в карточку платежа."""
        payment.status = data.get("status", payment.status)
        payment.sub_status = data.get("subStatus", payment.sub_status)
        payment.message = data.get("message")
        cheque = data.get("chequeInfo") or {}
        if cheque:
            payment.method = cheque.get("method", payment.method)
            payment.transaction_id = (
                cheque.get("orderNumber") or cheque.get("rrn") or payment.transaction_id
            )
        if payment.status == "success":
            payment.paid = True


# Синглтон на весь процесс (как store/state в проекте).
payment_service = PaymentService()


# ──────────────────────────────────────────────────────────────────────────
# CLI: регистрация кассы и проверка связи
#   python -m backend.kaspi_pos register   — разовая регистрация
#   python -m backend.kaspi_pos info       — проверить доступ (deviceinfo)
#   python -m backend.kaspi_pos revoke     — обновить токен вручную

if __name__ == "__main__":
    import sys

    logging.basicConfig(level=logging.INFO, format="%(levelname)s %(message)s")
    command = sys.argv[1] if len(sys.argv) > 1 else "info"
    pos = KaspiPOS()
    print(f"Терминал: {pos.base_url}  имя кассы: {pos.name}")
    try:
        if command == "register":
            print("Нажмите «Разрешить» на экране терминала после запроса доступа…")
            print(json.dumps(asyncio.run(pos.register()), ensure_ascii=False, indent=2))
            print("OK — токены сохранены в", TOKEN_FILE)
        elif command == "revoke":
            print(json.dumps(asyncio.run(pos._revoke()), ensure_ascii=False, indent=2))
        else:
            print(json.dumps(asyncio.run(pos.device_info()), ensure_ascii=False, indent=2))
    except KaspiError as exc:
        print("Ошибка:", exc)
        sys.exit(1)
