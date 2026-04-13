import { useEffect, useState } from 'react';

const TRANSLATE_SCRIPT_ID = 'google-translate-script';

const SUPPORTED_LANGUAGES = [
  { code: 'en', label: 'English' },
  { code: 'es', label: 'Spanish' },
  { code: 'fr', label: 'French' },
  { code: 'de', label: 'German' },
  { code: 'zh-CN', label: 'Chinese (Simplified)' },
  { code: 'ar', label: 'Arabic' },
  { code: 'hi', label: 'Hindi' },
  { code: 'ko', label: 'Korean' },
  { code: 'ja', label: 'Japanese' },
];

export default function useGoogleTranslate() {
  const [language, setLanguage] = useState(localStorage.getItem('preferredLanguage') || 'en');

  useEffect(() => {
    const initGoogleTranslate = () => {
      if (!window.google || !window.google.translate) {
        return;
      }

      if (!document.getElementById('google_translate_element')) {
        return;
      }

      if (!window.__googleTranslateWidgetInitialized) {
        window.__googleTranslateWidgetInitialized = true;
        // eslint-disable-next-line no-new
        new window.google.translate.TranslateElement(
          {
            pageLanguage: 'en',
            autoDisplay: false,
            includedLanguages: SUPPORTED_LANGUAGES.map((lang) => lang.code).join(','),
            layout: window.google.translate.TranslateElement.InlineLayout.SIMPLE,
          },
          'google_translate_element'
        );
      }
    };

    window.googleTranslateElementInit = initGoogleTranslate;

    if (!document.getElementById(TRANSLATE_SCRIPT_ID)) {
      const script = document.createElement('script');
      script.id = TRANSLATE_SCRIPT_ID;
      script.src = 'https://translate.google.com/translate_a/element.js?cb=googleTranslateElementInit';
      script.async = true;
      document.body.appendChild(script);
    } else {
      initGoogleTranslate();
    }
  }, []);

  useEffect(() => {
    localStorage.setItem('preferredLanguage', language);
    const intervalId = window.setInterval(() => {
      const combo = document.querySelector('.goog-te-combo');
      if (!combo) {
        return;
      }

      if (combo.value !== language) {
        combo.value = language;
        combo.dispatchEvent(new Event('change'));
      }

      window.clearInterval(intervalId);
    }, 300);

    return () => window.clearInterval(intervalId);
  }, [language]);

  return { language, setLanguage, supportedLanguages: SUPPORTED_LANGUAGES };
}
