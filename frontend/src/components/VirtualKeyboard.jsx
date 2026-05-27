import React from 'react';

const ROWS = [
  ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0'],
  ['Q', 'W', 'E', 'R', 'T', 'Y', 'U', 'I', 'O', 'P'],
  ['A', 'S', 'D', 'F', 'G', 'H', 'J', 'K', 'L'],
  ['Z', 'X', 'C', 'V', 'B', 'N', 'M'],
];

const Key = ({ children, onClick, variant = 'default', wide = false }) => {
  const variants = {
    default: 'bg-white border border-[#E2E8F0] text-dark-blue hover:bg-[#F1F5F9] active:bg-[#E2E8F0]',
    primary: 'bg-primary text-white hover:bg-[#1D4ED8] active:bg-[#1E40AF]',
    danger: 'bg-[#FEE2E2] text-[#B91C1C] hover:bg-[#FECACA] active:bg-[#FCA5A5]',
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

// Инлайн-клавиатура — заполняет контейнер целиком (w-full h-full).
// Видимость и расположение контролируются родителем (conditional render).
const VirtualKeyboard = ({ onKey, onBackspace, onClose, onSubmit }) => (
  <div className="bg-[#F0F6FF] border-2 border-[#CBD5E1] rounded-[20px] shadow-lg flex flex-col w-full h-full overflow-hidden">
    <div className="px-6 py-3 flex items-center justify-between border-b border-[#E2E8F0] bg-white flex-shrink-0">
      <div className="flex items-center gap-3">
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
          <rect x="2" y="6" width="20" height="14" rx="2" stroke="#2563EB" strokeWidth="1.8"/>
          <path d="M6 11h.01M10 11h.01M14 11h.01M18 11h.01M7 16h10" stroke="#2563EB" strokeWidth="2" strokeLinecap="round"/>
        </svg>
        <span className="text-[18px] font-semibold text-dark-blue">Виртуальная клавиатура</span>
      </div>
      <button
        type="button"
        onClick={onClose}
        className="w-12 h-12 rounded-xl bg-[#FEE2E2] hover:bg-[#FECACA] active:bg-[#FCA5A5] flex items-center justify-center text-[24px] text-[#B91C1C] font-bold"
        data-testid="kb-close"
      >
        ✕
      </button>
    </div>

    <div className="flex-1 min-h-0 p-3 flex flex-col gap-2.5">
      {ROWS.map((row, i) => (
        <div key={i} className="flex gap-2.5 flex-1">
          {row.map((k) => (
            <Key key={k} onClick={() => onKey(k)}>{k}</Key>
          ))}
          {i === 0 && (
            <Key onClick={onBackspace} variant="danger" wide>⌫</Key>
          )}
          {i === 3 && (
            <Key onClick={onSubmit} variant="primary" wide>OK</Key>
          )}
        </div>
      ))}
    </div>
  </div>
);

export default React.memo(VirtualKeyboard);
