"""WhatsApp-бот для AU Copy на базе WhatsApp Cloud API (Meta).

Делает то же, что Telegram-бот (telega/bot.py), только через WhatsApp:
  1. ловит файл/фото из WhatsApp (через вебхук от Meta),
  2. скачивает его (Graph API),
  3. грузит на тот же бэкенд: POST /api/upload c заголовком X-Upload-Token,
  4. отправляет пользователю код сессии для печати на терминале.

WhatsApp присылает входящие сообщения на ВЕБХУК — значит сервису нужен
публичный HTTPS-адрес (cloudflared/ngrok). Подробности — whatsapp/README.md.

Запуск: python -m whatsapp.run   (uvicorn на :8001)
"""
import asyncio
import hashlib
import hmac
import logging
from pathlib import Path

import httpx
from fastapi import FastAPI, Request
from fastapi.responses import PlainTextResponse, Response

from . import config as cfg

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
log = logging.getLogger("aucopy-whatsapp")

app = FastAPI(title="AU Copy WhatsApp bot")

# Meta повторно шлёт вебхук, если не ответить 200 быстро. Чтобы не обработать одно
# сообщение дважды — помним ID уже обработанных (в памяти, с простой обрезкой).
_seen_messages: set[str] = set()
_SEEN_LIMIT = 1000


def _remember(msg_id: str) -> bool:
    """True — сообщение новое (нужно обработать); False — уже видели (повтор)."""
    if not msg_id:
        return True
    if msg_id in _seen_messages:
        return False
    if len(_seen_messages) >= _SEEN_LIMIT:
        _seen_messages.clear()
    _seen_messages.add(msg_id)
    return True


# ──────────────────────────────────────────────────────────────────────────
# Вебхук

@app.get("/webhook")
async def verify(request: Request) -> PlainTextResponse:
    """Подтверждение вебхука при настройке в Meta (вызывается один раз).
    Meta присылает hub.challenge — его надо вернуть как есть, если токен совпал."""
    params = request.query_params
    mode = params.get("hub.mode")
    token = params.get("hub.verify_token")
    challenge = params.get("hub.challenge")
    if mode == "subscribe" and token == cfg.VERIFY_TOKEN:
        log.info("webhook verified ok")
        return PlainTextResponse(challenge or "")
    log.warning("webhook verify FAILED (mode=%s, token_ok=%s)", mode, token == cfg.VERIFY_TOKEN)
    return PlainTextResponse("forbidden", status_code=403)


@app.post("/webhook")
async def incoming(request: Request) -> Response:
    """Входящие события от WhatsApp. Отвечаем 200 сразу, обрабатываем в фоне —
    иначе Meta сочтёт вебхук медленным и зашлёт повтор."""
    body = await request.body()
    if not _valid_signature(body, request.headers.get("X-Hub-Signature-256")):
        log.warning("bad webhook signature")
        return Response(status_code=403)

    try:
        data = await request.json()
    except Exception:
        return Response(status_code=200)  # не JSON — игнорируем, но подтверждаем

    asyncio.create_task(_process(data))
    return Response(status_code=200)


def _valid_signature(body: bytes, header: str | None) -> bool:
    """Проверка подписи X-Hub-Signature-256. Если APP_SECRET не задан — пропускаем."""
    if not cfg.APP_SECRET:
        return True
    if not header or not header.startswith("sha256="):
        return False
    expected = hmac.new(cfg.APP_SECRET.encode(), body, hashlib.sha256).hexdigest()
    return hmac.compare_digest(expected, header.split("=", 1)[1])


# ──────────────────────────────────────────────────────────────────────────
# Обработка сообщений

async def _process(data: dict) -> None:
    try:
        for entry in data.get("entry", []):
            for change in entry.get("changes", []):
                value = change.get("value", {})
                for message in value.get("messages", []):
                    await _handle_message(message)
    except Exception:
        log.exception("processing webhook failed")


