export const FONT_SIZE_STORAGE_KEY = 'bobaFontSize';

const VALID = ['small', 'medium', 'large'];

export function readFontSize() {
  try {
    const v = localStorage.getItem(FONT_SIZE_STORAGE_KEY);
    if (VALID.includes(v)) return v;
  } catch {
    /* ignore */
  }
  return 'medium';
}

export function applyFontSizeToDocument(size) {
  const s = VALID.includes(size) ? size : 'medium';
  document.documentElement.setAttribute('data-font-size', s);
}

export function persistFontSize(size) {
  const s = VALID.includes(size) ? size : 'medium';
  try {
    localStorage.setItem(FONT_SIZE_STORAGE_KEY, s);
  } catch {
    /* ignore */
  }
  applyFontSizeToDocument(s);
  return s;
}
