import asyncio
import io
import logging
from pathlib import Path

import aiohttp
from aiogram import Bot, Dispatcher, F
from aiogram.filters import Command, CommandStart
from aiogram.types import Message

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
log = logging.getLogger("aucopy-bot")

BASE_DIR = Path(__file__).resolve().parent
TOKEN_FILE = BASE_DIR / "token.txt"
BACKEND_URL = "http://127.0.0.1:8000"
UPLOAD_TOKEN = "dev-secret-change-me"  # должен совпадать с backend/config.py

ALLOWED_EXTENSIONS = {".pdf", ".doc", ".docx", ".jpg", ".jpeg", ".png", ".bmp", ".webp", ".tiff", ".tif", ".gif"}
MAX_FILE_SIZE = 25 * 1024 * 1024


def read_token() -> str:
    raw = TOKEN_FILE.read_bytes()
    # token.txt может быть в UTF-16 BOM (создан через PowerShell) — пробуем разные кодировки.
    for enc in ("utf-8-sig", "utf-16", "utf-8"):
        try:
            text = raw.decode(enc)
            break
        except UnicodeDecodeError:
            continue
    else:
        text = raw.decode("utf-8", errors="ignore")
    # Иногда внутри много нулевых байт/пробелов между символами — чистим.
    token = "".join(ch for ch in text if not ch.isspace() and ch != "\x00")
    if not token:
        raise RuntimeError("token.txt is empty")
    return token


bot = Bot(token=read_token())
dp = Dispatcher()


@dp.message(CommandStart())
async def cmd_start(message: Message) -> None:
    await message.answer(
        "👋 Привет! Я бот <b>AU Copy</b>.\n\n"
        "Отправьте мне файл <b>PDF</b>, <b>Word</b> (.doc / .docx) или <b>фото</b> (.jpg / .png и др.), "
        "и я выдам код сессии. Введите этот код на терминале — файл откроется для печати.\n\n"
        "⏱ Код действует 30 минут.",
        parse_mode="HTML",
    )


@dp.message(Command("help"))
async def cmd_help(message: Message) -> None:
    await message.answer(
        "Отправьте файл (PDF / DOC / DOCX / JPG / PNG и др.) как документ — в ответ придёт код.\n"
        "Фото можно отправить и напрямую (без прикрепления как файл), но качество будет ниже."
    )


@dp.message(F.photo)
async def handle_photo(message: Message) -> None:
    """Принимает сжатое фото (не как файл). Качество хуже — предупреждаем."""
    photo = message.photo[-1]  # наибольший размер
    if photo.file_size and photo.file_size > MAX_FILE_SIZE:
        await message.reply("❌ Фото слишком большое. Максимум — 25 МБ.")
        return

    status = await message.reply(
        "⚠️ Фото получено в сжатом виде. Для лучшего качества отправьте его как <b>файл</b> (📎 → Файл).\n\n"
        "⏳ Обрабатываю…",
        parse_mode="HTML",
    )

    try:
        buffer = io.BytesIO()
        await bot.download(photo, destination=buffer)
        buffer.seek(0)
        data = buffer.read()
    except Exception:
        log.exception("photo download failed")
        await status.edit_text("⚠️ Не удалось скачать фото. Попробуйте ещё раз.")
        return

    file_name = f"photo_{photo.file_unique_id}.jpg"
    await _upload_to_backend(message, status, data, file_name, "image/jpeg")


async def _upload_to_backend(message: Message, status, data: bytes, file_name: str, mime_type: str) -> None:
    try:
        async with aiohttp.ClientSession() as http:
            form = aiohttp.FormData()
            form.add_field("file", data, filename=file_name, content_type=mime_type)
            form.add_field("file_name", file_name)
            async with http.post(
                f"{BACKEND_URL}/api/upload",
                data=form,
                headers={"X-Upload-Token": UPLOAD_TOKEN},
                timeout=aiohttp.ClientTimeout(total=30),
            ) as resp:
                if resp.status != 200:
                    detail = await resp.text()
                    log.error("backend upload failed %s: %s", resp.status, detail)
                    await status.edit_text(f"⚠️ Backend ответил {resp.status}. Попробуйте позже.")
                    return
                payload = await resp.json()
    except aiohttp.ClientError:
        log.exception("backend connection failed")
        await status.edit_text("⚠️ Не удалось связаться с сервером AU Copy. Сообщите администратору.")
        return

    code = payload["code"]
    await status.edit_text(
        f"✅ Файл принят: <b>{file_name}</b>\n\n"
        f"🔑 Ваш код: <code>{code}</code>\n\n"
        f"Введите код на терминале AU Copy.\n"
        f"⏱ Действует 30 минут.",
        parse_mode="HTML",
    )


@dp.message(F.document)
async def handle_document(message: Message) -> None:
    doc = message.document
    if doc is None:
        return

    file_name = doc.file_name or "document"
    suffix = Path(file_name).suffix.lower()

    if suffix not in ALLOWED_EXTENSIONS:
        await message.reply(
            f"❌ Формат <b>{suffix or 'неизвестный'}</b> не поддерживается.\n"
            "Отправьте файл PDF, DOC или DOCX.",
            parse_mode="HTML",
        )
        return

    if doc.file_size and doc.file_size > MAX_FILE_SIZE:
        await message.reply("❌ Файл слишком большой. Максимум — 25 МБ.")
        return

    status = await message.reply("⏳ Обрабатываю файл…")

    try:
        buffer = io.BytesIO()
        await bot.download(doc, destination=buffer)
        buffer.seek(0)
        data = buffer.read()
    except Exception:
        log.exception("download failed")
        await status.edit_text("⚠️ Не удалось скачать файл из Telegram. Попробуйте ещё раз.")
        return

    await _upload_to_backend(message, status, data, file_name, doc.mime_type or "application/octet-stream")


@dp.message()
async def fallback(message: Message) -> None:
    await message.reply(
        "Пришлите файл PDF, Word или фото как документ (значок 📎 → Файл).\n"
        "Фото также можно отправить напрямую."
    )


async def main() -> None:
    log.info("starting bot, backend=%s", BACKEND_URL)
    await bot.delete_webhook(drop_pending_updates=True)
    await dp.start_polling(bot)


if __name__ == "__main__":
    asyncio.run(main())
