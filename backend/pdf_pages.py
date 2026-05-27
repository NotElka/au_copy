"""Минимальный счётчик страниц PDF без внешних зависимостей.

Алгоритм:
1. Находим объект каталога через `/Type /Pages` и берём ближайший `/Count N` —
   это число страниц по PDF-спецификации (Pages root tree node).
2. Если каталог недоступен (сжатый xref-stream и т.п.) — fallback: считаем все
   `/Type /Page` (не `/Pages`).

Работает на большинстве PDF, сгенерированных Word/Google Docs/принтерами.
Для зашифрованных или сильно нестандартных PDF может вернуть None.
"""

from __future__ import annotations

import re

# /Type /Pages ... /Count 12  (с произвольными пробелами/переводами строк между ними)
PAGES_ROOT_RE = re.compile(
    rb"/Type\s*/Pages\b[^>]{0,4096}?/Count\s+(\d+)",
    re.DOTALL,
)
# /Type /Page  — но НЕ /Pages. Убеждаемся, что после "Page" нет "s".
PAGE_OBJ_RE = re.compile(rb"/Type\s*/Page(?![sA-Za-z])")


def count_pdf_pages(data: bytes) -> int | None:
    if not data.startswith(b"%PDF-"):
        return None

    matches = PAGES_ROOT_RE.findall(data)
    if matches:
        # Если в PDF несколько Pages-узлов (вложенное дерево) — берём максимум:
        # корневой обычно содержит общее количество.
        try:
            return max(int(m) for m in matches)
        except ValueError:
            pass

    pages = len(PAGE_OBJ_RE.findall(data))
    if pages > 0:
        return pages

    return None
