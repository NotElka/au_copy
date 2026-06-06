import React, { useState, useEffect, useRef } from 'react';
import { useT } from '../i18n/LanguageProvider';

// ─────────────────────────────────────────────────────────────────────────
// Реклама на первом экране. Поддерживает картинки и видео.
//
// Как заполнить: положи файлы в  frontend/public/ads/  и перечисли их ниже.
//   • type: 'image' — показывается SLIDE_INTERVAL_MS, затем плавно сменяется;
//   • type: 'video' — проигрывается целиком (со звуком нельзя — автоплей только
//                     без звука), потом переходит к следующему медиа.
// Если список пустой — показывается обычный плейсхолдер «Тут могла быть…».
//
// Примеры (раскомментируй и подставь свои файлы):
const AD_MEDIA = [
  // { type: 'image', src: '/ads/ad1.jpg' },
  // { type: 'image', src: '/ads/ad2.jpg' },
  // { type: 'video', src: '/ads/promo.mp4' },
  {type: 'image', src: '/ads/Picture1.png'},
  {type: 'image', src: '/ads/Picture2.png'}
];

const SLIDE_INTERVAL_MS = 6000; // как долго висит одна картинка
// ─────────────────────────────────────────────────────────────────────────

function Placeholder({ label }) {
  return (
    <div className="w-full min-h-[60vh] border-2 border-dashed border-[#BFCFE8] rounded-3xl flex flex-col items-center justify-center gap-4 px-6 py-8">
      <div className="w-[60px] h-[60px] rounded-2xl bg-[#DBEAFE] flex items-center justify-center">
        <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
          <rect x="1" y="4" width="26" height="20" rx="3" stroke="#60A5FA" strokeWidth="1.8" />
          <circle cx="9" cy="12" r="3" stroke="#60A5FA" strokeWidth="1.8" />
          <path d="M1 20l7-6 6 4.5 5-6 8 7.5" stroke="#60A5FA" strokeWidth="1.8" strokeLinejoin="round" strokeLinecap="round" />
        </svg>
      </div>
      <p className="text-[20px] text-[#94A3B8] font-semibold text-center leading-snug">{label}</p>
    </div>
  );
}

export default function AdPanel() {
  const { t } = useT();
  const items = AD_MEDIA;
  const [index, setIndex] = useState(0);
  const videoRefs = useRef([]);

  // Авто-переключение картинок по таймеру. Видео переключается само по onEnded.
  useEffect(() => {
    if (items.length <= 1) return;
    if (items[index]?.type === 'video') return;
    const id = setTimeout(
      () => setIndex((i) => (i + 1) % items.length),
      SLIDE_INTERVAL_MS,
    );
    return () => clearTimeout(id);
  }, [index, items]);

  // Проигрываем только активное видео, остальные ставим на паузу.
  useEffect(() => {
    videoRefs.current.forEach((v, i) => {
      if (!v) return;
      if (i === index) {
        v.currentTime = 0;
        v.play().catch(() => {});
      } else {
        v.pause();
      }
    });
  }, [index]);

  const handleEnded = () => {
    if (items.length > 1) setIndex((i) => (i + 1) % items.length);
  };

  if (items.length === 0) {
    return <Placeholder label={t('screen1.adPlaceholder')} />;
  }

  return (
    <div className="relative w-full min-h-[60vh] rounded-3xl overflow-hidden bg-black">
      {items.map((m, i) => (
        <div
          key={i}
          className={`absolute inset-0 transition-opacity duration-700 ${i === index ? 'opacity-100' : 'opacity-0'}`}
        >
          {m.type === 'video' ? (
            <video
              ref={(el) => { videoRefs.current[i] = el; }}
              src={m.src}
              className="w-full h-full object-cover"
              muted
              playsInline
              autoPlay={i === 0}
              loop={items.length === 1}
              onEnded={items.length > 1 ? handleEnded : undefined}
            />
          ) : (
            <img src={m.src} alt="" className="w-full h-full object-cover" />
          )}
        </div>
      ))}

      {items.length > 1 && (
        <div className="absolute bottom-3 left-0 right-0 flex justify-center gap-1.5">
          {items.map((_, i) => (
            <span
              key={i}
              className={`w-2 h-2 rounded-full transition-colors duration-300 ${i === index ? 'bg-white' : 'bg-white/40'}`}
            />
          ))}
        </div>
      )}
    </div>
  );
}
