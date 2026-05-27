export function parsePageList(input, totalPages) {
  if (!input || !input.trim()) return [];
  const parts = input.split(',').map((s) => s.trim()).filter(Boolean);
  const pages = new Set();
  for (const part of parts) {
    if (part.includes('-')) {
      const [start, end] = part.split('-').map(Number);
      if (Number.isFinite(start) && Number.isFinite(end)) {
        const lo = Math.max(1, Math.min(start, end));
        const hi = Math.min(Math.max(start, end), totalPages);
        for (let i = lo; i <= hi; i += 1) pages.add(i);
      }
    } else {
      const n = Number(part);
      if (Number.isFinite(n) && n >= 1 && n <= totalPages) pages.add(n);
    }
  }
  return Array.from(pages).sort((a, b) => a - b);
}

export function parsePageRange(input, totalPages) {
  return parsePageList(input, totalPages).length;
}

export function selectedPageNumbers(settings, totalPages) {
  if (settings.pages === 'all') {
    return Array.from({ length: totalPages }, (_, i) => i + 1);
  }
  return parsePageList(settings.pageRange, totalPages);
}
