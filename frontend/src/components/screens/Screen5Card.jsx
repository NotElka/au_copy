import React from 'react';
import { usePrintPrice } from '../../hooks/usePrintPrice';
import { useKaspiPayment } from '../../hooks/useKaspiPayment';

const FALLBACK_SETTINGS = { pages: 'all', pageRange: '', copies: 1, pagesPerSide: 1, duplex: false };

const ContactlessIcon = () => (
  <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
    <path d="M14 8 C17.3 8 20.3 9.4 22.4 11.6" stroke="white" strokeWidth="2.2" strokeLinecap="round" />
    <path d="M14 12 C15.8 12 17.4 12.7 18.6 13.9" stroke="white" strokeWidth="2.2" strokeLinecap="round" />
    <path d="M14 16 C14.9 16 15.7 16.4 16.3 17" stroke="white" strokeWidth="2.2" strokeLinecap="round" />
    <circle cx="14" cy="20" r="2" fill="white" />
  </svg>
);

// Пульсирующие кольца + карта — «приложите карту к терминалу».
const CardWaiting = () => (
  <div className="relative flex items-center justify-center" style={{ width: 150, height: 150 }}>
    <div className="absolute rounded-full border-[1.5px] border-[#BFDBFE]" style={{ width: 150, height: 150, animation: 'ringPulse 2s 0.8s infinite' }} />
    <div className="absolute rounded-full border-[1.5px] border-[#93C5FD]" style={{ width: 116, height: 116, animation: 'ringPulse 2s 0.4s infinite' }} />
    <div className="absolute rounded-full border-[1.5px] border-[#60A5FA]" style={{ width: 84, height: 84, animation: 'ringPulse 2s 0s infinite' }} />
    <div className="w-16 h-16 rounded-full bg-primary flex items-center justify-center z-10">
      <ContactlessIcon />
    </div>
  </div>
);

const Spinner = () => (
  <svg className="animate-spin" width="100" height="100" viewBox="0 0 50 50">
    <circle cx="25" cy="25" r="20" fill="none" stroke="#DBEAFE" strokeWidth="5" />
    <path d="M25 5a20 20 0 0 1 20 20" fill="none" stroke="#2563EB" strokeWidth="5" strokeLinecap="round" />
  </svg>
);

const Screen5Card = React.memo(({ onSuccess, printSettings, filePageCount = 1, sessionCode }) => {
  const priceInfo = usePrintPrice(printSettings || FALLBACK_SETTINGS, filePageCount);
  const { phase, amount, message, retry } = useKaspiPayment(sessionCode, printSettings, onSuccess);
  const total = amount != null ? amount : priceInfo.total;

  const view = {
    starting: { icon: <Spinner />, title: 'Готовим оплату…', sub: 'Подождите пару секунд' },
    waiting: { icon: <CardWaiting />, title: 'Приложите карту к терминалу', sub: 'Карта, Apple Pay или Google Pay — приложите к терминалу и удерживайте до сигнала' },
    processing: { icon: <Spinner />, title: 'Обработка карты…', sub: 'Следуйте подсказкам на терминале (возможно, потребуется PIN-код)' },
    unknown: { icon: <Spinner />, title: 'Проверяем статус оплаты…', sub: message || 'Не оплачивайте повторно' },
    success: { icon: null, title: 'Оплата получена!', sub: 'Переходим к печати…' },
    fail: { icon: null, title: 'Оплата не прошла', sub: message || 'Попробуйте ещё раз' },
    error: { icon: null, title: 'Оплата сейчас недоступна', sub: 'Попробуйте ещё раз или обратитесь к персоналу' },
  }[phase] || { icon: <Spinner />, title: '…', sub: '' };

  const isErrorPhase = phase === 'fail' || phase === 'error';

  return (
    <div className="flex h-full">
      {/* LEFT — Instructions */}
      <div className="w-1/2 p-12">
        <h1 className="text-[30px] font-medium text-primary">Оплата банковской картой</h1>

        <div className="mt-8 flex flex-col gap-5">
          {[
            'Приложите карту или телефон к терминалу',
            'Удерживайте 2-3 секунды до звукового сигнала',
            'При запросе введите PIN-код на терминале',
            'Дождитесь сообщения «Оплата принята»',
          ].map((step, i) => (
            <div key={i} className="flex items-start gap-4">
              <div className="w-9 h-9 rounded-full bg-primary text-white flex items-center justify-center text-[18px] font-medium flex-shrink-0">
                {i + 1}
              </div>
              <p className="text-[18px] text-dark-blue leading-relaxed">{step}</p>
            </div>
          ))}
        </div>

        <div className="mt-7 bg-primary-light border-l-[3px] border-primary rounded-r-lg p-4">
          <p className="text-[15px] text-dark-blue">
            Поддерживаются Visa, Mastercard и бесконтактная оплата (Apple Pay, Google Pay).
          </p>
        </div>
      </div>

      {/* RIGHT — Live status from terminal */}
      <div className="w-1/2 flex flex-col items-center justify-center gap-7 bg-[#FAFBFF]">
        <div className="flex items-center justify-center h-[160px]">
          {view.icon || (
            <div className={`w-[120px] h-[120px] rounded-full flex items-center justify-center text-[56px] ${phase === 'success' ? 'bg-[#DCFCE7] text-[#16A34A]' : 'bg-[#FEE2E2] text-kaspi-red'}`}>
              {phase === 'success' ? '✓' : '!'}
            </div>
          )}
        </div>

        <div className="text-center px-10">
          <p className="text-[24px] font-semibold text-dark-blue leading-snug">{view.title}</p>
          <p className="text-[16px] text-muted mt-2 leading-relaxed max-w-[420px]">{view.sub}</p>
        </div>

        <div className="text-center">
          <p className="text-[16px] text-muted">Сумма к оплате</p>
          <p className="text-[38px] font-medium text-primary">{total} ₸</p>
        </div>

        {isErrorPhase && (
          <button
            className="bg-primary text-white h-12 rounded-[12px] w-[280px] text-[17px] font-semibold hover:bg-[#1D4ED8] active:scale-[0.99]"
            onClick={retry}
            data-testid="card-retry"
          >
            Попробовать снова
          </button>
        )}
      </div>
    </div>
  );
});

export default Screen5Card;
