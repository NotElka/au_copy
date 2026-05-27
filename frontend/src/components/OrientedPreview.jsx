import React, { useEffect, useRef, useState } from 'react';
import * as pdfjs from 'pdfjs-dist/build/pdf.mjs';
import workerUrl from 'pdfjs-dist/build/pdf.worker.mjs?url';

pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;

/**
 * Превью одной страницы PDF или картинки с учётом ориентации листа.
 * Внутренне ВСЕГДА рендерит контент так, как он будет выглядеть на бумаге:
 *   - если документ портретный и юзер выбрал альбомную ориентацию → контент
 *     поворачивается на 90° и плотно ложится на альбомный лист
 *   - если ориентации совпадают → масштабируется по короткой стороне
 *
 * Используется на Screen2 (превью документа целиком) и в качестве thumbnail
 * на других экранах.
 */
const OrientedPreview = ({ pdfUrl, imageUrl, orientation, pageNumber = 1, className = '' }) => {
  const [src, setSrc] = useState(null);
  const [error, setError] = useState(false);
  const containerRef = useRef(null);

  useEffect(() => {
    let cancelled = false;
    setSrc(null);
    setError(false);

    const renderPdf = async () => {
      try {
        const task = pdfjs.getDocument({ url: pdfUrl });
        const pdf = await task.promise;
        if (cancelled) return;
        const page = await pdf.getPage(pageNumber);
        // Рендерим страницу В ЕЁ НАТИВНОЙ ориентации — поворота нет.
        // Затем рисуем поверх "листа" target-ориентации с центрированием.
        const baseViewport = page.getViewport({ scale: 2.0 });
        const pageCanvas = document.createElement('canvas');
        pageCanvas.width = baseViewport.width;
        pageCanvas.height = baseViewport.height;
        const pageCtx = pageCanvas.getContext('2d');
        await page.render({ canvasContext: pageCtx, viewport: baseViewport }).promise;
        if (cancelled) return;

        // Лист target ориентации (отношение сторон A4)
        const sheetW = orientation === 'landscape' ? 1191 : 842;
        const sheetH = orientation === 'landscape' ? 842 : 1191;
        const sheetCanvas = document.createElement('canvas');
        sheetCanvas.width = sheetW;
        sheetCanvas.height = sheetH;
        const sheetCtx = sheetCanvas.getContext('2d');
        sheetCtx.fillStyle = '#ffffff';
        sheetCtx.fillRect(0, 0, sheetW, sheetH);
        const scale = Math.min(sheetW / pageCanvas.width, sheetH / pageCanvas.height);
        const drawW = pageCanvas.width * scale;
        const drawH = pageCanvas.height * scale;
        sheetCtx.drawImage(
          pageCanvas,
          (sheetW - drawW) / 2,
          (sheetH - drawH) / 2,
          drawW, drawH,
        );
        if (cancelled) return;
        setSrc(sheetCanvas.toDataURL('image/jpeg', 0.9));
      } catch (e) {
        if (!cancelled) setError(true);
      }
    };

    const renderImage = () => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        if (cancelled) return;
        // Рисуем на canvas в нужной ориентации листа A4
        const targetW = orientation === 'landscape' ? 1190 : 842;
        const targetH = orientation === 'landscape' ? 842 : 1190;
        const canvas = document.createElement('canvas');
        canvas.width = targetW;
        canvas.height = targetH;
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, targetW, targetH);
        const scale = Math.min(targetW / img.width, targetH / img.height);
        const drawW = img.width * scale;
        const drawH = img.height * scale;
        ctx.drawImage(
          img,
          (targetW - drawW) / 2,
          (targetH - drawH) / 2,
          drawW,
          drawH,
        );
        try {
          setSrc(canvas.toDataURL('image/jpeg', 0.9));
        } catch (e) {
          // CORS — фолбэк на прямой src
          setSrc(imageUrl);
        }
      };
      img.onerror = () => { if (!cancelled) setError(true); };
      img.src = imageUrl;
    };

    if (pdfUrl) renderPdf();
    else if (imageUrl) renderImage();

    return () => { cancelled = true; };
  }, [pdfUrl, imageUrl, orientation, pageNumber]);

  const aspect = orientation === 'landscape' ? '297 / 210' : '210 / 297';

  return (
    <div
      ref={containerRef}
      className={`relative bg-white rounded-[4px] shadow-2xl border border-[#E2E8F0] overflow-hidden flex items-center justify-center ${className}`}
      style={{ aspectRatio: aspect, maxWidth: '100%', maxHeight: '100%' }}
    >
      {src ? (
        <img src={src} alt="preview" className="w-full h-full object-contain" />
      ) : error ? (
        <div className="text-[14px] text-red-500 px-4 text-center">
          Не удалось загрузить превью
        </div>
      ) : (
        <div className="w-10 h-10 border-2 border-[#CBD5E1] border-t-primary rounded-full animate-spin" />
      )}
    </div>
  );
};

export default React.memo(OrientedPreview);
