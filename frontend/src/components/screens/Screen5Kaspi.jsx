import React, { useState, useEffect } from 'react';
import { usePrintPrice } from '../../hooks/usePrintPrice';

const QRMock = () => (
  <svg width="180" height="180" viewBox="0 0 180 180" fill="none">
    {[0,1,2,3,4,5,6].map(row =>
      [0,1,2,3,4,5,6].map(col => {
        const isCorner = (row < 2 && col < 2) || (row < 2 && col > 4) || (row > 4 && col < 2);
        const isDot = (row + col) % 3 === 0 || isCorner;
        return isDot ? (
          <rect key={`${row}-${col}`} x={10 + col * 24} y={10 + row * 24} width="20" height="20" rx="3" fill="#1E3A5F"/>
        ) : null;
      })
    )}
  </svg>
);

const Screen5Kaspi = React.memo(({ onSuccess, printSettings, filePageCount = 1 }) => {
  const priceInfo = usePrintPrice(printSettings || { pages: 'all', pageRange: '', copies: 1, pagesPerSide: 1, duplex: false }, filePageCount);
  const [seconds, setSeconds] = useState(300);

  useEffect(() => {
    const interval = setInterval(() => {
      setSeconds(s => {
        if (s <= 0) { clearInterval(interval); return 0; }
        return s - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  const timeStr = `${mins}:${secs.toString().padStart(2, '0')}`;

  const handleRefresh = () => {
    setSeconds(300);
    console.log('[Screen5Kaspi] QR refreshed');
  };

  const handleQRClick = () => {
    console.log('[Screen5Kaspi] Payment completed (mock)');
    onSuccess();
  };

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
            'Откройте приложение Kaspi.kz на вашем телефоне',
            'Нажмите кнопку «Платёжный QR» в главном меню',
            'Наведите камеру на QR-код справа',
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
            QR-код действителен 5 минут. Если время истекло — нажмите кнопку «Обновить QR»
          </p>
        </div>

        <div className="mt-5 inline-flex items-center gap-2 bg-kaspi-red text-white px-6 py-3 rounded-2xl text-[19px] font-semibold self-start">
          <svg width="18" height="18" viewBox="0 0 20 20" fill="none">
            <circle cx="10" cy="10" r="8" stroke="white" strokeWidth="1.5"/>
            <path d="M10 6v4l3 2" stroke="white" strokeWidth="1.5" strokeLinecap="round"/>
          </svg>
          Осталось {timeStr}
        </div>
      </div>

      {/* RIGHT — QR Code */}
      <div className="w-1/2 flex flex-col items-center justify-center p-10 bg-[#FAFBFF]">
        <div
          className="border-2 border-kaspi-red rounded-3xl p-8 bg-white flex flex-col items-center gap-4 cursor-pointer"
          onClick={handleQRClick}
          title="Нажмите для симуляции оплаты (MOCK)"
        >
          {/* Kaspi header */}
          <div className="flex items-center gap-2.5">
            <img src="/photos/kaspi.png" alt="Kaspi" className="w-10 h-10 object-contain" />
            <span className="text-[28px] font-bold text-kaspi-red tracking-tight">Kaspi</span>
          </div>

          <div className="h-px bg-[#F1F5F9] w-full" />

          {/* QR */}
          <div className="w-[220px] h-[220px] bg-[#F8FAFF] border border-[#E2E8F0] rounded-[14px] flex items-center justify-center">
            <QRMock />
          </div>
          {/* MOCK: replace with real QR from backend */}

          <div className="text-center">
            <p className="text-[15px] text-muted">Сумма к оплате</p>
            <p className="text-[38px] font-bold text-kaspi-red leading-tight">{priceInfo.total} ₸</p>
          </div>

          <div className="h-px bg-[#F1F5F9] w-full" />
          <span className="text-[15px] text-muted">Получатель: <span className="font-semibold text-dark-blue">AU Copy</span></span>
        </div>

        <button
          className="mt-4 border border-[1.5px] border-kaspi-red text-kaspi-red bg-white h-11 rounded-[10px] w-[220px] text-[16px] font-medium hover:bg-kaspi-light transition-colors duration-150"
          onClick={handleRefresh}
          data-testid="refresh-qr"
        >
          ↻ Обновить QR
        </button>
      </div>
    </div>
  );
});

export default Screen5Kaspi;
