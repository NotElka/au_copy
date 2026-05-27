import React from 'react';
import { useT } from '../i18n/LanguageProvider';

const STEP_KEYS = ['steps.upload', 'steps.preview', 'steps.settings', 'steps.payment', 'steps.done'];

const CheckIcon = () => (
  <svg width="32" height="32" viewBox="0 0 18 18" fill="none">
    <path d="M3.5 9l4 4 7-7" stroke="white" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);

const StepIndicator = React.memo(({ currentScreen }) => {
  const { t } = useT();
  const activeStep = currentScreen >= 6 ? 6 : currentScreen;
  const steps = STEP_KEYS.map((k) => t(k));

  return (
    <div className="flex items-center" style={{ width: '1040px' }}>
      {steps.map((label, i) => {
        const stepNum = i + 1;
        const isCompleted = stepNum < activeStep;
        const isActive = stepNum === activeStep;
        return (
          <React.Fragment key={stepNum}>
            <div className="flex flex-col items-center" style={{ width: 96 }}>
              <div
                className={`relative w-[72px] h-[72px] rounded-full flex items-center justify-center text-[26px] font-bold transition-all duration-300
                  ${isCompleted
                    ? 'bg-[#22C55E] shadow-md shadow-[#22C55E]/30'
                    : isActive
                      ? 'bg-primary shadow-lg shadow-primary/40'
                      : 'bg-white border-2 border-[#E2E8F0]'}
                `}
              >
                {isActive && (
                  <span className="absolute inset-[-8px] rounded-full ring-[6px] ring-primary/15" />
                )}
                {isCompleted
                  ? <CheckIcon />
                  : <span className={isActive ? 'text-white' : 'text-[#94A3B8]'}>{stepNum}</span>
                }
              </div>
              <span
                className={`text-[14px] mt-3 whitespace-nowrap font-semibold tracking-wide transition-colors duration-300
                  ${isCompleted ? 'text-[#22C55E]' : isActive ? 'text-primary' : 'text-[#94A3B8]'}
                `}
              >
                {label}
              </span>
            </div>
            {i < steps.length - 1 && (
              <div className="flex-1 mb-7 mx-1 relative h-[2px]">
                <div className="absolute inset-0 rounded-full bg-[#E2E8F0]" />
                <div
                  className="absolute inset-y-0 left-0 rounded-full bg-[#22C55E] transition-all duration-500"
                  style={{ width: isCompleted ? '100%' : '0%' }}
                />
              </div>
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
});

export default StepIndicator;
