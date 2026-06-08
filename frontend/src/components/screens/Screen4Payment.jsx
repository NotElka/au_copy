import React from 'react';
import { usePrintPrice } from '../../hooks/usePrintPrice';
import { useT } from '../../i18n/LanguageProvider';

const CreditCardIcon = () => (
  <svg width="124" height="86" viewBox="0 0 52 36" fill="none">
    <rect width="52" height="36" rx="8" fill="#2563EB"/>
    <rect x="7" y="10" width="13" height="10" rx="2.5" fill="#F59E0B"/>
    <line x1="7" y1="20" x2="52" y2="20" stroke="white" strokeOpacity="0.15" strokeWidth="6"/>
    <g stroke="white" strokeWidth="1.8" fill="none" strokeLinecap="round">
      <path d="M39 18 C39 18 37 15 39 13 C41 11 44 13 44 13"/>
      <path d="M36 18 C36 18 33 14 36 11 C39 8 44 11 44 11"/>
    </g>
  </svg>
);

const Screen4Payment = React.memo(({
  paymentMethod,
  setPaymentMethod,
  printSettings,
  filePageCount = 1,
  file,
  onNext,
  onBack,
}) => {
  const { t } = useT();
  const priceInfo = usePrintPrice(printSettings, filePageCount);
  const total = priceInfo.total;

  const pagesLabel =
    printSettings.pages === 'all'
      ? `${t('screen4.allPagesShort')} (${filePageCount})`
      : printSettings.pageRange
        ? `${printSettings.pageRange} (${priceInfo.selectedPages})`
        : `${priceInfo.selectedPages}`;

  const handleConfirm = () => {
    onNext();
  };

  return (
    <div className="flex min-h-full">
      {/* LEFT — Order summary */}
      <div className="w-[42%] bg-[#F8FAFF] border-r border-[#E2E8F0] p-10 flex flex-col">
        <h2 className="text-[26px] font-semibold text-dark-blue">{t('screen4.yourOrder')}</h2>
        <div className="mt-5 bg-white border border-[#E2E8F0] rounded-[16px] overflow-hidden">
          {[
            [t('screen4.orderFile'), file?.name || '—'],
            [t('screen4.orderPages'), pagesLabel],
            [t('screen4.orderCopies'), String(printSettings.copies)],
            [t('screen4.orderSheets'), `${priceInfo.sheets}`],
            [t('screen4.orderPagesPerSide'), String(printSettings.pagesPerSide)],
            [t('screen4.orderDuplex'), printSettings.duplex ? t('common.yes') : t('common.no')],
          ].map(([label, value], i, arr) => (
            <div
              key={label}
              className={`flex justify-between px-6 py-3.5 ${i < arr.length - 1 ? 'border-b border-[#F1F5F9]' : ''}`}
            >
              <span className="text-[16px] text-muted">{label}</span>
              <span className="text-[16px] font-semibold text-dark-blue">{value}</span>
            </div>
          ))}
          <div className="bg-primary-light px-6 py-4 flex justify-between items-center">
            <span className="text-[18px] font-semibold text-dark-blue">{t('screen4.orderTotal')}</span>
            <span className="text-[34px] font-bold text-primary leading-none">{total} ₸</span>
          </div>
        </div>

        <button
          className="mt-6 w-full h-[58px] border border-[#E2E8F0] bg-white text-[#64748B] rounded-[12px] text-[17px] font-medium hover:bg-[#F1F5F9] transition-colors duration-150"
          onClick={onBack}
          data-testid="back-btn"
        >
          ← {t('common.back')}
        </button>
      </div>

      {/* RIGHT — Payment methods */}
      <div className="w-[58%] p-10 flex flex-col">
        <h1 className="text-[28px] font-bold text-dark-blue">{t('screen4.paymentTitle')}</h1>
        <p className="text-[16px] text-[#0F172A] mt-1.5">{t('screen4.paymentSubtitle')}</p>

        {/* Payment choice — two big square buttons */}
        <div className="mt-6 grid grid-cols-2 gap-4">
          {/* Bank card — LEFT */}
          <div
            className={`aspect-square border rounded-[20px] p-6 cursor-pointer relative transition-all duration-150 flex flex-col items-center justify-center text-center
              ${paymentMethod === 'card'
                ? 'border-2 border-primary bg-primary-light'
                : 'border-[1.5px] border-[#E2E8F0] hover:border-primary hover:bg-primary-light'
              }`}
            onClick={() => { setPaymentMethod('card'); console.log('[Screen4] Payment method selected: card'); }}
            data-testid="payment-card"
          >
            <div className={`absolute top-4 right-4 w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors duration-150
              ${paymentMethod === 'card' ? 'border-primary bg-primary' : 'border-[#CBD5E1] bg-white'}`}>
              {paymentMethod === 'card' && <div className="w-2 h-2 rounded-full bg-white" />}
            </div>
            <CreditCardIcon />
            <p className="text-[18px] font-semibold text-primary uppercase tracking-wider mt-5">{t('screen4.bankCard')}</p>
            <h3 className="text-[27px] font-bold text-dark-blue leading-tight mt-1.5">{t('screen4.bankCardSub')}</h3>
          </div>

          {/* Kaspi QR — RIGHT (red, filled) */}
          <div
            className={`aspect-square rounded-[20px] p-6 cursor-pointer relative transition-all duration-150 flex flex-col items-center justify-center text-center bg-kaspi-red text-white shadow-lg hover:brightness-110 active:scale-[0.99]
              ${paymentMethod === 'kaspi' ? 'ring-4 ring-kaspi-red/40' : ''}`}
            onClick={() => { setPaymentMethod('kaspi'); console.log('[Screen4] Payment method selected: kaspi'); }}
            data-testid="payment-kaspi"
          >
            <div className={`absolute top-4 right-4 w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors duration-150
              ${paymentMethod === 'kaspi' ? 'border-white bg-white' : 'border-white/70 bg-transparent'}`}>
              {paymentMethod === 'kaspi' && <div className="w-2 h-2 rounded-full bg-kaspi-red" />}
            </div>
            <div className="w-40 h-40 rounded-[28px] bg-white flex items-center justify-center">
              <img src="/photos/kaspi.png" alt="Kaspi" className="w-36 h-36 object-contain" />
            </div>
            <p className="text-[18px] font-semibold text-white/90 uppercase tracking-wider mt-5">Kaspi.kz</p>
            <h3 className="text-[27px] font-bold text-white leading-tight mt-1.5">{t('screen4.kaspiQr')}</h3>
          </div>
        </div>

        <button
          className={`mt-auto w-full h-16 rounded-[14px] text-[19px] font-semibold transition-all duration-150
            ${paymentMethod
              ? 'bg-primary text-white hover:bg-[#1D4ED8] active:scale-[0.99]'
              : 'bg-[#E2E8F0] text-muted cursor-not-allowed'
            }`}
          onClick={paymentMethod ? handleConfirm : undefined}
          disabled={!paymentMethod}
          data-testid="confirm-payment-btn"
        >
          {t('screen4.confirmPay')} →
        </button>
      </div>
    </div>
  );
});

export default Screen4Payment;
