import React, { useEffect, useMemo, useRef, useState } from 'react';
import * as pdfjs from 'pdfjs-dist/build/pdf.mjs';
import workerUrl from 'pdfjs-dist/build/pdf.worker.mjs?url';
import { selectedPageNumbers } from '../utils/parsePageRange';

pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;

const RENDER_SCALE = 1.6;

// Та же раскладка что в backend `_nup_layout` — критично для соответствия.
function layoutFor(pagesPerSide, sheetOrientation) {
  const isLandscape = sheetOrientation === 'landscape';
  switch (pagesPerSide) {
    case 1: return { cols: 1, rows: 1 };
    case 2: return isLandscape ? { cols: 2, rows: 1 } : { cols: 1, rows: 2 };
    case 4: return { cols: 2, rows: 2 };
    case 8: return isLandscape ? { cols: 4, rows: 2 } : { cols: 2, rows: 4 };
    default: return { cols: 1, rows: 1 };
  }
}

// Группируем выбранные страницы по листам/сторонам.
function buildSheets(pages, pagesPerSide, duplex) {
  const sides = [];
  for (let i = 0; i < pages.length; i += pagesPerSide) {
    sides.push(pages.slice(i, i + pagesPerSide));
  }
  const sheets = [];
  if (duplex) {
    for (let i = 0; i < sides.length; i += 2) {
      sheets.push({ front: sides[i] || [], back: sides[i + 1] || null });
    }
  } else {
    for (const side of sides) sheets.push({ front: side, back: null });
  }
  return sheets;
}

// Рендер страницы PDF с возможным поворотом под выбранную ориентацию.
function usePdfPageCache(pdfUrl, sheetOrientation) {
  const [doc, setDoc] = useState(null);
  const [error, setError] = useState(null);
  const cacheRef = useRef(new Map());

  useEffect(() => {
    let cancelled = false;
    cacheRef.current = new Map();
    setDoc(null);
    setError(null);
    if (!pdfUrl) return;
    const task = pdfjs.getDocument({ url: pdfUrl });
    task.promise.then((pdf) => { if (!cancelled) setDoc(pdf); })
                .catch((err) => { if (!cancelled) setError(err); });
    return () => { cancelled = true; task.destroy?.(); };
  }, [pdfUrl]);

  // Кэш не зависит от ориентации — рендерим без поворота, ориентация листа
  // влияет только на разметку слотов.

  const renderPage = async (pageNumber) => {
    // Рендерим страницу в её родной ориентации, без поворота. Лист в превью
    // имеет аспект target-ориентации — содержимое центрируется в слоте через
    // object-contain ниже.
    if (!doc) return null;
    if (cacheRef.current.has(pageNumber)) return cacheRef.current.get(pageNumber);
    const page = await doc.getPage(pageNumber);
    const viewport = page.getViewport({ scale: RENDER_SCALE });
    const canvas = document.createElement('canvas');
    canvas.width = viewport.width;
    canvas.height = viewport.height;
    const ctx = canvas.getContext('2d');
    await page.render({ canvasContext: ctx, viewport }).promise;
    const url = canvas.toDataURL('image/jpeg', 0.85);
    cacheRef.current.set(pageNumber, url);
    return url;
  };

  return { doc, error, renderPage };
}

const PageThumb = React.memo(({ pageNumber, renderPage, showNumber = true }) => {
  const [src, setSrc] = useState(null);
  useEffect(() => {
    let cancelled = false;
    if (pageNumber == null) { setSrc(null); return; }
    renderPage(pageNumber).then((url) => { if (!cancelled) setSrc(url); });
    return () => { cancelled = true; };
  }, [pageNumber, renderPage]);
  return (
    <div className="w-full h-full flex flex-col items-center justify-center bg-white relative overflow-hidden">
      {src ? (
        <img src={src} alt={`p ${pageNumber}`} className="w-full h-full object-contain" />
      ) : (
        <div className="w-5 h-5 border-2 border-[#CBD5E1] border-t-primary rounded-full animate-spin" />
      )}
      {showNumber && pageNumber != null && (
        <span className="absolute bottom-1 right-1 bg-white/85 text-[12px] font-semibold text-[#64748B] px-1.5 rounded leading-tight">
          {pageNumber}
        </span>
      )}
    </div>
  );
});

const ImageThumb = ({ imageUrl, sheetOrientation }) => {
  // Картинка занимает один слот — отображаем как есть (она уже на белом фоне после конвертации).
  return (
    <div className="w-full h-full flex items-center justify-center bg-white overflow-hidden">
      <img src={imageUrl} alt="preview" className="max-w-full max-h-full object-contain" />
    </div>
  );
};

