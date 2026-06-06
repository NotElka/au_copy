"""Сборка нескольких присланных файлов в один PDF под одну сессию.

Каждый файл приводится к PDF:
    • PDF      — берётся как есть;
    • Word     — конвертируется через convert_word_to_pdf (MS Word COM);
    • картинка — оборачивается в одностраничный PDF (страница = размер картинки).

Затем все PDF склеиваются в один документ в порядке поступления. Получившийся
файл печатается/превьюится как обычный многостраничный PDF — поэтому остальной
пайплайн (превью, настройки, N-up, оплата, печать) менять не нужно.
"""

from __future__ import annotations

import io
from pathlib import Path

from PIL import Image
from pypdf import PdfReader, PdfWriter

from .word_to_pdf import convert_word_to_pdf

IMAGE_EXTS = {".jpg", ".jpeg", ".png", ".bmp", ".webp", ".tiff", ".tif", ".gif"}
IMAGE_PDF_DPI = 200.0


def _image_to_pdf_bytes(data: bytes) -> bytes:
    """Картинка → одностраничный PDF (страница = размер картинки).
    Ориентация под лист и масштаб накладываются позже, на этапе печати
    (см. _build_oriented_pdf в print_job), поэтому здесь ничего не «запекаем»."""
    img = Image.open(io.BytesIO(data))
    if img.mode not in ("RGB", "L"):
        img = img.convert("RGB")
    buf = io.BytesIO()
    img.save(buf, "PDF", resolution=IMAGE_PDF_DPI)
    return buf.getvalue()


async def _to_pdf_bytes(data: bytes, name: str) -> bytes:
    suffix = Path(name).suffix.lower()
    if suffix == ".pdf":
        return data
    if suffix in (".doc", ".docx"):
        pdf_bytes, _ = await convert_word_to_pdf(data, name)
        return pdf_bytes
    if suffix in IMAGE_EXTS:
        return _image_to_pdf_bytes(data)
    raise ValueError(f"unsupported extension '{suffix}'")


async def merge_to_single_pdf(items: list[tuple[bytes, str]]) -> tuple[bytes, int]:
    """items: список (bytes, имя_файла) в нужном порядке.
    Возвращает (pdf_bytes, число_страниц склеенного документа)."""
    if not items:
        raise ValueError("no files to merge")

    writer = PdfWriter()
    for data, name in items:
        pdf_bytes = await _to_pdf_bytes(data, name)
        reader = PdfReader(io.BytesIO(pdf_bytes))
        for page in reader.pages:
            writer.add_page(page)

    out = io.BytesIO()
    writer.write(out)
    return out.getvalue(), len(writer.pages)
