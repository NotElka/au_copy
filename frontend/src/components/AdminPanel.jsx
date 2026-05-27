import React, { useEffect, useState, useCallback } from 'react';
import { API_BASE } from '../utils/api';
import { useT } from '../i18n/LanguageProvider';
import LanguageSwitcher from './LanguageSwitcher';

const STORAGE_KEY = 'aucopy.adminToken';

const formatUptime = (sec) => {
  if (!sec || sec < 0) return '—';
  const d = Math.floor(sec / 86400);
  const h = Math.floor((sec % 86400) / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const parts = [];
  if (d) parts.push(`${d}д`);
  if (h) parts.push(`${h}ч`);
  parts.push(`${m}м`);
  return parts.join(' ');
};

const StatusCard = ({ label, value, hint, color = '#2563EB' }) => (
  <div className="bg-white border border-[#E2E8F0] rounded-2xl p-5">
    <p className="text-[13px] text-[#94A3B8] uppercase tracking-wider font-semibold">{label}</p>
    <p className="text-[28px] font-bold mt-1.5 leading-none" style={{ color }}>{value}</p>
    {hint && <p className="text-[13px] text-[#64748B] mt-2">{hint}</p>}
  </div>
);

const AdminPanel = ({ onExit }) => {
  const { t } = useT();
  const [token, setToken] = useState(() => {
    try { return localStorage.getItem(STORAGE_KEY) || ''; } catch { return ''; }
  });
  const [authed, setAuthed] = useState(false);
  const [status, setStatus] = useState(null);
  const [authError, setAuthError] = useState('');
  const [refillTotal, setRefillTotal] = useState(500);
  const [tokenInput, setTokenInput] = useState(token);

  const apiCall = useCallback(async (path, opts = {}) => {
    const res = await fetch(`${API_BASE}${path}`, {
      ...opts,
      headers: { 'X-Admin-Token': token, 'Content-Type': 'application/json', ...(opts.headers || {}) },
    });
    if (res.status === 401) throw new Error('unauth');
    if (!res.ok) throw new Error(`http ${res.status}`);
    return res.json();
  }, [token]);

  const loadStatus = useCallback(async () => {
    try {
      const data = await apiCall('/api/admin/status');
      setStatus(data);
      setAuthed(true);
      setAuthError('');
    } catch (e) {
      if (e.message === 'unauth') {
        setAuthed(false);
        setAuthError(t('admin.invalidToken'));
      }
    }
  }, [apiCall, t]);

  useEffect(() => {
    if (!token) return;
    loadStatus();
    const id = setInterval(loadStatus, 10000);
    return () => clearInterval(id);
  }, [token, loadStatus]);

  const submitToken = () => {
    setToken(tokenInput);
    try { localStorage.setItem(STORAGE_KEY, tokenInput); } catch {}
  };

  const handleRefill = async () => {
    try {
      await apiCall('/api/admin/refill', { method: 'POST', body: JSON.stringify({ total: Number(refillTotal) }) });
      loadStatus();
    } catch (e) { console.error(e); }
  };

  const handleResetToday = async () => {
    try {
      await apiCall('/api/admin/reset-today', { method: 'POST' });
      loadStatus();
    } catch (e) { console.error(e); }
  };

  const handleResolveReport = async (id) => {
    try {
      await apiCall(`/api/admin/reports/${id}/resolve`, { method: 'POST' });
      loadStatus();
    } catch (e) { console.error(e); }
  };

  const logout = () => {
    setToken('');
    setTokenInput('');
    setAuthed(false);
    try { localStorage.removeItem(STORAGE_KEY); } catch {}
  };

  // ── Auth screen ───────────────────────────────────────────────────────
  if (!authed) {
    return (
      <div className="min-h-screen bg-[#F8FAFC] flex items-center justify-center">
        <div className="absolute top-6 right-6 flex items-center gap-3">
          <LanguageSwitcher />
          <button onClick={onExit} className="px-4 py-2 rounded-xl bg-white border border-[#E2E8F0] text-[14px] font-semibold text-dark-blue hover:bg-[#F1F5F9]">← {t('common.online') === 'Online' ? 'Back' : 'Назад'}</button>
        </div>
        <div className="bg-white rounded-2xl shadow-lg border border-[#E2E8F0] p-10 w-[420px]">
          <h1 className="text-[28px] font-bold text-dark-blue text-center mb-2">{t('admin.title')}</h1>
          <p className="text-[14px] text-[#64748B] text-center mb-6">{t('admin.enterToken')}</p>
          <input
            type="password"
            value={tokenInput}
            onChange={(e) => setTokenInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') submitToken(); }}
            className="w-full h-14 px-4 text-[16px] border-2 border-[#E2E8F0] focus:border-primary rounded-xl outline-none"
            placeholder="admin-secret-…"
            autoFocus
          />
          {authError && <p className="text-[14px] text-red-500 mt-2">{authError}</p>}
          <button
            onClick={submitToken}
            disabled={!tokenInput.trim()}
            className="w-full h-14 mt-4 bg-primary text-white text-[16px] font-bold rounded-xl hover:bg-[#1D4ED8] active:scale-[0.99] disabled:opacity-50"
          >
            {t('admin.enter')}
          </button>
        </div>
      </div>
    );
  }

  if (!status) return <div className="p-10 text-center text-[#94A3B8]">…</div>;

  const paper = status.paper || {};
  const paperRatio = paper.total > 0 ? paper.remaining / paper.total : 0;
  const paperColor = paper.remaining <= 0 ? '#DC2626'
                   : paper.remaining < (paper.warnBelow || 50) ? '#F59E0B'
                   : '#22C55E';

  return (
    <div className="min-h-screen bg-[#F8FAFC] p-8">
      {/* Topbar */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-[32px] font-bold text-dark-blue">{t('admin.title')}</h1>
          <p className="text-[14px] text-[#64748B] mt-1">{status.runtime?.now}</p>
        </div>
        <div className="flex items-center gap-3">
          <LanguageSwitcher />
          <button onClick={onExit} className="px-5 py-3 rounded-xl bg-white border border-[#E2E8F0] text-[14px] font-semibold text-dark-blue hover:bg-[#F1F5F9]">
            ← Kiosk
          </button>
          <button onClick={logout} className="px-5 py-3 rounded-xl bg-white border border-[#FCA5A5] text-red-600 text-[14px] font-semibold hover:bg-red-50">
            {t('admin.logout')}
          </button>
        </div>
      </div>

      {/* Status grid */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        <StatusCard label={t('admin.paperLevel')} value={`${paper.remaining}/${paper.total}`} hint={`${Math.round(paperRatio * 100)}%`} color={paperColor} />
        <StatusCard label={t('admin.jobsToday')} value={status.jobs?.today ?? 0} hint={`${t('admin.jobsTotal')}: ${status.jobs?.total ?? 0}`} />
        <StatusCard label={t('admin.uptime')} value={formatUptime(status.runtime?.uptimeSec)} hint={status.startedAt} />
        <StatusCard label={t('admin.gsStatus')} value={status.runtime?.gsAvailable ? t('admin.gsOk') : t('admin.gsMissing')} hint={status.runtime?.printer} color={status.runtime?.gsAvailable ? '#22C55E' : '#DC2626'} />
      </div>

      {/* Paper visual bar */}
      <div className="bg-white border border-[#E2E8F0] rounded-2xl p-6 mb-6">
        <p className="text-[14px] font-bold text-dark-blue mb-3">{t('admin.paperLevel')}</p>
        <div className="w-full h-6 bg-[#F1F5F9] rounded-full overflow-hidden">
          <div className="h-full rounded-full transition-all duration-500" style={{ width: `${paperRatio * 100}%`, backgroundColor: paperColor }} />
        </div>
        <p className="text-[12px] text-[#94A3B8] mt-2">
          {paper.lastRefillAt ? `Долито: ${paper.lastRefillAt}` : '—'}
        </p>
      </div>

      {/* Refill + actions */}
      <div className="grid grid-cols-2 gap-4 mb-6">
        <div className="bg-white border border-[#E2E8F0] rounded-2xl p-6">
          <p className="text-[16px] font-bold text-dark-blue mb-3">{t('admin.refillTitle')}</p>
          <label className="text-[13px] text-[#64748B] block mb-1">{t('admin.refillTotal')}</label>
          <div className="flex gap-3">
            <input
              type="number"
              min="1"
              value={refillTotal}
              onChange={(e) => setRefillTotal(e.target.value)}
              className="flex-1 h-12 px-4 border-2 border-[#E2E8F0] rounded-xl text-[16px] outline-none focus:border-primary"
            />
            <button onClick={handleRefill} className="px-6 h-12 bg-primary text-white rounded-xl font-bold hover:bg-[#1D4ED8]">
              {t('admin.refill')}
            </button>
          </div>
        </div>
        <div className="bg-white border border-[#E2E8F0] rounded-2xl p-6 flex flex-col justify-between">
          <p className="text-[16px] font-bold text-dark-blue">Действия</p>
          <button onClick={handleResetToday} className="mt-3 h-12 px-6 bg-white border-2 border-[#E2E8F0] rounded-xl font-semibold text-dark-blue hover:bg-[#F1F5F9]">
            {t('admin.resetToday')}
          </button>
        </div>
      </div>

      {/* Recent jobs */}
      <div className="bg-white border border-[#E2E8F0] rounded-2xl p-6 mb-6">
        <p className="text-[16px] font-bold text-dark-blue mb-4">{t('admin.recentJobs')}</p>
        {(status.jobs?.recent || []).length === 0 ? (
          <p className="text-[14px] text-[#94A3B8]">{t('admin.noJobs')}</p>
        ) : (
          <div className="space-y-2 max-h-[300px] overflow-y-auto">
            {status.jobs.recent.map((j, idx) => (
              <div key={idx} className={`flex items-center gap-3 p-3 rounded-lg ${j.error ? 'bg-red-50' : 'bg-[#F8FAFC]'}`}>
                <div className={`w-2 h-2 rounded-full ${j.error ? 'bg-red-500' : j.mode === 'printer' ? 'bg-green-500' : 'bg-blue-400'}`} />
                <div className="flex-1 min-w-0">
                  <p className="text-[14px] font-medium text-dark-blue truncate">{j.file}</p>
                  <p className="text-[12px] text-[#64748B]">{j.at} · {j.sheets} {t('common.sheets')} · {j.mode}</p>
                  {j.error && <p className="text-[12px] text-red-600 mt-0.5">{j.error}</p>}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* User reports */}
      <div className="bg-white border border-[#E2E8F0] rounded-2xl p-6 mb-6">
        <div className="flex items-center justify-between mb-4">
          <p className="text-[16px] font-bold text-dark-blue">
            {t('admin.userReports')}
            {(status.reports || []).filter(r => !r.resolved).length > 0 && (
              <span className="ml-2 inline-flex items-center justify-center bg-red-500 text-white text-[12px] font-bold rounded-full px-2 py-0.5 min-w-[24px]">
                {(status.reports || []).filter(r => !r.resolved).length}
              </span>
            )}
          </p>
        </div>
        {(status.reports || []).length === 0 ? (
          <p className="text-[14px] text-[#94A3B8]">{t('admin.noReports')}</p>
        ) : (
          <div className="space-y-2 max-h-[400px] overflow-y-auto">
            {status.reports.map((r) => (
              <div key={r.id} className={`p-4 rounded-xl border ${r.resolved ? 'bg-[#F8FAFC] border-[#E2E8F0] opacity-60' : 'bg-orange-50 border-orange-200'}`}>
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`text-[13px] font-bold uppercase tracking-wider ${r.resolved ? 'text-[#94A3B8]' : 'text-orange-700'}`}>
                        {r.category}
                      </span>
                      <span className="text-[11px] bg-white text-[#64748B] px-2 py-0.5 rounded-full border border-[#E2E8F0]">
                        {r.lang?.toUpperCase()}
                      </span>
                      {r.screen != null && (
                        <span className="text-[11px] bg-white text-[#64748B] px-2 py-0.5 rounded-full border border-[#E2E8F0]">
                          Screen {r.screen}
                        </span>
                      )}
                      {r.resolved && (
                        <span className="text-[11px] bg-green-100 text-green-700 px-2 py-0.5 rounded-full">
                          ✓ {t('admin.resolved')}
                        </span>
                      )}
                    </div>
                    {r.description && (
                      <p className="text-[14px] text-dark-blue mt-2 whitespace-pre-wrap break-words">{r.description}</p>
                    )}
                    <p className="text-[11px] text-[#94A3B8] mt-2">
                      {r.at} · {t('admin.reportFrom')} {r.ip}
                    </p>
                  </div>
                  {!r.resolved && (
                    <button
                      onClick={() => handleResolveReport(r.id)}
                      className="flex-shrink-0 px-3 py-2 bg-green-500 text-white text-[13px] font-semibold rounded-lg hover:bg-green-600 transition-colors"
                    >
                      ✓
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Technical errors */}
      <div className="bg-white border border-[#E2E8F0] rounded-2xl p-6">
        <p className="text-[16px] font-bold text-dark-blue mb-4">{t('admin.recentErrors')}</p>
        {(status.errors || []).length === 0 ? (
          <p className="text-[14px] text-[#94A3B8]">{t('admin.noErrors')}</p>
        ) : (
          <div className="space-y-2 max-h-[200px] overflow-y-auto">
            {status.errors.map((e, idx) => (
              <div key={idx} className="p-3 rounded-lg bg-red-50 border border-red-100">
                <p className="text-[12px] text-[#94A3B8]">{e.at}</p>
                <p className="text-[14px] text-red-700">{e.message}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminPanel;
