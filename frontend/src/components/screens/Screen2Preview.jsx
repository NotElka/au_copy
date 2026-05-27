import React from 'react';
import { formatBytes } from '../../utils/api';
import OrientedPreview from '../OrientedPreview';
import { useT } from '../../i18n/LanguageProvider';

const PortraitIcon = ({ active }) => (
  <svg width="44" height="56" viewBox="0 0 44 56" fill="none">
    <rect x="2" y="2" width="40" height="52" rx="3" stroke={active ? '#2563EB' : '#94A3B8'} strokeWidth="2" fill={active ? '#EFF6FF' : 'white'}/>
    {[14, 22, 30, 38, 46].map(y => (
      <line key={y} x1="9" y1={y} x2={y === 46 ? 30 : 35} y2={y} stroke={active ? '#2563EB' : '#CBD5E1'} strokeWidth="1.8" strokeLinecap="round"/>
    ))}
  </svg>
);

const LandscapeIcon = ({ active }) => (
  <svg width="56" height="44" viewBox="0 0 56 44" fill="none">
    <rect x="2" y="2" width="52" height="40" rx="3" stroke={active ? '#2563EB' : '#94A3B8'} strokeWidth="2" fill={active ? '#EFF6FF' : 'white'}/>
    {[13, 20, 27, 34].map(y => (
      <line key={y} x1="9" y1={y} x2={y === 34 ? 40 : 47} y2={y} stroke={active ? '#2563EB' : '#CBD5E1'} strokeWidth="1.8" strokeLinecap="round"/>
    ))}
  </svg>
);

