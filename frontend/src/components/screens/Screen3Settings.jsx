import React, { useState, useEffect, useRef } from 'react';
import { usePrintPrice } from '../../hooks/usePrintPrice';
import PrintPreview from '../PrintPreview';
import NumericKeyboard from '../NumericKeyboard';
import { useT } from '../../i18n/LanguageProvider';

const Toggle = ({ checked, onChange }) => (
  <button
    className={`relative w-[52px] h-7 rounded-full transition-colors duration-200 ${checked ? 'bg-primary' : 'bg-[#E2E8F0]'}`}
    onClick={() => onChange(!checked)}
    data-testid="duplex-toggle"
  >
    <div className={`absolute top-1 w-5 h-5 bg-white rounded-full transition-transform duration-200 ${checked ? 'translate-x-7' : 'translate-x-1'}`} />
  </button>
);

const Screen3Settings = React.memo(({
  printSettings,
  setPrintSettings,
  onNext,
  onBack,
  filePageCount = 1,
  file,
  orientation = 'portrait',
}) => {
  const { t } = useT();
  const priceInfo = usePrintPrice(printSettings, filePageCount);
  const [priceAnimate, setPriceAnimate] = useState(false);
  const prevTotal = useRef(priceInfo.total);

  // ── Виртуальная цифровая клавиатура ──
  // numpadTarget: 'rangeFrom' | 'rangeTo' | 'custom' | null
  const [numpadTarget, setNumpadTarget] = useState(null);

  const openNumpad = (target) => setNumpadTarget(target);
  const closeNumpad = () => setNumpadTarget(null);

  const handleNumKey = (ch) => {
    if (numpadTarget === 'rangeFrom') {
      setPrintSettings((prev) => {
        const v = (prev.rangeFrom ?? '') + ch;
        return { ...prev, rangeFrom: v, pageRange: v && prev.rangeTo ? `${v}-${prev.rangeTo}` : prev.pageRange };
      });
    } else if (numpadTarget === 'rangeTo') {
      setPrintSettings((prev) => {
        const v = (prev.rangeTo ?? '') + ch;
        return { ...prev, rangeTo: v, pageRange: prev.rangeFrom && v ? `${prev.rangeFrom}-${v}` : prev.pageRange };
      });
    } else if (numpadTarget === 'custom') {
      setPrintSettings((prev) => ({ ...prev, pageRange: (prev.pageRange ?? '') + ch }));
    }
  };

  const handleNumBackspace = () => {
    if (numpadTarget === 'rangeFrom') {
      setPrintSettings((prev) => {
        const v = (prev.rangeFrom ?? '').slice(0, -1);
        return { ...prev, rangeFrom: v, pageRange: v && prev.rangeTo ? `${v}-${prev.rangeTo}` : prev.pageRange };
      });
    } else if (numpadTarget === 'rangeTo') {
      setPrintSettings((prev) => {
        const v = (prev.rangeTo ?? '').slice(0, -1);
        return { ...prev, rangeTo: v, pageRange: prev.rangeFrom && v ? `${prev.rangeFrom}-${v}` : prev.pageRange };
      });
    } else if (numpadTarget === 'custom') {
      setPrintSettings((prev) => ({ ...prev, pageRange: (prev.pageRange ?? '').slice(0, -1) }));
    }
  };

  useEffect(() => {
    if (priceInfo.total !== prevTotal.current) {
      setPriceAnimate(true);
      prevTotal.current = priceInfo.total;
      setTimeout(() => setPriceAnimate(false), 300);
    }
  }, [priceInfo.total]);

  const update = (key, val) => {
    setPrintSettings(prev => ({ ...prev, [key]: val }));
  };

  const isPdf = file?.mimeType === 'application/pdf';
  const isImage = file?.mimeType?.startsWith('image/');
  const pdfUrl = isPdf ? file?.downloadUrl : null;
  const imageUrl = isImage ? file?.downloadUrl : null;

  // Для картинок принудительно: 1 на лист, all-страницы (там она одна).
  useEffect(() => {
    if (isImage && (printSettings.pagesPerSide !== 1 || printSettings.pages !== 'all')) {
      setPrintSettings((p) => ({ ...p, pagesPerSide: 1, pages: 'all', pageRange: '' }));
    }
  }, [isImage, printSettings.pagesPerSide, printSettings.pages, setPrintSettings]);

  return (
    <div className="flex min-h-full">
      {/* LEFT — Preview + Price (wider for visibility) */}
      <div className="w-[50%] border-r border-[#E2E8F0] p-6 flex flex-col gap-4 self-stretch sticky top-0" style={{ height: 932 }}>
        <div className="flex items-center justify-between">
          <h2 className="text-[20px] font-bold text-dark-blue">{t('screen3.previewTitle')}</h2>
          <div className="flex items-center gap-2 bg-[#F1F5F9] rounded-full px-3 py-1.5">
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <rect x="2" y="1.5" width="10" height="11" rx="1" stroke="#64748B" strokeWidth="1.4"/>
              <path d="M5 5h4M5 7.5h4M5 10h3" stroke="#64748B" strokeWidth="1.4" strokeLinecap="round"/>
            </svg>
            <span className="text-[12px] font-semibold text-[#64748B]">
              {orientation === 'portrait' ? t('common.portrait') : t('common.landscape')}
            </span>
          </div>
        </div>

        {/* Print-aware preview */}
        <div className="bg-gradient-to-br from-[#1E293B] to-[#0F172A] rounded-2xl flex-1 min-h-0 flex items-center justify-center p-3 overflow-hidden border border-[#0F172A]">
          {(isPdf && pdfUrl) || (isImage && imageUrl) ? (
            <PrintPreview
              pdfUrl={pdfUrl}
              imageUrl={imageUrl}
              printSettings={printSettings}
              totalPages={filePageCount}
              sheetOrientation={orientation}
            />
          ) : (
            <div className="bg-white rounded-[4px] flex flex-col items-center justify-center gap-3 p-6" style={{ aspectRatio: '210 / 297', height: '90%' }}>
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none">
                <path d="M14 3H6a2 2 0 00-2 2v14a2 2 0 002 2h12a2 2 0 002-2V9l-6-6z" stroke="#2563EB" strokeWidth="1.5"/>
                <path d="M14 3v6h6" stroke="#2563EB" strokeWidth="1.5"/>
              </svg>
              <p className="text-[14px] text-muted text-center px-3">{t('screen3.previewUnavailable')}</p>
            </div>
          )}
        </div>

        {/* Price card */}
        <div className="bg-gradient-to-br from-[#EFF6FF] to-[#DBEAFE] rounded-2xl p-5 border border-[#BFDBFE]">
          <div className="flex items-baseline justify-between">
            <p className="text-[14px] font-bold text-[#64748B] uppercase tracking-wider">{t('common.total')}</p>
            <p
              className={`text-[42px] font-bold text-primary leading-none ${priceAnimate ? 'price-pulse' : ''}`}
              data-testid="total-price"
            >
              {priceInfo.total} ₸
            </p>
          </div>
          <p className="text-[13px] text-[#64748B] mt-2">
            {priceInfo.selectedPages} стр × {priceInfo.copies} {priceInfo.copies === 1 ? 'копия' : 'копии'} · {priceInfo.sheets} лист{priceInfo.sheets === 1 ? '' : priceInfo.sheets < 5 ? 'а' : 'ов'} × {priceInfo.pricePerSheet} ₸
          </p>
        </div>
      </div>

      {/* RIGHT — Settings */}
      <div className="w-[50%] flex flex-col" style={{ height: 932 }}>
        {/* Scrollable settings area */}
        <div className="flex-1 min-h-0 overflow-y-auto p-8 flex flex-col gap-7">
        {/* Setting 1: Pages — для картинок прячем (там только одна "страница") */}
        {!isImage && (
        <div>
          <h3 className="text-[18px] font-medium text-dark-blue">{t('screen3.whichPages')}</h3>
          <div className="flex flex-col gap-2 mt-3">
            {[['all', `${t('screen3.allPages')} (${filePageCount})`], ['range', t('screen3.rangePages')], ['custom', t('screen3.customPages')]].map(([val, label]) => (
              <button
                key={val}
                className={`h-[58px] border rounded-[10px] flex items-center px-4 gap-3 cursor-pointer transition-colors duration-150
                  ${printSettings.pages === val ? 'border-primary bg-primary-light' : 'border-[1.5px] border-[#E2E8F0]'}`}
                onClick={() => {
                  if (val === 'range' && printSettings.pages !== 'range') {
                    setPrintSettings(prev => ({ ...prev, pages: 'range', rangeFrom: '1', rangeTo: '1', pageRange: '1-1' }));
                  } else {
                    update('pages', val);
                  }
                }}
                data-testid={`pages-${val}`}
              >
                <div className={`w-5 h-5 rounded-full border flex items-center justify-center flex-shrink-0
                  ${printSettings.pages === val ? 'border-primary' : 'border-[#E2E8F0]'}`}>
                  {printSettings.pages === val && <div className="w-2.5 h-2.5 rounded-full bg-primary" />}
                </div>
                <span className="text-[17px] text-dark-blue">{label}</span>
              </button>
            ))}
          </div>
          {printSettings.pages === 'range' && (
            <div className="flex gap-4 mt-3 items-center">
              {/* ── От ── */}
              <label className="text-[16px] text-dark-blue font-medium">{t('screen3.rangeFrom')}</label>
              <div className="flex items-center gap-1.5">
                <button
                  className={`w-[48px] h-[48px] border rounded-[10px] text-[24px] text-[#64748B] flex items-center justify-center transition-colors
                    ${Number(printSettings.rangeFrom) <= 1 ? 'opacity-30 cursor-not-allowed' : 'border-[#E2E8F0] hover:border-primary active:bg-[#EFF6FF]'}`}
                  onClick={() => {
                    const cur = Number(printSettings.rangeFrom) || 1;
                    if (cur > 1) {
                      const v = String(cur - 1);
                      setPrintSettings((prev) => ({ ...prev, rangeFrom: v, pageRange: v && prev.rangeTo ? `${v}-${prev.rangeTo}` : prev.pageRange }));
                    }
                  }}
                  disabled={Number(printSettings.rangeFrom) <= 1}
                  data-testid="range-from-minus"
                >−</button>
                <input
                  type="text"
                  inputMode="none"
                  className={`w-[72px] h-[48px] border rounded-[10px] text-center text-[20px] font-semibold focus:outline-none cursor-pointer transition-colors ${
                    numpadTarget === 'rangeFrom' ? 'border-primary bg-[#EFF6FF] shadow-md shadow-primary/10' : 'border-[#E2E8F0] focus:border-primary'
                  }`}
                  value={printSettings.rangeFrom ?? ''}
                  readOnly
                  onFocus={() => openNumpad('rangeFrom')}
                  onClick={() => openNumpad('rangeFrom')}
                  data-testid="range-from"
                />
                <button
                  className={`w-[48px] h-[48px] border rounded-[10px] text-[24px] text-[#64748B] flex items-center justify-center transition-colors
                    ${Number(printSettings.rangeFrom) >= filePageCount ? 'opacity-30 cursor-not-allowed' : 'border-[#E2E8F0] hover:border-primary active:bg-[#EFF6FF]'}`}
                  onClick={() => {
                    const cur = Number(printSettings.rangeFrom) || 0;
                    if (cur < filePageCount) {
                      const v = String(cur + 1);
                      setPrintSettings((prev) => ({ ...prev, rangeFrom: v, pageRange: v && prev.rangeTo ? `${v}-${prev.rangeTo}` : prev.pageRange }));
                    }
                  }}
                  disabled={Number(printSettings.rangeFrom) >= filePageCount}
                  data-testid="range-from-plus"
                >+</button>
              </div>

              {/* ── До ── */}
              <label className="text-[16px] text-dark-blue font-medium">{t('screen3.rangeTo')}</label>
              <div className="flex items-center gap-1.5">
                <button
                  className={`w-[48px] h-[48px] border rounded-[10px] text-[24px] text-[#64748B] flex items-center justify-center transition-colors
                    ${Number(printSettings.rangeTo) <= 1 ? 'opacity-30 cursor-not-allowed' : 'border-[#E2E8F0] hover:border-primary active:bg-[#EFF6FF]'}`}
                  onClick={() => {
                    const cur = Number(printSettings.rangeTo) || 1;
                    if (cur > 1) {
                      const v = String(cur - 1);
                      setPrintSettings((prev) => ({ ...prev, rangeTo: v, pageRange: prev.rangeFrom && v ? `${prev.rangeFrom}-${v}` : prev.pageRange }));
                    }
                  }}
                  disabled={Number(printSettings.rangeTo) <= 1}
                  data-testid="range-to-minus"
                >−</button>
                <input
                  type="text"
                  inputMode="none"
                  className={`w-[72px] h-[48px] border rounded-[10px] text-center text-[20px] font-semibold focus:outline-none cursor-pointer transition-colors ${
                    numpadTarget === 'rangeTo' ? 'border-primary bg-[#EFF6FF] shadow-md shadow-primary/10' : 'border-[#E2E8F0] focus:border-primary'
                  }`}
                  value={printSettings.rangeTo ?? ''}
                  readOnly
                  onFocus={() => openNumpad('rangeTo')}
                  onClick={() => openNumpad('rangeTo')}
                  data-testid="range-to"
                />
                <button
                  className={`w-[48px] h-[48px] border rounded-[10px] text-[24px] text-[#64748B] flex items-center justify-center transition-colors
                    ${Number(printSettings.rangeTo) >= filePageCount ? 'opacity-30 cursor-not-allowed' : 'border-[#E2E8F0] hover:border-primary active:bg-[#EFF6FF]'}`}
                  onClick={() => {
                    const cur = Number(printSettings.rangeTo) || 0;
                    if (cur < filePageCount) {
                      const v = String(cur + 1);
                      setPrintSettings((prev) => ({ ...prev, rangeTo: v, pageRange: prev.rangeFrom && v ? `${prev.rangeFrom}-${v}` : prev.pageRange }));
                    }
                  }}
                  disabled={Number(printSettings.rangeTo) >= filePageCount}
                  data-testid="range-to-plus"
                >+</button>
              </div>
            </div>
          )}
          {printSettings.pages === 'custom' && (
            <div className="mt-3">
              <input
                type="text"
                inputMode="none"
                className={`w-full h-14 border rounded-[10px] px-3 text-[17px] focus:outline-none cursor-pointer transition-colors ${
                  numpadTarget === 'custom' ? 'border-primary bg-[#EFF6FF] shadow-md shadow-primary/10' : 'border-[#E2E8F0] focus:border-primary'
                }`}
                placeholder={`1, 3, 4-7, ${filePageCount}`}
                value={printSettings.pageRange}
                readOnly
                onFocus={() => openNumpad('custom')}
                onClick={() => openNumpad('custom')}
                data-testid="custom-pages-input"
              />
              <div className="mt-2 bg-primary-light border-l-[3px] border-primary rounded-r-lg p-3.5">
                <p className="text-[15px] font-medium text-dark-blue">{t('screen3.customHelpTitle')}</p>
                <p className="text-[15px] text-[#64748B] mt-1">{t('screen3.customHelp1')}</p>
                <p className="text-[15px] text-[#64748B]">{t('screen3.customHelp2')}</p>
                <p className="text-[15px] text-[#64748B]">{t('screen3.customHelp3')}</p>
              </div>
            </div>
          )}
        </div>
        )}

        {/* Setting 2: Copies */}
        <div>
          <h3 className="text-[18px] font-medium text-dark-blue">{t('screen3.copies')}</h3>
          <div className="flex items-center gap-4 mt-3">
            <button
              className={`w-[58px] h-[58px] border rounded-[10px] text-[28px] text-[#64748B] flex items-center justify-center
                ${printSettings.copies <= 1 ? 'opacity-30 cursor-not-allowed' : 'border-[#E2E8F0] hover:border-primary'}`}
              onClick={() => printSettings.copies > 1 && update('copies', printSettings.copies - 1)}
              disabled={printSettings.copies <= 1}
              data-testid="copies-minus"
            >
              −
            </button>
            <span className="min-w-[48px] text-center text-[30px] font-medium text-dark-blue" data-testid="copies-count">{printSettings.copies}</span>
            <button
              className="w-[58px] h-[58px] border border-[#E2E8F0] rounded-[10px] text-[28px] text-[#64748B] flex items-center justify-center hover:border-primary"
              onClick={() => update('copies', printSettings.copies + 1)}
              data-testid="copies-plus"
            >
              +
            </button>
          </div>
        </div>

        {/* Setting 3: Pages per side — для картинок нет смысла */}
        {!isImage && (
          <div>
            <h3 className="text-[18px] font-medium text-dark-blue">{t('screen3.pagesPerSide')}</h3>
            <div className="grid grid-cols-4 gap-2.5 mt-3">
              {[1, 2, 4, 8].map(n => (
                <button
                  key={n}
                  className={`border rounded-[12px] py-4 flex flex-col items-center gap-1.5 cursor-pointer transition-all duration-150
                    ${printSettings.pagesPerSide === n
                      ? 'border-2 border-primary bg-primary-light shadow-md shadow-primary/10'
                      : 'border-[1.5px] border-[#E2E8F0] hover:border-[#CBD5E1]'}`}
                  onClick={() => update('pagesPerSide', n)}
                  data-testid={`pps-${n}`}
                >
                  <span className={`text-[22px] font-bold ${printSettings.pagesPerSide === n ? 'text-primary' : 'text-dark-blue'}`}>{n}</span>
                  <span className="text-[12px] text-muted">{t('screen3.perSheet')}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Setting 4: Duplex — temporarily disabled */}
        <div className="border-[1.5px] border-[#E2E8F0] rounded-[12px] flex items-center justify-between px-5 py-4 opacity-50 pointer-events-none select-none">
          <div>
            <div className="flex items-center gap-2">
              <p className="text-[17px] font-medium text-dark-blue">{t('screen3.duplex')}</p>
              <span className="text-[13px] bg-[#F1F5F9] text-[#64748B] px-2.5 py-0.5 rounded-full font-medium">{t('screen3.soon')}</span>
            </div>
            <p className="text-[15px] text-muted">{t('screen3.duplexHint')}</p>
          </div>
          <Toggle checked={false} onChange={() => {}} />
        </div>

        </div>{/* end scrollable settings */}

        {/* ── Виртуальная цифровая клавиатура ── */}
        {numpadTarget && (
          <div className="flex-shrink-0 px-4 pb-2" style={{ height: 280 }}>
            <NumericKeyboard
              onKey={handleNumKey}
              onBackspace={handleNumBackspace}
              onClose={closeNumpad}
              onSubmit={closeNumpad}
            />
          </div>
        )}

        {/* Bottom buttons — always visible */}
        <div className="flex-shrink-0 px-8 pb-8 pt-5 flex gap-3 border-t border-[#E2E8F0]">
          <button
            className="flex-1 h-[60px] border border-[#E2E8F0] text-[#64748B] rounded-[12px] text-[17px]"
            onClick={onBack}
            data-testid="back-btn"
          >
            ← {t('common.back')}
          </button>
          <button
            className="flex-1 h-[60px] bg-primary text-white rounded-[12px] text-[17px] font-medium"
            onClick={onNext}
            data-testid="payment-btn"
          >
            {t('screen3.goToPayment')} →
          </button>
        </div>
      </div>
    </div>
  );
});

export default Screen3Settings;
