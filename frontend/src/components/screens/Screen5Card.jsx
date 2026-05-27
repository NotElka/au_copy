import React from 'react';
import { usePrintPrice } from '../../hooks/usePrintPrice';

const ContactlessIcon = () => (
  <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
    <path d="M14 8 C17.3 8 20.3 9.4 22.4 11.6" stroke="white" strokeWidth="2.2" strokeLinecap="round"/>
    <path d="M14 12 C15.8 12 17.4 12.7 18.6 13.9" stroke="white" strokeWidth="2.2" strokeLinecap="round"/>
    <path d="M14 16 C14.9 16 15.7 16.4 16.3 17" stroke="white" strokeWidth="2.2" strokeLinecap="round"/>
    <circle cx="14" cy="20" r="2" fill="white"/>
  </svg>
);

const CardIllustration = () => (
  <svg width="280" height="175" viewBox="0 0 280 175" fill="none">
    {/* Card body */}
    <rect width="280" height="175" rx="16" fill="#1E3A5F"/>
    {/* Subtle inner highlight */}
    <rect x="1" y="1" width="278" height="86" rx="15" fill="white" opacity="0.04"/>
    {/* Gold chip */}
    <rect x="24" y="28" width="42" height="32" rx="6" fill="#F59E0B"/>
    <line x1="24" y1="42" x2="66" y2="42" stroke="#E08C00" strokeWidth="1"/>
    <line x1="45" y1="28" x2="45" y2="60" stroke="#E08C00" strokeWidth="1"/>
    {/* Contactless icon top-right */}
    <g transform="translate(236, 24)">
      <path d="M10 2 C15.5 2 20.5 4.3 24 8" stroke="white" strokeWidth="1.8" strokeLinecap="round" opacity="0.7"/>
      <path d="M10 6.5 C13.5 6.5 16.7 7.9 19 10.3" stroke="white" strokeWidth="1.8" strokeLinecap="round" opacity="0.7"/>
      <path d="M10 11 C12 11 13.8 11.8 15.1 13.1" stroke="white" strokeWidth="1.8" strokeLinecap="round" opacity="0.7"/>
      <circle cx="10" cy="17" r="2" fill="white" opacity="0.7"/>
    </g>
    {/* Card number dots — 4 groups of 4 */}
    {[0, 1, 2, 3].map(group => (
      [0, 1, 2, 3].map(dot => (
        <circle
          key={`${group}-${dot}`}
          cx={28 + group * 68 + dot * 11}
          cy={112}
          r={4}
          fill="white"
          opacity="0.5"
        />
      ))
    ))}
    {/* Card brand placeholder bottom-right */}
    <rect x="224" y="138" width="32" height="20" rx="4" fill="white" opacity="0.4"/>
  </svg>
);

const Screen5Card = React.memo(({ onSuccess, printSettings, filePageCount = 1 }) => {
  const priceInfo = usePrintPrice(printSettings || { pages: 'all', pageRange: '', copies: 1, pagesPerSide: 1, duplex: false }, filePageCount);
  const handleClick = () => {
    console.log('[Screen5Card] Payment completed (mock)');
    onSuccess();
  };

  return (
    <div className="flex h-full">
      {/* LEFT — Instructions */}
      <div className="w-1/2 p-12">
        <h1 className="text-[30px] font-medium text-primary">Оплата банковской картой</h1>

        <div className="mt-8 flex flex-col gap-5">
          {[
            'Приложите карту или телефон к терминалу',
            'Удерживайте 2-3 секунды до звукового сигнала',
            'Дождитесь сообщения «Оплата принята» на экране',
            'Заберите карту — чек будет распечатан вместе с документом',
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
            Поддерживаются карты Visa, Mastercard, и бесконтактная оплата через Apple Pay и Google Pay
          </p>
        </div>
      </div>

      {/* RIGHT — Contactless illustration */}
      <div
        className="w-1/2 flex flex-col items-center justify-center gap-8 cursor-pointer"
        onClick={handleClick}
        title="Нажмите для симуляции оплаты (MOCK)"
      >
        {/* Pulsing rings + center circle */}
        <div className="relative flex items-center justify-center" style={{ width: 168, height: 168 }}>
          <div
            className="absolute rounded-full border-[1.5px] border-[#BFDBFE]"
            style={{ width: 168, height: 168, animation: 'ringPulse 2s 0.8s infinite' }}
          />
          <div
            className="absolute rounded-full border-[1.5px] border-[#93C5FD]"
            style={{ width: 132, height: 132, animation: 'ringPulse 2s 0.4s infinite' }}
          />
          <div
            className="absolute rounded-full border-[1.5px] border-[#60A5FA]"
            style={{ width: 96, height: 96, animation: 'ringPulse 2s 0s infinite' }}
          />
          <div className="w-16 h-16 rounded-full bg-primary flex items-center justify-center z-10">
            <ContactlessIcon />
          </div>
        </div>

        {/* Card illustration */}
        <div className="flex flex-col items-center gap-3">
          <CardIllustration />
          <p className="text-[17px] text-muted mt-1">Сумма к оплате</p>
          <p className="text-[38px] font-medium text-primary">{priceInfo.total} ₸</p>
          <div className="flex items-center gap-2">
            <div className="flex gap-1.5">
              <div className="w-2 h-2 rounded-full bg-primary dot-1" />
              <div className="w-2 h-2 rounded-full bg-primary dot-2" />
              <div className="w-2 h-2 rounded-full bg-primary dot-3" />
            </div>
            <span className="text-[18px] text-[#64748B]">Ожидание карты</span>
          </div>
        </div>
      </div>
    </div>
  );
});

export default Screen5Card;
