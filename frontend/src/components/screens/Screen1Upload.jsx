import React, { useState } from 'react';
import { fetchSession } from '../../utils/api';
import VirtualKeyboard from '../VirtualKeyboard';
import AdPanel from '../AdPanel';
import { useT } from '../../i18n/LanguageProvider';

const CODE_MAX_LEN = 6;
const CODE_ALPHABET = /[A-Z0-9]/;

const PrintIcon = () => (
  <svg width="56" height="56" viewBox="0 0 48 48" fill="none">
    <rect x="10" y="18" width="28" height="20" rx="4" fill="white" opacity="0.2"/>
    <rect x="10" y="18" width="28" height="20" rx="4" stroke="white" strokeWidth="1.8"/>
    <rect x="14" y="10" width="20" height="12" rx="2" fill="white"/>
    <rect x="14" y="30" width="20" height="12" rx="2" fill="white"/>
    <line x1="18" y1="34" x2="30" y2="34" stroke="#93C5FD" strokeWidth="1.8" strokeLinecap="round"/>
    <line x1="18" y1="38" x2="26" y2="38" stroke="#93C5FD" strokeWidth="1.8" strokeLinecap="round"/>
    <circle cx="34" cy="25" r="2.5" fill="#22C55E"/>
  </svg>
);

