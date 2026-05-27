import React, { useState } from 'react';

const RU_ROWS = [
  ['й','ц','у','к','е','н','г','ш','щ','з','х','ъ'],
  ['ф','ы','в','а','п','р','о','л','д','ж','э'],
  ['я','ч','с','м','и','т','ь','б','ю'],
];

const KK_ROWS = [
  ['й','ц','у','к','е','н','г','ш','щ','з','х','ъ'],
  ['ф','ы','в','а','п','р','о','л','д','ж','э'],
  ['я','ч','с','м','и','т','ь','б','ю'],
  ['ә','ғ','қ','ң','ө','ұ','ү','һ','і'],
];

const EN_ROWS = [
  ['q','w','e','r','t','y','u','i','o','p'],
  ['a','s','d','f','g','h','j','k','l'],
  ['z','x','c','v','b','n','m'],
];

const NUM_ROW = ['1','2','3','4','5','6','7','8','9','0'];

const LAYOUT_CYCLE = { ru: 'kk', kk: 'en', en: 'ru' };
const LAYOUT_LABEL = { ru: 'ҚАЗ', kk: 'EN', en: 'RU' };

const Key = ({ children, onClick, variant = 'default', className = '' }) => {
  const base = 'h-[50px] rounded-xl font-bold shadow-sm active:scale-[0.96] transition-all duration-75 select-none';
  const variants = {
    default: 'bg-white border border-[#E2E8F0] text-dark-blue hover:bg-[#F1F5F9] active:bg-[#E2E8F0]',
    primary: 'bg-primary text-white hover:bg-[#1D4ED8] active:bg-[#1E40AF] border border-primary',
    danger:  'bg-[#FEE2E2] text-[#B91C1C] border border-[#FECACA] hover:bg-[#FECACA]',
    active:  'bg-primary text-white border border-primary hover:bg-[#1D4ED8]',
    muted:   'bg-white border border-[#E2E8F0] text-[#94A3B8] hover:bg-[#F1F5F9]',
  };
  return (
    <button
      type="button"
      onPointerDown={(e) => { e.preventDefault(); onClick(); }}
      className={`${base} ${variants[variant]} ${className}`}
      style={{ touchAction: 'manipulation' }}
    >
      {children}
    </button>
  );
};

const TextKeyboard = ({ onChar, onBackspace, onClose, defaultLayout = 'ru' }) => {
  const [layout, setLayout] = useState(defaultLayout);
  const [shift, setShift] = useState(false);

  const letterRows = layout === 'kk' ? KK_ROWS : layout === 'en' ? EN_ROWS : RU_ROWS;

  const handleChar = (ch) => {
    onChar(shift ? ch.toUpperCase() : ch);
    if (shift) setShift(false);
  };

  return (
    <div className="fixed bottom-0 left-0 right-0 z-[60] bg-[#EEF3FB] border-t-2 border-[#CBD5E1] shadow-2xl px-5 pt-3 pb-4 select-none">
      {/* Top bar */}
      <div className="flex items-center justify-between mb-2.5">
        <div className="flex items-center gap-2">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
            <rect x="2" y="6" width="20" height="14" rx="2" stroke="#2563EB" strokeWidth="1.8"/>
            <path d="M6 11h.01M10 11h.01M14 11h.01M18 11h.01M7 16h10" stroke="#2563EB" strokeWidth="2" strokeLinecap="round"/>
          </svg>
          <span className="text-[13px] font-semibold text-[#64748B]">Клавиатура</span>
        </div>
        <button
          type="button"
          onPointerDown={(e) => { e.preventDefault(); onClose(); }}
          className="px-4 py-1.5 bg-[#FEE2E2] text-[#B91C1C] rounded-lg font-bold text-[13px] hover:bg-[#FECACA] active:bg-[#FCA5A5] transition-colors"
          style={{ touchAction: 'manipulation' }}
        >
          ✕ Закрыть
        </button>
      </div>

      {/* Numbers row */}
      <div className="flex gap-1.5 mb-1.5">
        {NUM_ROW.map((ch) => (
          <Key key={ch} onClick={() => onChar(ch)} className="flex-1 text-[18px]">{ch}</Key>
        ))}
        <Key onClick={onBackspace} variant="danger" className="w-[72px] text-[20px]">⌫</Key>
      </div>

      {/* Letter rows */}
      {letterRows.map((row, i) => (
        <div key={i} className="flex gap-1.5 mb-1.5 justify-center">
          {row.map((ch) => (
            <Key key={ch} onClick={() => handleChar(ch)} className="flex-1 text-[19px]">
              {shift ? ch.toUpperCase() : ch}
            </Key>
          ))}
        </div>
      ))}

      {/* Bottom control row */}
      <div className="flex gap-1.5 mt-0.5">
        <Key
          onClick={() => setShift((s) => !s)}
          variant={shift ? 'active' : 'default'}
          className="w-[80px] text-[20px]"
        >
          ⇧
        </Key>
        <Key
          onClick={() => setLayout((l) => LAYOUT_CYCLE[l])}
          variant="default"
          className="w-[80px] text-[13px]"
        >
          {LAYOUT_LABEL[layout]}
        </Key>
        <Key onClick={() => onChar(' ')} variant="muted" className="flex-1 text-[13px]">
          Пробел
        </Key>
        <Key onClick={() => onChar(',')} className="w-[52px] text-[20px]">,</Key>
        <Key onClick={() => onChar('.')} className="w-[52px] text-[20px]">.</Key>
        <Key onClick={() => onChar('!')} className="w-[52px] text-[20px]">!</Key>
        <Key onClick={() => onChar('?')} className="w-[52px] text-[20px]">?</Key>
        <Key onClick={onClose} variant="primary" className="w-[100px] text-[15px]">
          Готово
        </Key>
      </div>
    </div>
  );
};

export default TextKeyboard;
