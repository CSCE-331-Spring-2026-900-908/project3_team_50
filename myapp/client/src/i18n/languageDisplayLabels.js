/**
 * Fixed display names (native / conventional) for language codes.
 * Used so Google Translate does not rewrite option text (native <select> ignores notranslate).
 */
export const LANGUAGE_DISPLAY_LABELS = {
  en: 'English',
  es: 'Español',
  fr: 'Français',
  de: 'Deutsch',
  it: 'Italiano',
  pt: 'Português',
  ru: 'Русский',
  'zh-CN': '中文 (简体)',
  ja: '日本語',
  ko: '한국어',
  ar: 'العربية',
  hi: 'हिन्दी',
  tr: 'Türkçe',
  vi: 'Tiếng Việt',
  nl: 'Nederlands',
  pl: 'Polski',
  uk: 'Українська',
  id: 'Bahasa Indonesia',
  th: 'ไทย',
  sv: 'Svenska',
  no: 'Norsk',
  da: 'Dansk',
  fi: 'Suomi',
  he: 'עברית',
  cs: 'Čeština',
  el: 'Ελληνικά',
  ro: 'Română',
  hu: 'Magyar',
  ms: 'Bahasa Melayu',
  tl: 'Tagalog',
};

export function getLanguageDisplayLabel(code, fallbackLabel) {
  if (!code) return fallbackLabel || '';
  return LANGUAGE_DISPLAY_LABELS[code] || fallbackLabel || code;
}