const Screen1Upload = React.memo(({ onNext, onSessionLoaded }) => {
  const { t } = useT();
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [kbOpen, setKbOpen] = useState(false);

  const handleCodeChange = (e) => {
    const val = e.target.value
      .toUpperCase()
      .split('')
      .filter((c) => CODE_ALPHABET.test(c))
      .join('')
      .slice(0, CODE_MAX_LEN);
    setCode(val);
    if (error) setError('');
  };

  const handleKbKey = (ch) => {
    setCode((c) => (c.length >= CODE_MAX_LEN ? c : c + ch));
    if (error) setError('');
  };

  const handleKbBackspace = () => {
    setCode((c) => c.slice(0, -1));
  };

  const handleOpen = async () => {
    if (loading) return;
    setError('');
    setLoading(true);
    try {
      const session = await fetchSession(code);
      if (onSessionLoaded) onSessionLoaded(session);
      onNext();
    } catch (err) {
      setError(err.message || 'Не удалось загрузить документ');
    } finally {
      setLoading(false);
    }
  };

  const handleKbSubmit = () => {
    setKbOpen(false);
    handleOpen();
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') handleOpen();
  };

  return (
    <div className="flex min-h-full bg-[#F8FAFC]">
      {/* ── LEFT — Ad / promo panel ── */}
      <div className="w-[34%] flex-shrink-0 bg-[#F0F6FF] border-r border-[#E2E8F0] flex items-stretch justify-center py-12">
        <div className="w-[75%] flex">
          <AdPanel />
        </div>
      </div>

      {/* ── RIGHT — Main content ── */}
      <div className="flex-1 flex flex-col">
        {/* Hero banner */}
        <div className="bg-gradient-to-r from-[#1E3A5F] to-[#1D4ED8] px-12 py-5 flex items-center gap-6 flex-shrink-0 relative overflow-hidden">
          <div className="absolute -right-10 -top-10 w-56 h-56 rounded-full bg-white/5" />
          <div className="absolute right-24 bottom-0 w-40 h-40 rounded-full bg-white/5" />
          <div className="w-[84px] h-[84px] rounded-2xl bg-white/15 backdrop-blur-sm flex items-center justify-center flex-shrink-0 relative z-10">
            <PrintIcon />
          </div>
          <div className="relative z-10">
            <h1 className="text-[42px] font-bold text-white leading-[1.05] tracking-tight">
              {t('screen1.heroTitle')} <span className="text-[#7DD3FC]">{t('screen1.heroAccent')}</span>
            </h1>
            <p className="text-[17px] text-[#BFDBFE] mt-1.5">
              {t('screen1.heroSubtitle')}
            </p>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 min-h-0 px-12 py-4 flex flex-col gap-3">
          {/* Step 1 — скрыто пока открыта виртуальная клавиатура */}
          {!kbOpen && (
            <div>
              <div className="flex items-center gap-3 mb-4">
                <div className="w-9 h-9 rounded-full bg-primary flex items-center justify-center flex-shrink-0 shadow-md shadow-primary/30">
                  <span className="text-white text-[16px] font-bold">1</span>
                </div>
                <h2 className="text-[20px] font-bold text-dark-blue">{t('screen1.step1Title')}</h2>
              </div>

              <div className="flex gap-5">
                {/* Telegram */}
                <div className="flex-1 bg-white border-[1.5px] border-[#E2E8F0] rounded-2xl p-4 hover:border-[#229ED9] hover:shadow-lg hover:shadow-[#229ED9]/10 transition-all duration-200 cursor-pointer flex flex-col items-center text-center group">
                  <div className="flex items-center gap-2.5">
                    <img src="/photos/Telegram_2019_Logo.svg.png" alt="Telegram" className="w-11 h-11 object-contain" />
                    <p className="text-[20px] font-bold text-dark-blue">{t('screen1.telegram')}</p>
                  </div>
                  <div className="mt-3 w-[240px] h-[240px] bg-white rounded-2xl flex items-center justify-center border-2 border-[#F1F5F9] overflow-hidden p-1.5">
                    <img src="/photos/telegramQR.jpg" alt="QR Telegram" className="w-full h-full object-contain rounded-xl" />
                  </div>
                  <div className="mt-2.5 inline-flex items-center gap-1.5 bg-[#F0F9FF] text-[#229ED9] px-3.5 py-1.5 rounded-full">
                    <span className="text-[15px] font-bold">@AUCopyBot</span>
                  </div>
                </div>

                {/* WhatsApp */}
                <div className="flex-1 bg-white border-[1.5px] border-[#E2E8F0] rounded-2xl p-4 hover:border-[#25D366] hover:shadow-lg hover:shadow-[#25D366]/10 transition-all duration-200 cursor-pointer flex flex-col items-center text-center group">
                  <div className="flex items-center gap-2.5">
                    <img src="/photos/whatsapp.png" alt="WhatsApp" className="w-11 h-11 object-contain" />
                    <p className="text-[20px] font-bold text-dark-blue">{t('screen1.whatsapp')}</p>
                  </div>
                  <div className="mt-3 w-[240px] h-[240px] bg-white rounded-2xl flex items-center justify-center border-2 border-[#F1F5F9] overflow-hidden p-1.5">
                    <img src="/photos/whatsappQr.png" alt="QR WhatsApp" className="w-full h-full object-contain rounded-xl" />
                  </div>
                  <div className="mt-2.5 inline-flex items-center gap-1.5 bg-[#F0FDF4] text-[#25D366] px-3.5 py-1.5 rounded-full">
                    <span className="text-[15px] font-bold">+7 (706) 600-25-67</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Divider */}
          {!kbOpen && (
            <div className="flex items-center gap-4">
              <div className="flex-1 h-px bg-gradient-to-r from-transparent via-[#CBD5E1] to-transparent" />
              <span className="text-[12px] font-bold text-[#94A3B8] uppercase tracking-[0.25em]">{t('screen1.then')}</span>
              <div className="flex-1 h-px bg-gradient-to-r from-transparent via-[#CBD5E1] to-transparent" />
            </div>
          )}

          {/* Step 2 */}
          <div className="flex-shrink-0">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-9 h-9 rounded-full bg-primary flex items-center justify-center flex-shrink-0 shadow-md shadow-primary/30">
                <span className="text-white text-[16px] font-bold">2</span>
              </div>
              <h2 className="text-[20px] font-bold text-dark-blue">{t('screen1.step2Title')}</h2>
            </div>

            <p className="text-[14px] text-[#0F172A] mb-3 ml-12">{t('screen1.step2Hint')}</p>
            <input
              type="text"
              inputMode="none"
              className={`w-full h-[68px] text-[32px] tracking-[0.32em] text-center border-[1.5px] rounded-2xl placeholder-[#CBD5E1] placeholder:text-[20px] placeholder:tracking-normal placeholder:normal-case placeholder:font-medium focus:outline-none uppercase transition-all duration-150 font-bold bg-white cursor-pointer shadow-sm ${
                error
                  ? 'border-red-400 focus:border-red-500 focus:bg-red-50'
                  : 'border-[#E2E8F0] focus:border-primary focus:bg-[#EFF6FF] focus:shadow-md focus:shadow-primary/10'
              }`}
              placeholder={t('screen1.codePlaceholder')}
              value={code}
              onChange={handleCodeChange}
              onKeyDown={handleKeyDown}
              onFocus={() => setKbOpen(true)}
              onClick={() => setKbOpen(true)}
              disabled={loading}
              data-testid="code-input"
            />
            {error && (
              <p className="mt-2 text-[14px] text-red-500 ml-1" data-testid="code-error">{error}</p>
            )}
            <button
              className="mt-3 w-full h-[68px] bg-gradient-to-r from-primary to-[#1D4ED8] text-white text-[20px] rounded-2xl hover:shadow-lg hover:shadow-primary/40 active:scale-[0.99] transition-all duration-150 font-bold disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-3"
              onClick={handleOpen}
              disabled={loading || !code.trim()}
              data-testid="open-doc-btn"
            >
              {loading ? (
                <>
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" className="animate-spin">
                    <circle cx="12" cy="12" r="10" stroke="white" strokeWidth="3" strokeOpacity="0.3"/>
                    <path d="M22 12a10 10 0 00-10-10" stroke="white" strokeWidth="3" strokeLinecap="round"/>
                  </svg>
                  {t('screen1.loading')}
                </>
              ) : (
                <>
                  {t('screen1.openDocument')}
                  <span className="text-[22px]">→</span>
                </>
              )}
            </button>
          </div>

          {/* Виртуальная клавиатура */}
          {kbOpen && (
            <div className="flex-1 min-h-0">
              <VirtualKeyboard
                onKey={handleKbKey}
                onBackspace={handleKbBackspace}
                onClose={() => setKbOpen(false)}
                onSubmit={handleKbSubmit}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
});

export default Screen1Upload;