const Sheet = ({ side, layout, sheetOrientation, label, renderSlot }) => {
  if (!side) return null;
  const isLandscape = sheetOrientation === 'landscape';
  const aspect = isLandscape ? '297 / 210' : '210 / 297';

  return (
    <div className="flex flex-col items-center gap-2 h-full justify-center">
      <div
        className="bg-white shadow-2xl rounded-[4px] border border-[#E2E8F0] p-2 flex-shrink-0"
        style={{ aspectRatio: aspect, height: '100%', maxWidth: '100%' }}
      >
        <div
          className="w-full h-full grid gap-1.5"
          style={{
            gridTemplateColumns: `repeat(${layout.cols}, minmax(0, 1fr))`,
            gridTemplateRows: `repeat(${layout.rows}, minmax(0, 1fr))`,
          }}
        >
          {Array.from({ length: layout.cols * layout.rows }).map((_, idx) => {
            const pageNumber = side[idx];
            return (
              <div key={idx} className="border border-[#F1F5F9] rounded-sm overflow-hidden flex items-center justify-center bg-[#FAFAFA]">
                {pageNumber != null ? renderSlot(pageNumber) : null}
              </div>
            );
          })}
        </div>
      </div>
      {label && <span className="text-[14px] font-semibold text-white/80">{label}</span>}
    </div>
  );
};

const PrintPreview = ({
  pdfUrl,
  imageUrl,            // если задан — режим картинки (не N-up страниц, а одна картинка на лист)
  printSettings,
  totalPages,
  sheetOrientation = 'portrait',
}) => {
  // ── PDF mode ────────────────────────────────────────────────────────
  const { doc, error, renderPage } = usePdfPageCache(pdfUrl, sheetOrientation);
  const [sheetIdx, setSheetIdx] = useState(0);

  const pages = useMemo(
    () => (imageUrl ? [1] : selectedPageNumbers(printSettings, totalPages)),
    [imageUrl, printSettings.pages, printSettings.pageRange, totalPages],
  );

  const sheets = useMemo(
    () => buildSheets(pages, imageUrl ? 1 : printSettings.pagesPerSide, printSettings.duplex && !imageUrl),
    [pages, imageUrl, printSettings.pagesPerSide, printSettings.duplex],
  );

  useEffect(() => { setSheetIdx(0); }, [
    printSettings.pagesPerSide, printSettings.duplex, printSettings.pages, printSettings.pageRange, imageUrl,
  ]);

  const layout = useMemo(
    () => layoutFor(imageUrl ? 1 : printSettings.pagesPerSide, sheetOrientation),
    [imageUrl, printSettings.pagesPerSide, sheetOrientation],
  );

  if (imageUrl) {
    return (
      <div className="w-full h-full flex items-center justify-center py-2">
        <Sheet
          side={[1]}
          layout={{ cols: 1, rows: 1 }}
          sheetOrientation={sheetOrientation}
          renderSlot={() => <ImageThumb imageUrl={imageUrl} sheetOrientation={sheetOrientation} />}
        />
      </div>
    );
  }

  if (error) {
    return <div className="text-red-300 text-[14px] text-center p-4">Не удалось загрузить PDF</div>;
  }
  if (!doc) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="w-8 h-8 border-2 border-white/30 border-t-white rounded-full animate-spin" />
      </div>
    );
  }
  const currentSheet = sheets[sheetIdx];
  if (!currentSheet || pages.length === 0) {
    return <div className="text-white/70 text-[14px] text-center p-4">Нет выбранных страниц</div>;
  }

  const renderSlot = (pageNumber) => (
    <PageThumb pageNumber={pageNumber} renderPage={renderPage} />
  );

  return (
    <div className="w-full h-full flex flex-col items-center justify-between gap-3 py-2">
      <div className="flex-1 min-h-0 flex items-center justify-center gap-4 w-full overflow-hidden">
        <Sheet
          side={currentSheet.front}
          layout={layout}
          sheetOrientation={sheetOrientation}
          label={printSettings.duplex ? 'Сторона 1' : null}
          renderSlot={renderSlot}
        />
        {printSettings.duplex && currentSheet.back && (
          <Sheet
            side={currentSheet.back}
            layout={layout}
            sheetOrientation={sheetOrientation}
            label="Сторона 2"
            renderSlot={renderSlot}
          />
        )}
      </div>

      {sheets.length > 1 && (
        <div className="flex items-center gap-3 bg-black/40 backdrop-blur-sm rounded-full px-4 py-2">
          <button
            className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-white/10 active:bg-white/20 text-white text-[22px] disabled:opacity-30"
            onClick={() => setSheetIdx((i) => Math.max(0, i - 1))}
            disabled={sheetIdx === 0}
          >
            ‹
          </button>
          <span className="text-white text-[15px] font-semibold min-w-[110px] text-center">
            Лист {sheetIdx + 1} из {sheets.length}
          </span>
          <button
            className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-white/10 active:bg-white/20 text-white text-[22px] disabled:opacity-30"
            onClick={() => setSheetIdx((i) => Math.min(sheets.length - 1, i + 1))}
            disabled={sheetIdx >= sheets.length - 1}
          >
            ›
          </button>
        </div>
      )}
    </div>
  );
};

export default React.memo(PrintPreview);
