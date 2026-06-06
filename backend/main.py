import asyncio
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI, File, Form, Header, HTTPException, Request, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse

from .config import (
    ALLOWED_EXTENSIONS,
    ALLOWED_MIME_TYPES,
    CORS_ORIGINS,
    MAX_FILE_SIZE,
    UPLOAD_TOKEN,
)
from .bundle import merge_to_single_pdf
from .kaspi_pos import KaspiError, payment_service
from .kiosk_state import state as kiosk_state
from .pdf_pages import count_pdf_pages
from .print_job import PrintError, PrintRequest, run_print_job
from .sessions import store
from .word_to_pdf import convert_word_to_pdf

# Простой токен для админских эндпойнтов; в продакшене лучше env-var.
ADMIN_TOKEN = "admin-secret-change-me"


@asynccontextmanager
async def lifespan(app: FastAPI):
    cleanup_task = asyncio.create_task(store.cleanup_loop())
    try:
        yield
    finally:
        cleanup_task.cancel()
        try:
            await cleanup_task
        except asyncio.CancelledError:
            pass


app = FastAPI(title="AU Copy backend", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
    allow_credentials=False,
    allow_methods=["GET", "POST", "DELETE", "OPTIONS"],
    allow_headers=["*"],
)


@app.get("/api/health")
async def health() -> dict:
    return {"ok": True}


@app.post("/api/upload")
async def upload(
    file: UploadFile = File(...),
    file_name: str | None = Form(default=None),
    x_upload_token: str | None = Header(default=None, alias="X-Upload-Token"),
) -> JSONResponse:
    if x_upload_token != UPLOAD_TOKEN:
        raise HTTPException(status_code=401, detail="invalid upload token")

    original_name = (file_name or file.filename or "document").strip()
    suffix = Path(original_name).suffix.lower()

    if suffix not in ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=400,
            detail=f"unsupported extension '{suffix}', expected pdf/doc/docx",
        )

    mime = file.content_type or "application/octet-stream"
    # Нормализуем MIME по расширению — Telegram иногда присылает generic mime.
    _ext_to_mime = {
        ".pdf": "application/pdf",
        ".doc": "application/msword",
        ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        ".jpg": "image/jpeg",
        ".jpeg": "image/jpeg",
        ".png": "image/png",
        ".bmp": "image/bmp",
        ".webp": "image/webp",
        ".tiff": "image/tiff",
        ".tif": "image/tiff",
        ".gif": "image/gif",
    }
    if suffix in _ext_to_mime:
        mime = _ext_to_mime[suffix]

    data = await file.read()
    if len(data) == 0:
        raise HTTPException(status_code=400, detail="empty file")
    if len(data) > MAX_FILE_SIZE:
        raise HTTPException(status_code=413, detail="file too large")

    if suffix in (".doc", ".docx"):
        try:
            data, original_name = await convert_word_to_pdf(data, original_name)
        except Exception as exc:
            raise HTTPException(
                status_code=500,
                detail=f"не удалось конвертировать Word в PDF: {exc}",
            )
        mime = "application/pdf"
        suffix = ".pdf"

    _image_exts = {".jpg", ".jpeg", ".png", ".bmp", ".webp", ".tiff", ".tif", ".gif"}
    page_count = count_pdf_pages(data) if suffix == ".pdf" else (1 if suffix in _image_exts else None)

    session = await store.create(
        file_bytes=data,
        file_name=original_name,
        mime_type=mime,
        page_count=page_count,
    )
    return JSONResponse(session.to_public())


