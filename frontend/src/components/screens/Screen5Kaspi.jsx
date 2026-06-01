import React from 'react';
import { usePrintPrice } from '../../hooks/usePrintPrice';
import { useKaspiPayment } from '../../hooks/useKaspiPayment';

const FALLBACK_SETTINGS = { pages: 'all', pageRange: '', copies: 1, pagesPerSide: 1, duplex: false };

// Иконка терминала (QR теперь показывается НА терминале, а не на киоске).
const TerminalIcon = ({ pulse }) => (
  <svg width="120" height="120" viewBox="0 0 120 120" fill="none" className={pulse ? 'animate-pulse' : ''}>
    <rect x="30" y="10" width="60" height="100" rx="10" fill="#1E3A5F" />
    <rect x="37" y="20" width="46" height="34" rx="4" fill="#FFFFFF" />
    {/* мини-QR на экранчике терминала */}
    {[0, 1, 2, 3].map((r) =>
      [0, 1, 2, 3].map((c) =>
        (r + c) % 2 === 0 ? (
          <rect key={`${r}-${c}`} x={42 + c * 9} y={25 + r * 6} width="6" height="4" rx="1" fill="#1E3A5F" />
        ) : null
      )
    )}
    <circle cx="60" cy="78" r="12" fill="#E11D48" />
    <path d="M55 78l3.5 3.5L66 74" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const Spinner = () => (
  <svg className="animate-spin" width="100" height="100" viewBox="0 0 50 50">
    <circle cx="25" cy="25" r="20" fill="none" stroke="#FDE2E7" strokeWidth="5" />
    <path d="M25 5a20 20 0 0 1 20 20" fill="none" stroke="#E11D48" strokeWidth="5" strokeLinecap="round" />
  </svg>
);

const Screen5Kaspi = React.memo(({ onSuccess, printSettings, filePageCount = 1, sessionCode }) => {
  const priceInfo = usePrintPrice(printSettings || FALLBACK_SETTINGS, filePageCount);
  const { phase, amount, message, retry } = useKaspiPayment(sessionCode, printSettings, onSuccess);
  const total = amount != null ? amount : priceInfo.total;

  // phase → крупный статус справа
  const view = {
    starting: { icon: <Spinner />, title: 'Готовим оплату…', sub: 'Подождите пару секунд' },
    waiting: { icon: <TerminalIcon pulse />, title: 'Отсканируйте QR на терминале', sub: 'Откройте Kaspi.kz → «Платёжный QR» и наведите камеру на экран терминала' },
    processing: { icon: <Spinner />, title: 'Подтвердите оплату в приложении', sub: 'Нажмите «Оплатить» в Kaspi.kz и дождитесь подтверждения' },
    unknown: { icon: <Spinner />, title: 'Проверяем статус оплаты…', sub: message || 'Не оплачивайте повторно' },
    success: { icon: <TerminalIcon />, title: 'Оплата получена!', sub: 'Переходим к печати…' },
    fail: { icon: null, title: 'Оплата не прошла', sub: message || 'Попробуйте ещё раз' },
    error: { icon: null, title: 'Оплата сейчас недоступна', sub: 'Попробуйте ещё раз или обратитесь к персоналу' },
  }[phase] || { icon: <Spinner />, title: '…', sub: '' };

  const isErrorPhase = phase === 'fail' || phase === 'error';

  return (
    <div className="flex h-full">
      {/* LEFT — Instructions */}
      <div className="w-1/2 p-12 flex flex-col">
        <div className="flex items-center gap-3">
          <img src="/photos/kaspi.png" alt="Kaspi" className="w-10 h-10 object-contain" />
          <h1 className="text-[28px] font-bold text-dark-blue">Оплата через Kaspi QR</h1>
        </div>

        <div className="mt-8 flex flex-col gap-5">
          {[
            'Откройте приложение Kaspi.kz на телефоне',
            'Нажмите «Платёжный QR» в главном меню',
            'Наведите камеру на QR-код на экране терминала',
            'Проверьте сумму и получателя — AU Copy',
            'Нажмите «Оплатить» и дождитесь подтверждения',
          ].map((step, i) => (
            <div key={i} className="flex items-start gap-4">
              <div className="w-9 h-9 rounded-full bg-kaspi-red text-white flex items-center justify-center text-[17px] font-bold flex-shrink-0">
                {i + 1}
              </div>
              <p className="text-[18px] text-dark-blue leading-relaxed pt-1">{step}</p>
            </div>
          ))}
        </div>

        <div className="mt-7 bg-kaspi-light border-l-[3px] border-kaspi-red rounded-r-lg p-4">
          <p className="text-[15px] text-[#991B1B] leading-relaxed">
            Карту тоже можно приложить прямо к терминалу — он принимает и QR, и карты.
          </p>
        </div>
      </div>

      {/* RIGHT — Live status from terminal */}
      <div className="w-1/2 flex flex-col items-center justify-center p-10 bg-[#FAFBFF]">
        <div className="border-2 border-kaspi-red rounded-3xl p-10 bg-white flex flex-col items-center gap-5 w-[360px] min-h-[420px] justify-center text-center">
          <div className="flex items-center gap-2.5">
            <img src="/photos/kaspi.png" alt="Kaspi" className="w-9 h-9 object-contain" />
            <span className="text-[26px] font-bold text-kaspi-red tracking-tight">Kaspi</span>
          </div>

          <div className="flex items-center justify-center h-[130px]">
            {view.icon || (
              <div className="w-[100px] h-[100px] rounded-full bg-[#FEE2E2] flex items-center justify-center text-[48px] text-kaspi-red">!</div>
            )}
          </div>

          <div>
            <p className="text-[22px] font-bold text-dark-blue leading-snug">{view.title}</p>
            <p className="text-[15px] text-muted mt-2 leading-relaxed">{view.sub}</p>
          </div>

          <div className="h-px bg-[#F1F5F9] w-full" />
          <div>
            <p className="text-[14px] text-muted">Сумма к оплате</p>
            <p className="text-[34px] font-bold text-kaspi-red leading-tight">{total} ₸</p>
          </div>

          {isErrorPhase && (
            <button
              className="mt-1 bg-kaspi-red text-white h-12 rounded-[12px] w-full text-[17px] font-semibold active:scale-[0.99]"
              onClick={retry}
              data-testid="kaspi-retry"
            >
              Попробовать снова
            </button>
          )}
        </div>
      </div>
    </div>
  );
});

export default Screen5Kaspi;
