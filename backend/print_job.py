"""Печать с pypdf-препроцессингом + Ghostscript на физический принтер.

Pipeline:
    1. Если файл — изображение, оборачиваем в одностраничный PDF (Pillow + pypdf)
    2. pypdf: page-range, поворот страниц под выбранную ориентацию, N-up
       → готовый PDF, где КАЖДЫЙ лист — точно как уйдёт на бумагу
    3. Ghostscript: отправляет PDF на принтер (copies, duplex)

Test-режим: если PRINTER_NAME — виртуальный (Microsoft Print to PDF / XPS / пусто),
шаг 3 заменяется на сохранение PDF в ~/Downloads/au_copy_print/.
"""

import asyncio
import io
import logging
import math
import re
import shutil
import subprocess
import tempfile
from datetime import datetime
from pathlib import Path

from PIL import Image
from pydantic import BaseModel, Field
from pypdf import PageObject, PdfReader, PdfWriter, Transformation

from .config import GS_PATH, PRINTER_NAME

log = logging.getLogger("aucopy-print")

TEST_OUTPUT_DIR = Path.home() / "Downloads" / "au_copy_print"
GS_TIMEOUT_SECONDS = 30

# Стандартный лист A4 в точках (PDF user-space units, 1 pt = 1/72 inch).
A4_PORTRAIT_POINTS = (595.0, 842.0)
A4_LANDSCAPE_POINTS = (842.0, 595.0)
IMAGE_DPI = 200  # для растеризации картинки при конвертации в PDF

IMAGE_EXTS = {".jpg", ".jpeg", ".png", ".bmp", ".gif", ".tiff", ".tif", ".webp"}


class PrintRequest(BaseModel):
    pages: str = "all"            # 'all' | 'range'
    pageRange: str = ""
    copies: int = Field(default=1, ge=1, le=100)
    pagesPerSide: int = 1         # 1 | 2 | 4 (8 пока сводим к 4)
    duplex: bool = False
    orientation: str = "portrait"  # 'portrait' | 'landscape'


class PrintError(Exception):
    pass


# ──────────────────────────────────────────────────────────────────────────
# Утилиты

def _sheet_size(orientation: str) -> tuple[float, float]:
    return A4_LANDSCAPE_POINTS if orientation == "landscape" else A4_PORTRAIT_POINTS


def _is_portrait(w: float, h: float) -> bool:
    return h >= w


def _parse_page_range(s: str, total: int) -> list[int]:
    """'1-3,5,7-9' (1-based) → [0,1,2,4,6,7,8] (0-based, без дублей)."""
    seen: set[int] = set()
    uniq: list[int] = []
    for part in s.split(","):
        part = part.strip()
        if not part:
            continue
        m = re.match(r"^(\d+)\s*-\s*(\d+)$", part)
        if m:
            a, b = int(m.group(1)), int(m.group(2))
            for p in range(min(a, b), max(a, b) + 1):
                if 1 <= p <= total and (p - 1) not in seen:
                    seen.add(p - 1)
                    uniq.append(p - 1)
        else:
            try:
                p = int(part)
                if 1 <= p <= total and (p - 1) not in seen:
                    seen.add(p - 1)
                    uniq.append(p - 1)
            except ValueError:
                pass
    return uniq


# ──────────────────────────────────────────────────────────────────────────
# Image → PDF

