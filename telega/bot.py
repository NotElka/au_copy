import asyncio
import io
import logging
from pathlib import Path

import aiohttp
from aiogram import Bot, Dispatcher, F
from aiogram.filters import Command, CommandStart
from aiogram.types import (
    CallbackQuery,
    InlineKeyboardButton,
    InlineKeyboardMarkup,
    Message,
)

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

# Режим «несколько файлов»: chat_id → {"files": [(bytes, name, mime)], "status_msg": Message}
# Пока чат в этом словаре — присланные файлы копятся, а не грузятся по одному.
collecting: dict[int, dict] = {}

# Авто-объединение «альбомов»: когда пользователь выделяет несколько файлов и
# отправляет одной пачкой, они приходят отдельными сообщениями с общим
# media_group_id. Копим их по gid и сбрасываем (грузим как один документ) через
# короткий дебаунс после последнего файла пачки.
media_groups: dict[str, dict] = {}
MEDIA_GROUP_DEBOUNCE = 1.5  # сек ожидания следующего файла из той же пачки


def _multi_keyboard() -> InlineKeyboardMarkup:
    return InlineKeyboardMarkup(inline_keyboard=[[
        InlineKeyboardButton(text="✅ Готово", callback_data="multi_done"),
        InlineKeyboardButton(text="✖️ Отмена", callback_data="multi_cancel"),
    ]])


async def _download_to_bytes(file_obj) -> bytes:
    buffer = io.BytesIO()
    await bot.download(file_obj, destination=buffer)
    buffer.seek(0)
    return buffer.read()


async def _update_multi_status(chat_id: int, anchor: Message) -> None:
    """Обновляет (или создаёт) сообщение-счётчик собранных файлов с кнопками."""
    state = collecting.get(chat_id)
    if state is None:
        return
    files = state["files"]
    listing = "\n".join(f"• {name}" for (_, name, _) in files[-10:])
    more = "" if len(files) <= 10 else f"\n… и ещё {len(files) - 10}"
    text = (
        f"📥 Собрано файлов: <b>{len(files)}</b>\n{listing}{more}\n\n"
        "Пришлите ещё файлы или нажмите ✅ Готово."
    )
    msg = state.get("status_msg")
    if msg is None:
        state["status_msg"] = await anchor.answer(
            text, parse_mode="HTML", reply_markup=_multi_keyboard()
        )
        return
    try:
        await msg.edit_text(text, parse_mode="HTML", reply_markup=_multi_keyboard())
    except Exception:
        state["status_msg"] = await anchor.answer(
            text, parse_mode="HTML", reply_markup=_multi_keyboard()
        )


async def _clear_multi_keyboard(state: dict) -> None:
    msg = state.get("status_msg") if state else None
    if msg is not None:
        try:
            await msg.edit_reply_markup(reply_markup=None)
        except Exception:
            pass


async def _finish_multi(chat_id: int, anchor: Message) -> None:
    state = collecting.pop(chat_id, None)
    if not state or not state["files"]:
        await anchor.answer(
            "Пока нет файлов. Пришлите файлы, затем нажмите ✅ Готово, или /cancel."
        )
        return
    await _clear_multi_keyboard(state)
    await _upload_batch_to_backend(anchor, state["files"])


async def _upload_batch_to_backend(
    anchor: Message, files: list[tuple[bytes, str, str]], status: Message | None = None
) -> None:
    text = f"⏳ Загружаю {len(files)} файлов и собираю в один документ…"
    if status is None:
        status = await anchor.answer(text)
    else:
        try:
            await status.edit_text(text)
        except Exception:
            pass
    try:
        async with aiohttp.ClientSession() as http:
            form = aiohttp.FormData()
            for data, name, mime in files:
                form.add_field("files", data, filename=name, content_type=mime)
            async with http.post(
                f"{BACKEND_URL}/api/upload-batch",
                data=form,
                headers={"X-Upload-Token": UPLOAD_TOKEN},
                timeout=aiohttp.ClientTimeout(total=120),
            ) as resp:
                if resp.status != 200:
                    detail = await resp.text()
                    log.error("batch upload failed %s: %s", resp.status, detail)
                    await status.edit_text(f"⚠️ Backend ответил {resp.status}. Попробуйте позже.")
                    return
                payload = await resp.json()
    except aiohttp.ClientError:
        log.exception("backend connection failed")
        await status.edit_text("⚠️ Не удалось связаться с сервером AU Copy. Сообщите администратору.")
        return

    code = payload["code"]
    n = payload.get("fileCount", len(files))
    await status.edit_text(
        f"✅ Принято файлов: <b>{n}</b> — собраны в один документ.\n\n"
        f"🔑 Ваш код: <code>{code}</code>\n\n"
        f"Введите код на терминале AU Copy.\n⏱ Действует 30 минут.",
        parse_mode="HTML",
    )


async def _media_group_add(message: Message, data: bytes, name: str, mime: str) -> None:
    """Копит файл из «альбома» (общий media_group_id) и взводит дебаунс-таймер.
    Каждый новый файл пачки перезапускает таймер; когда он отработает без новых
    файлов — пачка уходит на склейку как один документ."""
    gid = message.media_group_id
    grp = media_groups.get(gid)
    if grp is None:
        status = await message.answer("📥 Получаю файлы…")
        grp = {"files": [], "status_msg": status, "task": None}
        media_groups[gid] = grp
    grp["files"].append((message.message_id, data, name, mime))
    if grp.get("task"):
        grp["task"].cancel()
    grp["task"] = asyncio.create_task(_media_group_flush_later(gid, message))


