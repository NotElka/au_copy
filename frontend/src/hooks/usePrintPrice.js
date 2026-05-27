import { parsePageRange } from '../utils/parsePageRange';

const PRICE_PER_SHEET = 24;

export function usePrintPrice(settings, filePageCount) {
  const selectedPages = settings.pages === 'all'
    ? filePageCount
    : parsePageRange(settings.pageRange, filePageCount);
  const sheets = Math.ceil((selectedPages || 1) / settings.pagesPerSide);
  return {
    total: sheets * settings.copies * PRICE_PER_SHEET,
    sheets,
    selectedPages: selectedPages || filePageCount,
    pricePerSheet: PRICE_PER_SHEET,
    copies: settings.copies,
  };
}