@app.post("/api/upload-batch")
async def upload_batch(
    files: list[UploadFile] = File(...),
    x_upload_token: str | None = Header(default=None, alias="X-Upload-Token"),
) -> JSONResponse:
    """Приём пачки файлов под один код: каждый файл приводится к PDF и всё
    склеивается в один документ. Используется ботом в режиме /multi."""
    if x_upload_token != UPLOAD_TOKEN:
        raise HTTPException(status_code=401, detail="invalid upload token")
    if not files:
        raise HTTPException(status_code=400, detail="no files")

    items: list[tuple[bytes, str]] = []
    names: list[str] = []
    for f in files:
        original_name = (f.filename or "document").strip()
        suffix = Path(original_name).suffix.lower()
        if suffix not in ALLOWED_EXTENSIONS:
            raise HTTPException(
                status_code=400,
                detail=f"unsupported extension '{suffix}' ({original_name})",
            )
        data = await f.read()
        if len(data) == 0:
            raise HTTPException(status_code=400, detail=f"empty file: {original_name}")
        if len(data) > MAX_FILE_SIZE:
            raise HTTPException(status_code=413, detail=f"file too large: {original_name}")
        items.append((data, original_name))
        names.append(original_name)

    try:
        merged_bytes, page_count = await merge_to_single_pdf(items)
    except Exception as exc:
        raise HTTPException(
            status_code=500, detail=f"не удалось собрать файлы в один PDF: {exc}"
        )

    display_name = names[0] if len(names) == 1 else f"{names[0]} + ещё {len(names) - 1}"

    session = await store.create(
        file_bytes=merged_bytes,
        file_name=display_name,
        mime_type="application/pdf",
        page_count=page_count,
        suffix=".pdf",
    )
    payload = session.to_public()
    payload["fileCount"] = len(names)
    return JSONResponse(payload)


@app.get("/api/file/{code}")
async def file_info(code: str) -> JSONResponse:
    session = await store.get(code)
    if session is None:
        raise HTTPException(status_code=404, detail="session not found or expired")
    return JSONResponse(session.to_public())


@app.post("/api/print/{code}")
async def print_file(code: str, req: PrintRequest) -> JSONResponse:
    session = await store.get(code)
    if session is None:
        raise HTTPException(status_code=404, detail="session not found or expired")
    try:
        result = await run_print_job(session.file_path, req)
    except PrintError as exc:
        await kiosk_state.record_error(str(exc), {"code": code})
        await kiosk_state.record_job(
            sheets=0, mode="error", file_name=session.file_name,
            settings=req.model_dump(), error=str(exc),
        )
        raise HTTPException(status_code=500, detail=str(exc))

    # Учёт бумаги — только реальный принтер тратит.
    if result.get("mode") == "printer" and result.get("sheets"):
        await kiosk_state.consume_paper(result["sheets"] * max(1, req.copies))

    await kiosk_state.record_job(
        sheets=result.get("sheets", 0) * max(1, req.copies),
        mode=result.get("mode", "?"),
        file_name=session.file_name,
        settings=req.model_dump(),
    )
    return JSONResponse({"ok": True, **result})


# ── Оплата через Kaspi Smart POS ───────────────────────────────────────

@app.get("/api/kaspi/health")
async def kaspi_health() -> JSONResponse:
    """Доступен ли терминал (для Screen4). Не падает при офлайне."""
    try:
        info = await payment_service.pos.device_info()
        return JSONResponse({"ok": True, "terminalId": info.get("terminalId")})
    except KaspiError as exc:
        return JSONResponse({"ok": False, "error": str(exc)})


@app.post("/api/kaspi/pay")
async def kaspi_pay(body: dict) -> JSONResponse:
    """Старт оплаты по коду. Сумму считает сервер по настройкам печати —
    присланной фронтом сумме не доверяем. Идемпотентно (один код = один платёж)."""
    code = (body.get("code") or "").strip()
    session = await store.get(code)
    if session is None:
        raise HTTPException(status_code=404, detail="session not found or expired")
    settings = body.get("settings") or {}
    try:
        payment = await payment_service.start(session.code, session.page_count, settings)
    except KaspiError as exc:
        return JSONResponse({"ok": False, "error": str(exc)})
    return JSONResponse({
        "ok": True,
        "processId": payment.process_id,
        "amount": payment.amount,
        "status": payment.status,
    })