def _image_to_pdf(image_path: Path, orientation: str) -> Path:
    """Конвертирует одну картинку в одностраничный PDF на A4 в нужной ориентации.
    Картинка масштабируется и центрируется, поля сохраняют пропорции."""
    img = Image.open(image_path)
    if img.mode not in ("RGB", "L"):
        img = img.convert("RGB")

    sheet_w, sheet_h = _sheet_size(orientation)
    # Растеризуем изображение в пиксели соответствующие странице
    px_w = int(sheet_w * IMAGE_DPI / 72)
    px_h = int(sheet_h * IMAGE_DPI / 72)

    # Масштаб с сохранением пропорций
    img_w, img_h = img.size
    scale = min(px_w / img_w, px_h / img_h)
    new_w = int(img_w * scale)
    new_h = int(img_h * scale)
    img_scaled = img.resize((new_w, new_h), Image.LANCZOS)

    # Белый фон в размер листа, картинка по центру
    canvas = Image.new("RGB", (px_w, px_h), "white")
    canvas.paste(img_scaled, ((px_w - new_w) // 2, (px_h - new_h) // 2))

    out_path = Path(tempfile.gettempdir()) / f"aucopy_img_{image_path.stem}_{datetime.now():%H%M%S%f}.pdf"
    canvas.save(out_path, "PDF", resolution=IMAGE_DPI)
    log.info("image → pdf: %s (%dx%d → %s, %s)", image_path.name, img_w, img_h, out_path.name, orientation)
    return out_path


# ──────────────────────────────────────────────────────────────────────────
# pypdf препроцессинг (page-range + поворот + N-up)

def _place_on_sheet(sheet: PageObject, src_page: PageObject,
                    slot_x: float, slot_y: float, slot_w: float, slot_h: float) -> None:
    """Вставляет src_page в слот с масштабированием и центрированием по слоту.
    Содержимое НЕ поворачивается — если ориентации не совпадают, появляются поля."""
    sw = float(src_page.mediabox.width)
    sh = float(src_page.mediabox.height)
    scale = min(slot_w / sw, slot_h / sh)
    x = slot_x + (slot_w - sw * scale) / 2
    y = slot_y + (slot_h - sh * scale) / 2
    t = Transformation().scale(scale, scale).translate(x, y)
    sheet.merge_transformed_page(src_page, t)


def _nup_layout(n: int, orientation: str) -> tuple[int, int]:
    """Возвращает (cols, rows) для N-up на листе указанной ориентации.
    Должно совпадать с frontend `layoutFor` в PrintPreview.jsx."""
    landscape = orientation == "landscape"
    if n == 1:
        return 1, 1
    if n == 2:
        # Landscape → 2 рядом, portrait → 2 в стопку
        return (2, 1) if landscape else (1, 2)
    if n == 4:
        return 2, 2
    if n == 8:
        return (4, 2) if landscape else (2, 4)
    raise ValueError(f"pagesPerSide={n} не поддерживается")


def _build_oriented_pdf(src: Path, req: PrintRequest) -> tuple[Path, int, bool]:
    """Применяет page-range, поворот под ориентацию и N-up.
    Возвращает (готовый_pdf, листов, нужно_ли_удалять_temp)."""
    reader = PdfReader(str(src))
    total = len(reader.pages)
    if total == 0:
        raise PrintError("В PDF нет страниц")

    # Список индексов исходных страниц
    if req.pages == "range" and req.pageRange.strip():
        idxs = _parse_page_range(req.pageRange, total)
        if not idxs:
            raise PrintError(
                f"Диапазон '{req.pageRange}' не содержит валидных страниц "
                f"(всего в файле: {total})"
            )
    else:
        idxs = list(range(total))

    selected = [reader.pages[i] for i in idxs]
    n = req.pagesPerSide
    target_orientation = req.orientation if req.orientation in ("portrait", "landscape") else "portrait"

    writer = PdfWriter()
    sheet_w, sheet_h = _sheet_size(target_orientation)

    if n == 1:
        # Каждая исходная страница на отдельном листе target ориентации.
        # Содержимое НЕ поворачивается — оно ставится "как есть" с центрированием.
        # Если ориентация source отличается от target — будут белые поля.
        for src_page in selected:
            new_sheet = PageObject.create_blank_page(width=sheet_w, height=sheet_h)
            _place_on_sheet(new_sheet, src_page, 0, 0, sheet_w, sheet_h)
            writer.add_page(new_sheet)
        sheets_count = len(selected)
    else:
        cols, rows = _nup_layout(n, target_orientation)
        per_sheet = cols * rows
        slot_w = sheet_w / cols
        slot_h = sheet_h / rows

        for i in range(0, len(selected), per_sheet):
            chunk = selected[i : i + per_sheet]
            new_sheet = PageObject.create_blank_page(width=sheet_w, height=sheet_h)
            for idx, src_page in enumerate(chunk):
                col = idx % cols
                row = idx // cols
                # PDF координаты — снизу вверх. Первый ряд (top) при row=0 → y_top.
                slot_x = col * slot_w
                slot_y = (rows - 1 - row) * slot_h
                _place_on_sheet(new_sheet, src_page, slot_x, slot_y, slot_w, slot_h)
            writer.add_page(new_sheet)
        sheets_count = math.ceil(len(selected) / per_sheet)

    tmp = Path(tempfile.gettempdir()) / f"aucopy_{src.stem}_{datetime.now():%H%M%S%f}.pdf"
    with tmp.open("wb") as f:
        writer.write(f)
    log.info(
        "preprocess: %s → %s (sheets=%d, n=%d, orientation=%s)",
        src.name, tmp.name, sheets_count, n, target_orientation,
    )
    return tmp, sheets_count, True


# ──────────────────────────────────────────────────────────────────────────
# Отправка на принтер

def _resolve_gs() -> str:
    p = Path(GS_PATH)
    if p.is_file():
        return str(p)
    found = shutil.which(GS_PATH)
    if found:
        return found
    raise PrintError(
        f"Ghostscript не найден. AU_GS_PATH='{GS_PATH}'. "
        "Скачайте gswin64c.exe с ghostscript.com."
    )


def _is_dialog_printer() -> bool:
    name = (PRINTER_NAME or "").strip().lower()
    return name in ("", "microsoft print to pdf", "microsoft xps document writer")


async def _send_to_printer(pdf: Path, copies: int, duplex: bool, orientation: str = "portrait") -> None:
    gs = _resolve_gs()
    args = [
        gs, "-dBATCH", "-dNOPAUSE", "-dSAFER",
        # DEMO: -dNoCancel подавляет системное окно Windows «Printing» (диалог
        # прогресса/отмены, которое mswinpr2 показывает при каждой печати).
        # Чтобы вернуть окно — убрать "-dNoCancel".
        "-dNoCancel",
        "-sDEVICE=mswinpr2",
        f"-sOutputFile=%printer%{PRINTER_NAME}",
    ]
    if copies > 1:
        args.append(f"-dNumCopies={copies}")
    if duplex:
        args += ["-dDuplex=true", "-dTumble=false"]
    # Альбомная ориентация: страница уже собрана в альбомном размере (842×595).
    # Говорим принтеру через DEVMODE использовать альбомный лист (Orientation 1 =
    # landscape) — это то же, что ручная команда gs с setpagedevice. Тогда широкая
    # страница печатается 1:1. Без флага mswinpr2 печатает на книжном листе и сам
    # крутит/ужимает широкую страницу под книжный формат — это и был баг.
    if orientation == "landscape":
        args += ["-c", "<</Orientation 1>> setpagedevice", "-f", str(pdf)]
    else:
        args.append(str(pdf))

    log.info("gs cmd: %s", " ".join(args))
    # На Windows скрываем консольное окно gswin64c.exe (иначе при каждой печати
    # мелькает чёрное окно Ghostscript). CREATE_NO_WINDOW есть только в Windows.
    creationflags = getattr(subprocess, "CREATE_NO_WINDOW", 0)
    try:
        proc = await asyncio.create_subprocess_exec(
            *args,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
            creationflags=creationflags,
        )
    except FileNotFoundError as exc:
        raise PrintError(f"не удалось запустить Ghostscript: {exc}") from exc

    try:
        stdout, stderr = await asyncio.wait_for(
            proc.communicate(), timeout=GS_TIMEOUT_SECONDS
        )
    except asyncio.TimeoutError:
        try:
            proc.kill()
        except ProcessLookupError:
            pass
        raise PrintError(
            f"Принтер «{PRINTER_NAME}» не ответил за {GS_TIMEOUT_SECONDS} с. "
            "Возможно, требует ручного диалога (например Microsoft Print to PDF)."
        )

    if proc.returncode != 0:
        out = (stderr or b"").decode("utf-8", "ignore").strip() \
              or (stdout or b"").decode("utf-8", "ignore").strip() \
              or "вывод отсутствует"
        raise PrintError(f"Ghostscript завершился с кодом {proc.returncode}: {out}")


async def _save_as_file(pdf: Path, copies: int) -> Path:
    """Тестовый режим: копируем PDF в Downloads/au_copy_print/. Копии дублируем."""
    TEST_OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    ts = datetime.now().strftime("%Y%m%d_%H%M%S")
    out = TEST_OUTPUT_DIR / f"print_{ts}.pdf"

    if copies <= 1:
        shutil.copyfile(pdf, out)
    else:
        reader = PdfReader(str(pdf))
        writer = PdfWriter()
        for _ in range(copies):
            for p in reader.pages:
                writer.add_page(p)
        with out.open("wb") as f:
            writer.write(f)

    log.info("test mode → файл сохранён: %s", out)
    return out


# ──────────────────────────────────────────────────────────────────────────
# Точка входа

async def run_print_job(file_path: Path, req: PrintRequest) -> dict:
    """Возвращает {'sheets': int, 'mode': 'printer'|'file', 'output': str|None}."""
    suffix = file_path.suffix.lower()

    # 1. Конвертация картинки в PDF
    converted_image_pdf: Path | None = None
    if suffix in IMAGE_EXTS:
        try:
            converted_image_pdf = _image_to_pdf(file_path, req.orientation)
            file_path = converted_image_pdf
            suffix = ".pdf"
        except Exception as exc:
            raise PrintError(f"Не удалось конвертировать изображение: {exc}") from exc

    if suffix != ".pdf":
        raise PrintError(f"Печать поддерживает только PDF и изображения. Получен '{suffix}'.")

    log.info("print: %s, settings=%s", file_path.name, req.model_dump())

    # 2. Препроцессинг: page-range + rotation + N-up
    prepared, sheets, is_temp = _build_oriented_pdf(file_path, req)

    try:
        if _is_dialog_printer():
            out = await _save_as_file(prepared, req.copies)
            return {"sheets": sheets, "mode": "file", "output": str(out)}
        await _send_to_printer(prepared, req.copies, req.duplex, req.orientation)
        return {"sheets": sheets, "mode": "printer", "output": None}
    finally:
        # Чистим все временные файлы
        for p in (prepared if is_temp else None, converted_image_pdf):
            if p is None:
                continue
            try:
                Path(p).unlink(missing_ok=True)
            except Exception:
                pass
