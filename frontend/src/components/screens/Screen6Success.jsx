import React, { useState, useEffect, useRef } from 'react';
import { deleteSession, printDocument } from '../../utils/api';
import { useT } from '../../i18n/LanguageProvider';

const CIRCLE_R = 28;
const CIRCLE_CIRCUMFERENCE = 2 * Math.PI * CIRCLE_R;

// Сколько страниц источника попадает в диапазон вида "1-3,5,7-9".
const countPagesInRange = (s, total) => {
  if (!s) return 0;
  const seen = new Set();
  for (const part of s.split(',')) {
    const trimmed = part.trim();
    const m = trimmed.match(/^(\d+)\s*-\s*(\d+)$/);
    if (m) {
      const a = +m[1], b = +m[2];
      const lo = Math.max(1, Math.min(a, b));
      const hi = Math.min(total, Math.max(a, b));
      for (let p = lo; p <= hi; p++) seen.add(p);
    } else if (/^\d+$/.test(trimmed)) {
      const p = +trimmed;
      if (p >= 1 && p <= total) seen.add(p);
    }
  }
  return seen.size;
};

// Сколько листов уйдёт на печать: учитывает page-range, N-up и копии.
const computeTotalSheets = (file, settings) => {
  const total = file?.pageCount || 1;
  let selected;
  if (settings?.pages === 'range' && settings?.pageRange) {
    selected = countPagesInRange(settings.pageRange, total) || total;
  } else {
    selected = total;
  }
  const sheetsPerCopy = Math.ceil(selected / (settings?.pagesPerSide || 1));
  return sheetsPerCopy * (settings?.copies || 1);
};

const PrivacyNotice = ({ text }) => (
  <div className="flex items-center gap-2 mt-5 bg-[#F0FDF4] border border-[#BBF7D0] rounded-[12px] px-5 py-3">
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" className="flex-shrink-0">
      <path d="M10 2L3 5v5c0 4.4 3 8.3 7 9.3 4-1 7-4.9 7-9.3V5l-7-3z" stroke="#16A34A" strokeWidth="1.5" strokeLinejoin="round"/>
      <path d="M7 10l2 2 4-4" stroke="#16A34A" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
    <p className="text-[15px] text-[#15803D]">{text}</p>
  </div>
);