@app.get("/api/kaspi/status/{process_id}")
async def kaspi_status(process_id: str) -> JSONResponse:
    """Опрос статуса (фронт зовёт ~1 раз/сек). При unknown сервер сам актуализирует."""
    try:
        payment = await payment_service.poll(process_id)
    except KaspiError as exc:
        raise HTTPException(status_code=404, detail=str(exc))
    return JSONResponse({
        "status": payment.status,
        "subStatus": payment.sub_status,
        "method": payment.method,
        "message": payment.message,
        "amount": payment.amount,
        "paid": payment.paid,
    })


# ── Админские эндпойнты ────────────────────────────────────────────────

def _check_admin(token: str | None) -> None:
    if token != ADMIN_TOKEN:
        raise HTTPException(status_code=401, detail="invalid admin token")


@app.get("/api/kiosk/status")
async def kiosk_status() -> JSONResponse:
    """Публичный статус для индикатора на Screen1 — без секретов."""
    snap = await kiosk_state.snapshot()
    # Урезаем чувствительное для публичного эндпойнта
    return JSONResponse({
        "paper": snap["paper"],
        "printer": snap["runtime"]["printer"],
        "gsAvailable": snap["runtime"]["gsAvailable"],
        "jobsToday": snap["jobs"]["today"],
    })


@app.get("/api/admin/status")
async def admin_status(
    x_admin_token: str | None = Header(default=None, alias="X-Admin-Token"),
) -> JSONResponse:
    _check_admin(x_admin_token)
    return JSONResponse(await kiosk_state.snapshot())


@app.post("/api/admin/refill")
async def admin_refill(
    body: dict,
    x_admin_token: str | None = Header(default=None, alias="X-Admin-Token"),
) -> JSONResponse:
    _check_admin(x_admin_token)
    total = body.get("total")
    paper = await kiosk_state.refill_paper(total)
    return JSONResponse({"ok": True, "paper": paper})


@app.post("/api/admin/reset-today")
async def admin_reset_today(
    x_admin_token: str | None = Header(default=None, alias="X-Admin-Token"),
) -> JSONResponse:
    _check_admin(x_admin_token)
    await kiosk_state.reset_today()
    return JSONResponse({"ok": True})


# ── Отчёты об ошибках от пользователей ────────────────────────────────

@app.post("/api/error-report")
async def submit_error_report(body: dict, request: Request) -> JSONResponse:
    """Публичный эндпойнт с rate-limit. Принимает: category, description, lang, screen."""
    ip = request.client.host if request.client else "unknown"
    # X-Forwarded-For если за прокси
    fwd = request.headers.get("x-forwarded-for")
    if fwd:
        ip = fwd.split(",")[0].strip() or ip
    try:
        entry = await kiosk_state.add_report(
            category=body.get("category", ""),
            description=body.get("description", ""),
            ip=ip,
            lang=body.get("lang", "ru"),
            screen=body.get("screen"),
        )
        return JSONResponse({"ok": True, "id": entry["id"]})
    except ValueError as exc:
        raise HTTPException(status_code=429, detail=str(exc))


@app.get("/api/admin/reports")
async def admin_get_reports(
    x_admin_token: str | None = Header(default=None, alias="X-Admin-Token"),
) -> JSONResponse:
    _check_admin(x_admin_token)
    snap = await kiosk_state.snapshot()
    return JSONResponse({"reports": snap.get("reports", [])})


@app.post("/api/admin/reports/{report_id}/resolve")
async def admin_resolve_report(
    report_id: int,
    x_admin_token: str | None = Header(default=None, alias="X-Admin-Token"),
) -> JSONResponse:
    _check_admin(x_admin_token)
    ok = await kiosk_state.resolve_report(report_id)
    if not ok:
        raise HTTPException(status_code=404, detail="отчёт не найден")
    return JSONResponse({"ok": True})


@app.delete("/api/file/{code}")
async def file_delete(code: str) -> JSONResponse:
    deleted = await store.delete(code)
    return JSONResponse({"deleted": deleted})


@app.get("/api/file/{code}/download")
async def file_download(code: str) -> FileResponse:
    session = await store.get(code)
    if session is None:
        raise HTTPException(status_code=404, detail="session not found or expired")
    return FileResponse(
        path=session.file_path,
        media_type=session.mime_type,
        filename=session.file_name,
        content_disposition_type="inline",
    )
