export const API_BASE =
  (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_API_BASE) ||
  'http://localhost:8000';

const normalizeCode = (raw) =>
  String(raw || '').toUpperCase().replace(/[^A-Z0-9]/g, '');

export async function fetchSession(code) {
  const clean = normalizeCode(code);
  if (!clean) throw new Error('Введите код');
  const res = await fetch(`${API_BASE}/api/file/${clean}`);
  if (res.status === 404) throw new Error('Код не найден или истёк');
  if (!res.ok) throw new Error(`Ошибка сервера (${res.status})`);
  const data = await res.json();
  return {
    code: data.code,
    fileName: data.fileName,
    mimeType: data.mimeType,
    size: data.size,
    pageCount: data.pageCount ?? null,
    expiresAt: data.expiresAt,
    downloadUrl: `${API_BASE}/api/file/${data.code}/download`,
  };
}

export async function printDocument(code, settings) {
  const clean = String(code || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (!clean) throw new Error('Нет кода сессии для печати');
  const res = await fetch(`${API_BASE}/api/print/${clean}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(settings || {}),
  });
  if (!res.ok) {
    let msg = `Не удалось отправить на печать (${res.status})`;
    try {
      const body = await res.json();
      if (body && body.detail) msg = body.detail;
    } catch (_) {}
    throw new Error(msg);
  }
  return res.json();
}

export async function deleteSession(code) {
  if (!code) return;
  const clean = String(code).toUpperCase().replace(/[^A-Z0-9]/g, '');
  try {
    await fetch(`${API_BASE}/api/file/${clean}`, { method: 'DELETE' });
  } catch (_) {
    // best-effort
  }
}

export function formatBytes(bytes) {
  if (!bytes && bytes !== 0) return '—';
  const units = ['Б', 'КБ', 'МБ', 'ГБ'];
  let val = bytes;
  let i = 0;
  while (val >= 1024 && i < units.length - 1) {
    val /= 1024;
    i += 1;
  }
  return `${val.toFixed(val >= 10 || i === 0 ? 0 : 1)} ${units[i]}`;
}
