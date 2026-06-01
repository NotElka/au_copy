"""Расчёт стоимости печати НА СЕРВЕРЕ.

Зачем отдельный серверный расчёт, если цена уже считается во фронте
(`usePrintPrice.js`): фронту нельзя доверять сумму оплаты — клиент мог бы
прислать «amount=1». Поэтому при оплате сервер считает сумму сам по настройкам
печати, а присланную фронтом сумму игнорирует.

Логика обязана совпадать с фронтом и с раскладкой печати:
    выбранных_страниц = pages=='all' ? page_count : кол-во из pageRange
    листов            = ceil(выбранных_страниц / pagesPerSide)
    итого             = листов × copies × PRICE_PER_SHEET
"""

import math
import re

from .config import PRICE_PER_SHEET


def _count_pages_in_range(spec: str, total: int) -> int:
    """'1-3,5,7-9' → кол-во уникальных валидных страниц (1..total).

    Должно совпадать с `_parse_page_range` в print_job.py и parsePageRange.js.
    """
    seen: set[int] = set()
    for part in spec.split(","):
        part = part.strip()
        if not part:
            continue
        m = re.match(r"^(\d+)\s*-\s*(\d+)$", part)
        if m:
            a, b = int(m.group(1)), int(m.group(2))
            for p in range(min(a, b), max(a, b) + 1):
                if 1 <= p <= total:
                    seen.add(p)
        else:
            try:
                p = int(part)
                if 1 <= p <= total:
                    seen.add(p)
            except ValueError:
                pass
    return len(seen)


def compute_sheets(page_count: int | None, settings: dict) -> int:
    """Сколько физических листов уйдёт при данных настройках."""
    total = page_count or 1
    page_range = (settings.get("pageRange") or "").strip()
    if settings.get("pages") == "range" and page_range:
        selected = _count_pages_in_range(page_range, total) or total
    else:
        selected = total
    per_side = max(1, int(settings.get("pagesPerSide", 1) or 1))
    return math.ceil(selected / per_side)


def compute_price(page_count: int | None, settings: dict) -> tuple[int, int]:
    """Возвращает (листов, итоговая_сумма_в_тенге)."""
    sheets = compute_sheets(page_count, settings)
    copies = max(1, int(settings.get("copies", 1) or 1))
    return sheets, sheets * copies * PRICE_PER_SHEET
