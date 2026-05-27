import React, { useState, useRef, useEffect } from 'react';
import { LANGUAGES } from '../i18n/dictionary';
import { useT } from '../i18n/LanguageProvider';

const LanguageSwitcher = () => {
  const { lang, setLang } = useT();
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return;
    const onClick = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, [open]);

  const current = LANGUAGES.find((l) => l.code === lang) || LANGUAGES[0];

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-2 px-4 py-3 rounded-[14px] border-[1.5px] border-[#E2E8F0] bg-white hover:bg-[#F8FAFC] active:scale-[0.97] transition-all"
      >
        <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
          <circle cx="10" cy="10" r="8" stroke="#64748B" strokeWidth="1.8"/>
          <path d="M2 10h16M10 2c2.5 2.5 2.5 13.5 0 16M10 2c-2.5 2.5-2.5 13.5 0 16" stroke="#64748B" strokeWidth="1.5"/>
        </svg>
        <span className="text-[16px] font-bold text-dark-blue">{current.short}</span>
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none" className={`transition-transform ${open ? 'rotate-180' : ''}`}>
          <path d="M3 4.5l3 3 3-3" stroke="#64748B" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      </button>
      {open && (
        <div className="absolute right-0 top-full mt-2 w-[180px] bg-white border border-[#E2E8F0] rounded-[12px] shadow-lg overflow-hidden z-50">
          {LANGUAGES.map((l) => (
            <button
              key={l.code}
              type="button"
              onClick={() => { setLang(l.code); setOpen(false); }}
              className={`w-full px-4 py-3 text-left text-[16px] hover:bg-[#F1F5F9] transition-colors flex items-center justify-between ${
                l.code === lang ? 'bg-[#EFF6FF] text-primary font-bold' : 'text-dark-blue'
              }`}
            >
              <span>{l.label}</span>
              <span className="text-[12px] font-bold text-[#94A3B8]">{l.short}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

export default LanguageSwitcher;