async def _media_group_flush_later(gid: str, anchor: Message) -> None:
    try:
        await asyncio.sleep(MEDIA_GROUP_DEBOUNCE)
    except asyncio.CancelledError:
        return  # пришёл ещё файл из этой пачки — таймер перезапущен
    grp = media_groups.pop(gid, None)
    if not grp or not grp["files"]:
        return
    ordered = sorted(grp["files"], key=lambda x: x[0])  # по message_id — гарантируем порядок
    files = [(d, n, m) for (_mid, d, n, m) in ordered]
    await _upload_batch_to_backend(anchor, files, status=grp.get("status_msg"))


@dp.message(CommandStart())
async def cmd_start(message: Message) -> None:
    await message.answer(
        "👋 Привет! Я бот <b>AU Copy</b>.\n\n"
        "Отправьте мне файл <b>PDF</b>, <b>Word</b> (.doc / .docx) или <b>фото</b> (.jpg / .png и др.), "
        "и я выдам код сессии. Введите этот код на терминале — файл откроется для печати.\n\n"
        "📎 Несколько файлов в одну печать — команда /multi.\n\n"
        "⏱ Код действует 30 минут.",
        parse_mode="HTML",
    )


@dp.message(Command("help"))
async def cmd_help(message: Message) -> None:
    await message.answer(
        "Отправьте файл (PDF / DOC / DOCX / JPG / PNG и др.) как документ — в ответ придёт код.\n"
        "Фото можно отправить и напрямую (без прикрепления как файл), но качество будет ниже.\n\n"
        "📎 /multi — режим нескольких файлов: пришлите несколько файлов и нажмите «Готово», "
        "они склеятся в один документ под одним кодом."
    )


@dp.message(Command("multi"))
async def cmd_multi(message: Message) -> None:
    chat_id = message.chat.id
    collecting[chat_id] = {"files": [], "status_msg": None}
    sent = await message.answer(
        "📎 <b>Режим нескольких файлов включён.</b>\n\n"
        "Присылайте файлы по одному (PDF, Word, фото) — я соберу их в один документ "
        "в порядке отправки. Когда закончите — нажмите ✅ Готово.",
        parse_mode="HTML",
        reply_markup=_multi_keyboard(),
    )
    collecting[chat_id]["status_msg"] = sent


@dp.message(Command("done"))
async def cmd_done(message: Message) -> None:
    await _finish_multi(message.chat.id, message)


@dp.message(Command("cancel"))
async def cmd_cancel(message: Message) -> None:
    state = collecting.pop(message.chat.id, None)
    await _clear_multi_keyboard(state)
    await message.answer(
        "Режим нескольких файлов выключен." if state else "Сейчас нечего отменять."
    )


@dp.callback_query(F.data == "multi_done")
async def cb_multi_done(cq: CallbackQuery) -> None:
    await cq.answer()
    await _finish_multi(cq.message.chat.id, cq.message)


@dp.callback_query(F.data == "multi_cancel")
async def cb_multi_cancel(cq: CallbackQuery) -> None:
    await cq.answer("Отменено")
    state = collecting.pop(cq.message.chat.id, None)
    await _clear_multi_keyboard(state)
    await cq.message.answer("Режим нескольких файлов выключен.")


@dp.message(F.photo)
async def handle_photo(message: Message) -> None:
    """Принимает сжатое фото (не как файл). Качество хуже — предупреждаем."""
    photo = message.photo[-1]  # наибольший размер
    if photo.file_size and photo.file_size > MAX_FILE_SIZE:
        await message.reply("❌ Фото слишком большое. Максимум — 25 МБ.")
        return

    # Режим /multi: копим файл в буфер вместо немедленной загрузки.
    if message.chat.id in collecting:
        try:
            data = await _download_to_bytes(photo)
        except Exception:
            log.exception("photo download failed")
            await message.reply("⚠️ Не удалось скачать фото. Попробуйте ещё раз.")
            return
        file_name = f"photo_{photo.file_unique_id}.jpg"
        collecting[message.chat.id]["files"].append((data, file_name, "image/jpeg"))
        await _update_multi_status(message.chat.id, message)
        return

    # Авто-объединение: фото отправлены одной пачкой (альбом).
    if message.media_group_id:
        try:
            data = await _download_to_bytes(photo)
        except Exception:
            log.exception("photo download failed")
            await message.reply("⚠️ Не удалось скачать фото. Попробуйте ещё раз.")
            return
        file_name = f"photo_{photo.file_unique_id}.jpg"
        await _media_group_add(message, data, file_name, "image/jpeg")
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

    # Режим /multi: копим файл в буфер вместо немедленной загрузки.
    if message.chat.id in collecting:
        try:
            data = await _download_to_bytes(doc)
        except Exception:
            log.exception("download failed")
            await message.reply("⚠️ Не удалось скачать файл из Telegram. Попробуйте ещё раз.")
            return
        mime = doc.mime_type or "application/octet-stream"
        collecting[message.chat.id]["files"].append((data, file_name, mime))
        await _update_multi_status(message.chat.id, message)
        return

    # Авто-объединение: файлы отправлены одной пачкой (альбом).
    if message.media_group_id:
        try:
            data = await _download_to_bytes(doc)
        except Exception:
            log.exception("download failed")
            await message.reply("⚠️ Не удалось скачать файл из Telegram. Попробуйте ещё раз.")
            return
        mime = doc.mime_type or "application/octet-stream"
        await _media_group_add(message, data, file_name, mime)
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