async def _handle_message(message: dict) -> None:
    msg_id = message.get("id", "")
    if not _remember(msg_id):
        return  # повтор от Meta — уже обработали
    sender = message.get("from")
    mtype = message.get("type")

    if mtype == "document":
        doc = message.get("document", {})
        media_id = doc.get("id")
        mime = doc.get("mime_type") or "application/octet-stream"
        filename = doc.get("filename") or _name_from_mime(mime, media_id)
    elif mtype == "image":
        img = message.get("image", {})
        media_id = img.get("id")
        mime = img.get("mime_type") or "image/jpeg"
        filename = _name_from_mime(mime, media_id)
    else:
        await _send_text(
            sender,
            "👋 Это бот AU Copy.\n\nПришлите файл PDF, Word (.doc/.docx) или фото — "
            "в ответ придёт код. Введите его на терминале AU Copy для печати.",
        )
        return

    if not media_id:
        await _send_text(sender, "⚠️ Не удалось распознать вложение. Попробуйте ещё раз.")
        return

    suffix = Path(filename).suffix.lower()
    if suffix not in cfg.ALLOWED_EXTENSIONS:
        await _send_text(
            sender,
            f"❌ Формат {suffix or 'неизвестный'} не поддерживается.\n"
            "Пришлите PDF, Word (.doc/.docx) или фото.",
        )
        return

    await _send_text(sender, "⏳ Обрабатываю файл…")

    try:
        file_bytes = await _download_media(media_id)
    except Exception:
        log.exception("media download failed")
        await _send_text(sender, "⚠️ Не удалось скачать файл из WhatsApp. Попробуйте ещё раз.")
        return

    if len(file_bytes) == 0:
        await _send_text(sender, "⚠️ Пустой файл. Попробуйте ещё раз.")
        return
    if len(file_bytes) > cfg.MAX_FILE_SIZE:
        await _send_text(sender, "❌ Файл слишком большой. Максимум — 25 МБ.")
        return

    try:
        code = await _upload_to_backend(file_bytes, filename, mime)
    except Exception:
        log.exception("backend upload failed")
        await _send_text(sender, "⚠️ Не удалось связаться с сервером AU Copy. Сообщите администратору.")
        return

    await _send_text(
        sender,
        f"✅ Файл принят: {filename}\n\n"
        f"🔑 Ваш код: {code}\n\n"
        f"Введите код на терминале AU Copy.\n⏱ Действует 30 минут.",
    )


def _name_from_mime(mime: str | None, media_id: str | None) -> str:
    """Синтезирует имя файла с правильным расширением (фото из WhatsApp без имени)."""
    ext = cfg.MIME_TO_EXT.get(mime or "", "")
    return f"wa_{media_id or 'file'}{ext or '.bin'}"


# ──────────────────────────────────────────────────────────────────────────
# Graph API: скачивание медиа и отправка ответа

async def _download_media(media_id: str) -> bytes:
    """Двухшаговое скачивание Cloud API: media_id → временный url → байты.
    Оба запроса требуют Bearer-токен."""
    headers = {"Authorization": f"Bearer {cfg.ACCESS_TOKEN}"}
    async with httpx.AsyncClient(timeout=60) as http:
        meta = await http.get(f"{cfg.GRAPH_BASE}/{media_id}", headers=headers)
        meta.raise_for_status()
        url = meta.json()["url"]
        resp = await http.get(url, headers=headers)
        resp.raise_for_status()
        return resp.content


async def _upload_to_backend(file_bytes: bytes, filename: str, mime: str) -> str:
    """Грузит файл на бэкенд AU Copy и возвращает код сессии."""
    async with httpx.AsyncClient(timeout=120) as http:
        resp = await http.post(
            f"{cfg.BACKEND_URL}/api/upload",
            files={"file": (filename, file_bytes, mime)},
            data={"file_name": filename},
            headers={"X-Upload-Token": cfg.UPLOAD_TOKEN},
        )
        resp.raise_for_status()
        return resp.json()["code"]


async def _send_text(to: str | None, text: str) -> None:
    """Отправляет текстовое сообщение пользователю через Cloud API."""
    if not to:
        return
    payload = {
        "messaging_product": "whatsapp",
        "to": to,
        "type": "text",
        "text": {"body": text},
    }
    try:
        async with httpx.AsyncClient(timeout=30) as http:
            resp = await http.post(
                f"{cfg.GRAPH_BASE}/{cfg.PHONE_NUMBER_ID}/messages",
                headers={"Authorization": f"Bearer {cfg.ACCESS_TOKEN}"},
                json=payload,
            )
            if resp.status_code >= 400:
                log.error("send message failed %s: %s", resp.status_code, resp.text)
    except Exception:
        log.exception("send message failed")


@app.get("/health")
async def health() -> dict:
    return {"ok": True, "service": "whatsapp-bot"}