const Screen6Success = React.memo(({ printSettings, sessionCode, file, orientation = 'portrait', onRestart }) => {
  const { t } = useT();
  const [printProgress, setPrintProgress] = useState(0);
  const [isComplete, setIsComplete] = useState(false);
  const [countdown, setCountdown] = useState(10);
  const [checkAnimated, setCheckAnimated] = useState(false);
  const [printError, setPrintError] = useState(null);
  const [actualSheets, setActualSheets] = useState(null);  // ответ от backend
  const [printMode, setPrintMode] = useState(null);        // 'printer' | 'file'
  const [outputPath, setOutputPath] = useState(null);
  const expectedSheets = computeTotalSheets(file, printSettings);
  const totalSheets = actualSheets ?? expectedSheets;
  // Номер текущего листа выводим из прогресса — не держим в state, чтобы
  // обновление totalSheets не перезапускало анимацию прогресса.
  const currentPrintPage = Math.max(1, Math.ceil((printProgress / 100) * totalSheets));
  const printStartedRef = useRef(false);

  useEffect(() => {
    setCheckAnimated(true);
    // Анимация прогресса до ~92% — пока ждём backend, выглядит "живым".
    const interval = setInterval(() => {
      setPrintProgress((p) => {
        const next = p + 1.2;
        if (next >= 92) {
          clearInterval(interval);
          return 92;
        }
        return next;
      });
    }, 80);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    // printStartedRef переживает двойной mount React.StrictMode, поэтому запрос
    // уходит ровно один раз. Намеренно НЕ возвращаем cleanup с флагом cancelled:
    // иначе фейковый размонтаж StrictMode «отменил» бы единственный запрос и
    // обработчик ответа никогда не вызвал бы setIsComplete (экран зависал на 92%).
    if (printStartedRef.current) return;
    if (!sessionCode || !printSettings) return;
    printStartedRef.current = true;

    const payload = {
      pages: printSettings.pages,
      pageRange: printSettings.pageRange || '',
      copies: printSettings.copies,
      pagesPerSide: printSettings.pagesPerSide,
      duplex: printSettings.duplex,
      orientation,
    };

    // Безопасный таймаут — чтобы не висеть бесконечно, если бэкенд не ответил.
    const failsafe = setTimeout(() => {
      if (printStartedRef.current === 'done') return;
      console.warn('[Screen6] print timeout — forcing completion');
      setPrintError('Печать слишком долго отвечает');
      setPrintProgress(100);
      setIsComplete(true);
    }, 45000);

    printDocument(sessionCode, payload)
      .then((result) => {
        printStartedRef.current = 'done';
        clearTimeout(failsafe);
        const finalSheets = (result && typeof result.sheets === 'number')
          ? result.sheets * (printSettings.copies || 1)
          : expectedSheets;
        if (result?.mode) setPrintMode(result.mode);
        if (result?.output) setOutputPath(result.output);
        setActualSheets(finalSheets);
        // Плавно докручиваем оставшийся прогресс до 100, потом переключаем экран.
        const finish = setInterval(() => {
          setPrintProgress((p) => {
            const next = Math.min(100, p + 4);
            if (next >= 100) {
              clearInterval(finish);
              // Даём CSS-полосе доехать до 100% (transition 500ms), потом меняем экран.
              setTimeout(() => setIsComplete(true), 600);
            }
            return next;
          });
        }, 40);
      })
      .catch((err) => {
        printStartedRef.current = 'done';
        clearTimeout(failsafe);
        console.error('[Screen6] print failed:', err);
        setPrintError(err.message || 'Не удалось отправить на принтер');
        setPrintProgress(100);
        setIsComplete(true);
      });
  }, [sessionCode, printSettings, orientation, expectedSheets]);

  useEffect(() => {
    if (!isComplete) return;
    deleteSession(sessionCode);
    const timer = setTimeout(() => onRestart(), 10000);
    const countInterval = setInterval(() => {
      setCountdown(c => Math.max(0, c - 1));
    }, 1000);
    return () => { clearTimeout(timer); clearInterval(countInterval); };
  }, [isComplete, onRestart]);

  const strokeDashoffset = CIRCLE_CIRCUMFERENCE * (1 - countdown / 10);

  if (!isComplete) {
    return (
      <div className="flex flex-col items-center justify-center h-full bg-white screen-enter">
        {/* Checkmark */}
        <div className="w-[100px] h-[100px] rounded-full bg-[#22C55E] flex items-center justify-center"
          style={{ transform: checkAnimated ? 'scale(1)' : 'scale(0)', transition: 'transform 0.5s cubic-bezier(0.34, 1.56, 0.64, 1)' }}>
          <svg width="60" height="60" viewBox="0 0 60 60" fill="none">
            <path
              d="M12 30l14 14 22-28"
              stroke="white"
              strokeWidth="4"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeDasharray="100"
              strokeDashoffset="0"
              className="check-animate"
            />
          </svg>
        </div>

        <h1 className="text-[38px] font-medium text-dark-blue mt-6 text-center">{t('screen6.paymentOk')}</h1>
        <p className="text-[20px] text-muted text-center">{t('screen6.sentToPrinter')}</p>

        {/* Progress card */}
        <div className="mt-8 bg-white border border-[#E2E8F0] rounded-[20px] p-9 w-[520px] flex flex-col gap-4">
          <div className="flex justify-between">
            <span className="text-[18px] text-[#64748B]">{t('screen6.printing')}</span>
            <span className="text-[18px] text-primary font-medium" data-testid="print-page">
              {t('screen6.sheet')} {Math.min(currentPrintPage, totalSheets)} {t('screen6.of')} {totalSheets}
            </span>
          </div>
          <div className="w-full h-3.5 bg-[#E2E8F0] rounded-full overflow-hidden">
            <div
              className="h-full bg-primary rounded-full transition-all duration-500 ease-linear"
              style={{ width: `${printProgress}%` }}
              data-testid="print-progress"
            />
          </div>
          <p className="text-[16px] text-muted text-center">{t('screen6.remainingTime', { n: Math.ceil((100 - printProgress) / 100 * 8) })}</p>
        </div>

        <p className="text-[17px] text-muted text-center mt-6">{t('screen6.pickupHint')}</p>
        <PrivacyNotice text={t('screen6.privacy')} />
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center h-full bg-white screen-enter">
      {/* Success checkmark with confetti */}
      <div className="relative">
        <div className="w-[120px] h-[120px] rounded-full bg-[#22C55E] flex items-center justify-center">
          <svg width="70" height="70" viewBox="0 0 70 70" fill="none">
            <path d="M14 35l17 17 25-32" stroke="white" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </div>
        {/* Confetti dots */}
        {[
          { color: '#E83232', tx: '-60px', ty: '-50px' },
          { color: '#22C55E', tx: '60px', ty: '-50px' },
          { color: '#2563EB', tx: '-40px', ty: '60px' },
          { color: '#F59E0B', tx: '50px', ty: '60px' },
        ].map((dot, i) => (
          <div
            key={i}
            className="absolute w-3 h-3 rounded-full confetti-dot"
            style={{
              backgroundColor: dot.color,
              top: '50%',
              left: '50%',
              '--tx': dot.tx,
              '--ty': dot.ty,
            }}
          />
        ))}
      </div>

      <h1 className="text-[36px] font-medium text-dark-blue mt-6 text-center">
        {printError ? t('screen6.doneError') : t('screen6.doneTitle')}
      </h1>
      <p className="text-[20px] text-muted text-center">
        {printError ? t('screen6.doneSubtitleError') : t('screen6.doneSubtitle')}
      </p>
      {printError && (
        <div className="mt-3 bg-red-50 border border-red-200 rounded-[10px] px-4 py-2 max-w-[600px]">
          <p className="text-[14px] text-red-700 text-center">{printError}</p>
        </div>
      )}

      {/* Summary card */}
      <div className="mt-6 bg-primary-light rounded-[16px] p-7 w-[460px]">
        {[
          [t('screen6.summaryFile'), file?.name || t('common.document')],
          [t('screen6.summaryCopies'), String(printSettings.copies)],
          [t('screen6.summaryPagesPerSide'), String(printSettings.pagesPerSide)],
          [t('screen6.summaryDuplex'), printSettings.duplex ? t('common.yes') : t('common.no')],
          [t('screen6.summarySheets'), String(totalSheets)],
        ].map(([label, value]) => (
          <div key={label} className="flex justify-between py-2 border-b border-[#DBEAFE] last:border-0">
            <span className="text-[16px] text-muted">{label}</span>
            <span className="text-[16px] font-medium text-dark-blue">{value}</span>
          </div>
        ))}
      </div>

      {printMode === 'file' && outputPath && (
        <div className="mt-3 bg-blue-50 border border-blue-200 rounded-[10px] px-4 py-2 max-w-[600px]">
          <p className="text-[13px] text-blue-700 text-center">
            {t('screen6.testMode', { path: outputPath })}
          </p>
        </div>
      )}

      {/* Countdown */}
      <div className="mt-8 flex flex-col items-center gap-3">
        <div className="relative w-16 h-16">
          <svg width="64" height="64" viewBox="0 0 64 64">
            <circle cx="32" cy="32" r={CIRCLE_R} fill="none" stroke="#E2E8F0" strokeWidth="4"/>
            <circle
              cx="32" cy="32" r={CIRCLE_R}
              fill="none"
              stroke="#2563EB"
              strokeWidth="4"
              strokeLinecap="round"
              strokeDasharray={CIRCLE_CIRCUMFERENCE}
              strokeDashoffset={strokeDashoffset}
              transform="rotate(-90 32 32)"
              style={{ transition: 'stroke-dashoffset 1s linear' }}
            />
          </svg>
          <span className="absolute inset-0 flex items-center justify-center text-[20px] font-medium text-primary">{countdown}</span>
        </div>
        <p className="text-[17px] text-muted">{t('screen6.countdown', { n: countdown })}</p>
      </div>

      <PrivacyNotice text={t('screen6.privacy')} />

      <button
        className="mt-4 h-[58px] w-[240px] bg-primary text-white rounded-[12px] text-[18px] font-medium hover:bg-[#1D4ED8] transition-colors"
        onClick={onRestart}
        data-testid="restart-btn"
      >
        {t('screen6.restart')}
      </button>
    </div>
  );
});

export default Screen6Success;
