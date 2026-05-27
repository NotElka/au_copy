import React, { useEffect, useState } from 'react';
import { API_BASE } from '../utils/api';
import { useT } from '../i18n/LanguageProvider';

const PaperIndicator = () => {
  const { t } = useT();
  const [status, setStatus] = useState(null);

  useEffect(() => {
    let cancelled = false;
    const tick = async () => {
      try {
        const res = await fetch(`${API_BASE}/api/kiosk/status`);
        if (!res.ok) return;
        const data = await res.json();
        if (!cancelled) setStatus(data);
      } catch (_) {}
    };
    tick();
    const id = setInterval(tick, 15000);  // обновление раз в 15 с
    return () => { cancelled = true; clearInterval(id); };
  }, []);

  if (!status?.paper) return null;
  const { remaining, total, warnBelow } = status.paper;
  const ratio = total > 0 ? remaining / total : 0;
  const low = remaining <= (warnBelow || 50);
  const empty = remaining <= 0;

  const color = empty ? '#DC2626' : low ? '#F59E0B' : '#22C55E';
  const bg = empty ? '#FEE2E2' : low ? '#FEF3C7' : '#DCFCE7';

  return (
    <div
      className="flex items-center gap-2.5 px-4 py-2.5 rounded-[12px] border-[1.5px]"
      style={{ backgroundColor: bg, borderColor: color }}
      title={`${t('paper.title')}: ${remaining}/${total}`}
    >
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
        <rect x="5" y="3" width="14" height="18" rx="1.5" stroke={color} strokeWidth="1.8"/>
        <path d="M8 8h8M8 12h8M8 16h5" stroke={color} strokeWidth="1.6" strokeLinecap="round"/>
      </svg>
      <div className="flex flex-col">
        <span className="text-[14px] font-bold leading-none" style={{ color }}>
          {remaining}/{total}
        </span>
        {(low || empty) && (
          <span className="text-[11px] font-semibold mt-0.5" style={{ color }}>
            {empty ? t('paper.empty') : t('paper.low')}
          </span>
        )}
      </div>
    </div>
  );
};

export default PaperIndicator;
