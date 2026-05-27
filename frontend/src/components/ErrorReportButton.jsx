import React from 'react';

const ErrorReportButton = React.memo(({ onClick }) => (
  <button
    className="fixed bottom-6 right-6 z-40 bg-white border border-[#E2E8F0] rounded-[12px] px-5 py-3 flex items-center gap-2.5 cursor-pointer hover:border-[#F59E0B] hover:bg-[#FFFBEB] transition-colors duration-150"
    onClick={onClick}
    data-testid="error-report-btn"
  >
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
      <path d="M10 2L1.5 17h17L10 2z" stroke="#F59E0B" strokeWidth="1.5" strokeLinejoin="round"/>
      <path d="M10 8v4M10 14v1" stroke="#F59E0B" strokeWidth="1.5" strokeLinecap="round"/>
    </svg>
    <span className="text-[16px] text-[#64748B]">Сообщить об ошибке</span>
  </button>
));

export default ErrorReportButton;