const Screen2Preview = React.memo(({ file, orientation, setOrientation, onNext, onBack }) => {
  const { t } = useT();
  const isPdf = file?.mimeType === 'application/pdf';
  const isImage = file?.mimeType?.startsWith('image/');
  const fileName = file?.name || t('common.document');
  const downloadUrl = file?.downloadUrl || '';
  const isPortrait = orientation === 'portrait';

  return (
    <div className="flex min-h-full">
      {/* LEFT — File Viewer (extra wide for visibility) */}
      <div className="w-[70%] bg-gradient-to-br from-[#1E293B] to-[#0F172A] flex flex-col self-stretch sticky top-0" style={{ height: 932 }}>
        {/* Toolbar */}
        <div className="h-[60px] bg-black/30 backdrop-blur-sm px-6 flex items-center justify-between flex-shrink-0 border-b border-white/5">
          <div className="flex items-center gap-3 min-w-0">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" className="flex-shrink-0">
              <path d="M14 3H6a2 2 0 00-2 2v14a2 2 0 002 2h12a2 2 0 002-2V9l-6-6z" stroke="#60A5FA" strokeWidth="1.6"/>
              <path d="M14 3v6h6" stroke="#60A5FA" strokeWidth="1.6"/>
            </svg>
            <span className="text-white text-[16px] font-medium truncate">{fileName}</span>
          </div>
          <div className="flex items-center gap-2 bg-white/10 rounded-full px-3 py-1.5">
            <div className="w-2 h-2 rounded-full bg-[#60A5FA] animate-pulse" />
            <span className="text-white/90 text-[13px] font-semibold">
              {isPortrait ? t('common.portrait') : t('common.landscape')}
            </span>
          </div>
        </div>

        {/* Preview area — увеличен внутренний паддинг для крупного отображения */}
        <div className="flex-1 min-h-0 flex items-center justify-center p-8">
          {(isPdf || isImage) && downloadUrl ? (
            <OrientedPreview
              pdfUrl={isPdf ? downloadUrl : null}
              imageUrl={isImage ? downloadUrl : null}
              orientation={orientation}
            />
          ) : (
            <div
              className="bg-white rounded-[4px] shadow-2xl flex flex-col items-center justify-center p-8 gap-4"
              style={isPortrait ? { aspectRatio: '210 / 297', height: '90%' } : { aspectRatio: '297 / 210', width: '90%' }}
            >
              <svg width="72" height="72" viewBox="0 0 24 24" fill="none">
                <path d="M14 3H6a2 2 0 00-2 2v14a2 2 0 002 2h12a2 2 0 002-2V9l-6-6z" stroke="#2563EB" strokeWidth="1.5"/>
                <path d="M14 3v6h6" stroke="#2563EB" strokeWidth="1.5"/>
              </svg>
              <p className="text-dark-blue text-[20px] font-semibold text-center px-4">{fileName}</p>
              <p className="text-muted text-[15px] text-center px-6">{t('screen2.wordPreviewHint')}</p>
            </div>
          )}
        </div>
      </div>

      {/* RIGHT — Controls (more compact since left is wider) */}
      <div className="w-[30%] bg-white border-l border-[#E2E8F0] p-6 flex flex-col gap-5 overflow-y-auto" style={{ height: 932 }}>
        {/* File info */}
        <div>
          <h3 className="text-[12px] font-bold text-[#94A3B8] uppercase tracking-wider mb-2.5">{t('screen2.fileInfo')}</h3>
          <div className="bg-gradient-to-br from-[#EFF6FF] to-[#DBEAFE] rounded-2xl p-4">
            {[
              [t('common.file'), fileName, true],
              [t('common.type'), isPdf ? t('common.pdf') : isImage ? t('common.image') : t('common.word')],
              [t('screen2.pages'), file?.pageCount ?? '—'],
              [t('common.size'), formatBytes(file?.size)],
            ].map(([label, value, truncate]) => (
              <div key={label} className="flex justify-between py-1 border-b border-white/50 last:border-0">
                <span className="text-[13px] text-[#64748B]">{label}</span>
                <span className={`text-[14px] font-semibold text-dark-blue text-right ${truncate ? 'truncate max-w-[60%]' : ''}`}>{value}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Orientation */}
        <div>
          <h3 className="text-[12px] font-bold text-[#94A3B8] uppercase tracking-wider mb-2.5">{t('screen2.orientation')}</h3>
          <div className="grid grid-cols-2 gap-2.5">
            {[
              { val: 'portrait', Icon: PortraitIcon, label: t('common.portrait'), sub: t('common.portraitSize') },
              { val: 'landscape', Icon: LandscapeIcon, label: t('common.landscape'), sub: t('common.landscapeSize') },
            ].map(({ val, label, sub, Icon }) => (
              <button
                key={val}
                className={`rounded-2xl py-4 flex flex-col items-center gap-1.5 cursor-pointer transition-all duration-200
                  ${orientation === val
                    ? 'border-2 border-primary bg-gradient-to-br from-[#EFF6FF] to-[#DBEAFE] shadow-md shadow-primary/15'
                    : 'border-[1.5px] border-[#E2E8F0] bg-white hover:border-[#CBD5E1]'}`}
                onClick={() => setOrientation(val)}
                data-testid={`orientation-${val}`}
              >
                <Icon active={orientation === val} />
                <span className={`text-[15px] font-bold ${orientation === val ? 'text-primary' : 'text-dark-blue'}`}>{label}</span>
                <span className="text-[11px] text-[#94A3B8]">{sub}</span>
              </button>
            ))}
          </div>
          <p className="text-[12px] text-[#64748B] mt-2.5 px-1 leading-snug">
            {isPortrait ? t('screen2.orientationHintPortrait') : t('screen2.orientationHintLandscape')}
          </p>
        </div>

        {/* Hint card */}
        <div className="bg-[#F8FAFC] border border-[#E2E8F0] rounded-2xl p-4 flex items-start gap-3">
          <div className="w-8 h-8 rounded-full bg-[#DBEAFE] flex items-center justify-center flex-shrink-0">
            <svg width="16" height="16" viewBox="0 0 20 20" fill="none">
              <circle cx="10" cy="10" r="8" stroke="#2563EB" strokeWidth="1.8"/>
              <path d="M10 6v5M10 14v.5" stroke="#2563EB" strokeWidth="2" strokeLinecap="round"/>
            </svg>
          </div>
          <div>
            <p className="text-[13px] font-bold text-dark-blue">{t('screen2.previewTitle')}</p>
            <p className="text-[12px] text-[#64748B] mt-0.5 leading-snug">
              {t('screen2.previewHint')}
            </p>
          </div>
        </div>

        {/* Buttons */}
        <div className="mt-auto pt-3 flex gap-2.5">
          <button
            className="w-[100px] h-[58px] border-[1.5px] border-[#E2E8F0] text-[#64748B] rounded-2xl text-[15px] font-semibold hover:bg-[#F8FAFC] active:scale-[0.98] transition-all"
            onClick={onBack}
            data-testid="back-btn"
          >
            ← {t('common.back')}
          </button>
          <button
            className="flex-1 h-[58px] bg-gradient-to-r from-primary to-[#1D4ED8] text-white rounded-2xl text-[16px] font-bold shadow-md shadow-primary/20 hover:shadow-lg hover:shadow-primary/30 active:scale-[0.99] transition-all flex items-center justify-center gap-2"
            onClick={onNext}
            data-testid="settings-btn"
          >
            {t('screen2.goToSettings')}
            <span className="text-[20px]">→</span>
          </button>
        </div>
      </div>
    </div>
  );
});

export default Screen2Preview;
