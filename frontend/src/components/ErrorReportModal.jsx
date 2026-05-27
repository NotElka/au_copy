import React, { useState, useRef } from 'react';
import { API_BASE } from '../utils/api';
import { useT } from '../i18n/LanguageProvider';
import TextKeyboard from './TextKeyboard';

const ErrorReportModal = React.memo(({ onClose, currentScreen }) => {
  const { t, lang } = useT();
  const typeOptions = ['type1', 'type2', 'type3', 'type4', 'type5'];
  const [errorType, setErrorType] = useState(typeOptions[0]);
  const [description, setDescription] = useState('');
  const [status, setStatus] = useState('idle');  // idle | sending | success | error
  const [errorMsg, setErrorMsg] = useState('');
  const [kbOpen, setKbOpen] = useState(false);
  const textareaRef = useRef(null);

  const handleSubmit = async () => {
    if (status === 'sending') return;
    setStatus('sending');
    setErrorMsg('');
    try {
      const res = await fetch(`${API_BASE}/api/error-report`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          category: t(`errorReport.${errorType}`),
          description: description.trim(),
          lang,
          screen: currentScreen,
        }),
      });
      if (res.status === 429) {
        const body = await res.json().catch(() => ({}));
        setStatus('error');
        setErrorMsg(body?.detail || t('errorReport.tooFrequent'));
        return;
      }
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setStatus('error');
        setErrorMsg(body?.detail || t('errorReport.tooShort'));
        return;
      }
      setStatus('success');
      // авто-закрытие через 2 секунды
      setTimeout(() => onClose(), 2000);
    } catch (e) {
      setStatus('error');
      setErrorMsg(t('errorReport.networkError'));
    }
  };

  const handleKbChar = (ch) => {
    setDescription((d) => (d.length >= 1000 ? d : d + ch));
  };

  const handleKbBackspace = () => {
    setDescription((d) => d.slice(0, -1));
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex px-6"
      style={{ alignItems: kbOpen ? 'flex-start' : 'center', paddingTop: kbOpen ? '24px' : '0' }}>
      <div className="bg-white rounded-3xl p-9 w-[520px] max-w-full shadow-2xl mx-auto">
        <h2 className="text-[26px] font-bold text-dark-blue">{t('errorReport.title')}</h2>

        {status === 'success' ? (
          <div className="mt-6 bg-[#F0FDF4] border-2 border-[#22C55E] rounded-2xl p-6 flex flex-col items-center gap-3">
            <div className="w-14 h-14 rounded-full bg-[#22C55E] flex items-center justify-center">
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none">
                <path d="M5 12l5 5L20 7" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>
            <p className="text-[17px] font-semibold text-[#15803D] text-center">{t('errorReport.success')}</p>
          </div>
        ) : (
          <>
            <label className="text-[14px] font-bold text-[#64748B] uppercase tracking-wider mt-5 block">
              {t('errorReport.typeLabel')}
            </label>
            <div className="mt-2 grid grid-cols-1 gap-2">
              {typeOptions.map((opt) => (
                <button
                  key={opt}
                  type="button"
                  onClick={() => setErrorType(opt)}
                  className={`text-left px-4 py-3 rounded-xl border-[1.5px] transition-all
                    ${errorType === opt
                      ? 'border-primary bg-primary-light text-primary font-bold'
                      : 'border-[#E2E8F0] text-dark-blue hover:bg-[#F8FAFC]'}`}
                >
                  {t(`errorReport.${opt}`)}
                </button>
              ))}
            </div>

            <label className="text-[14px] font-bold text-[#64748B] uppercase tracking-wider mt-5 block">
              {t('errorReport.descLabel')}
            </label>
            <textarea
              ref={textareaRef}
              className="mt-2 w-full border-[1.5px] border-[#E2E8F0] rounded-xl p-3 text-[16px] text-dark-blue resize-none focus:outline-none focus:border-primary"
              style={{ height: kbOpen ? '72px' : '100px' }}
              placeholder={t('errorReport.descPlaceholder')}
              value={description}
              onChange={(e) => setDescription(e.target.value.slice(0, 1000))}
              onFocus={() => setKbOpen(true)}
              inputMode="none"
              maxLength={1000}
              data-testid="error-description"
            />
            <p className="text-[12px] text-[#94A3B8] mt-1 text-right">{description.length}/1000</p>

            {status === 'error' && (
              <div className="mt-3 bg-red-50 border border-red-200 rounded-xl px-4 py-3">
                <p className="text-[14px] text-red-700">{errorMsg}</p>
              </div>
            )}

            <div className="mt-6 flex gap-3">
              <button
                className="flex-1 h-14 border-[1.5px] border-[#E2E8F0] bg-white text-[#64748B] rounded-xl text-[16px] font-semibold hover:bg-[#F8FAFC]"
                onClick={onClose}
                disabled={status === 'sending'}
              >
                {t('errorReport.cancel')}
              </button>
              <button
                className="flex-1 h-14 bg-primary text-white rounded-xl text-[16px] font-bold hover:bg-[#1D4ED8] disabled:opacity-50 active:scale-[0.99] transition-all"
                onClick={handleSubmit}
                disabled={status === 'sending'}
              >
                {status === 'sending' ? t('common.loading') : t('errorReport.submit')}
              </button>
            </div>
          </>
        )}
      </div>
      {kbOpen && (
        <TextKeyboard
          defaultLayout={lang === 'en' ? 'en' : lang === 'kk' ? 'kk' : 'ru'}
          onChar={handleKbChar}
          onBackspace={handleKbBackspace}
          onClose={() => setKbOpen(false)}
        />
      )}
    </div>
  );
});

export default ErrorReportModal;
