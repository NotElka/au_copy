import React, { useState } from 'react';
import StepIndicator from './StepIndicator';
import LanguageSwitcher from './LanguageSwitcher';
// import PaperIndicator from './PaperIndicator';  // временно убран счётчик бумаги
import { useT } from '../i18n/LanguageProvider';

const Logo = () => {
  const [imgError, setImgError] = useState(false);
  if (imgError) {
    return (
      <div className="w-[68px] h-[68px] rounded-2xl bg-gradient-to-br from-primary to-[#1D4ED8] flex items-center justify-center shadow-md shadow-primary/30">
        <span className="text-white font-bold text-[26px] tracking-tight">AC</span>
      </div>
    );
  }
  return (
    <img
      src="/photos/logo.png"
      alt="AU Copy"
      className="h-[68px] w-[68px] object-contain rounded-2xl"
      onError={() => setImgError(true)}
    />
  );
};

const Header = React.memo(({ currentScreen, onErrorReport }) => {
  const { t } = useT();
  return (
    <header className="fixed top-0 left-0 right-0 h-[148px] z-50 bg-white border-b border-[#EAEEF4] flex items-center px-10 gap-6">
      {/* Branding */}
      <div className="flex items-center gap-4 flex-shrink-0">
        <Logo />
        <div className="flex flex-col">
          <span className="text-[32px] font-bold text-dark-blue tracking-tight leading-none">AU Copy</span>
          <span className="text-[14px] text-[#94A3B8] font-medium mt-1.5 tracking-wide">{t('header.tagline')}</span>
        </div>
      </div>

      {/* Step indicator — centered */}
      <div className="flex-1 flex justify-center">
        <StepIndicator currentScreen={currentScreen} />
      </div>

      {/* Right cluster — paper level, language, error button */}
      <div className="flex-shrink-0 flex items-center gap-3">
        {/* <PaperIndicator />  временно убран счётчик бумаги */}
        <LanguageSwitcher />
        <button
          className="flex items-center gap-2.5 px-5 py-3 rounded-[14px] border-[1.5px] border-[#FCA5A5] bg-white text-[#DC2626] hover:bg-[#FEF2F2] hover:border-[#DC2626] active:scale-[0.97] transition-all duration-150 cursor-pointer"
          onClick={onErrorReport}
          data-testid="error-report-btn"
        >
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
            <path d="M10 2L1.5 17h17L10 2z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round"/>
            <path d="M10 8v4M10 14v1" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
          </svg>
          <span className="text-[15px] font-semibold whitespace-nowrap">{t('header.error')}</span>
        </button>
      </div>
    </header>
  );
});

export default Header;
