import React from 'react';

const Key = ({ children, onClick, variant = 'default', wide = false }) => {
  const variants = {
    default: 'bg-white border border-[#E2E8F0] text-dark-blue hover:bg-[#F1F5F9] active:bg-[#E2E8F0]',
    primary: 'bg-primary text-white hover:bg-[#1D4ED8] active:bg-[#1E40AF]',
    danger: 'bg-[#FEE2E2] text-[#B91C1C] hover:bg-[#FECACA] active:bg-[#FCA5A5]',
    muted: 'bg-[#F1F5F9] border border-[#E2E8F0] text-[#64748B] hover:bg-[#E2E8F0] active:bg-[#CBD5E1]',
  };
  return (
    <button
      type="button"
      onClick={onClick}
      className={`${variants[variant]} ${wide ? 'flex-[1.6]' : 'flex-1'} rounded-[14px] text-[32px] font-bold transition-colors duration-75 active:scale-[0.97] shadow-sm select-none`}
      style={{ touchAction: 'manipulation' }}
    >
      {children}
    </button>
  );
};

// Цифровая клавиатура для ввода диапазона страниц.
// Содержит цифры 0-9, запятую, дефис, Backspace и OK.
const NumericKeyboard = ({ onKey, onBackspace, onClose, onSubmit }) => (
  <div className="bg-[#F0F6FF] border-2 border-[#CBD5E1] rounded-[20px] shadow-lg flex flex-col w-full h-full overflow-hidden">
    <div className="px-6 py-3 flex items-center justify-between border-b border-[#E2E8F0] bg-white flex-shrink-0">
      <div className="flex items-center gap-3">
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
          <rect x="2" y="4" width="20" height="16" rx="3" stroke="#2563EB" strokeWidth="1.8"/>
          <text x="7" y="15" fontSize="10" fill="#2563EB" fontWeight="700" fontFamily="sans-serif">123</text>
        </svg>
        <span className="text-[18px] font-semibold text-dark-blue">Введите номера страниц</span>
      </div>
      <button
        type="button"
        onClick={onClose}
        className="w-12 h-12 rounded-xl bg-[#FEE2E2] hover:bg-[#FECACA] active:bg-[#FCA5A5] flex items-center justify-center text-[24px] text-[#B91C1C] font-bold"
        data-testid="numkb-close"
      >
        ✕
      </button>
    </div>

    <div className="flex-1 min-h-0 p-3 flex flex-col gap-2.5">
      {/* Row 1: 1-5 */}
      <div className="flex gap-2.5 flex-1">
        {['1', '2', '3', '4', '5'].map((k) => (
          <Key key={k} onClick={() => onKey(k)}>{k}</Key>
        ))}
      </div>
      {/* Row 2: 6-0 */}
      <div className="flex gap-2.5 flex-1">
        {['6', '7', '8', '9', '0'].map((k) => (
          <Key key={k} onClick={() => onKey(k)}>{k}</Key>
        ))}
      </div>
      {/* Row 3: -, запятая, backspace, OK */}
      <div className="flex gap-2.5 flex-1">
        <Key onClick={() => onKey('-')} variant="muted">—</Key>
        <Key onClick={() => onKey(',')} variant="muted">,</Key>
        <Key onClick={() => onKey(' ')} variant="muted">␣</Key>
        <Key onClick={onBackspace} variant="danger">⌫</Key>
        <Key onClick={onSubmit} variant="primary" wide>OK</Key>
      </div>
    </div>
  </div>
);

export default React.memo(NumericKeyboard);
