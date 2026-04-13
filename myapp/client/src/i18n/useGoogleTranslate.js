import { useEffect, useState } from 'react';

const TRANSLATE_SCRIPT_ID = 'google-translate-script';

const DEFAULT_LANGUAGES = [{ code: 'en', label: 'English' }];

export default function useGoogleTranslate() {
  const [language, setLanguage] = useState(localStorage.getItem('preferredLanguage') || 'en');
  const [supportedLanguages, setSupportedLanguages] = useState(DEFAULT_LANGUAGES);

  useEffect(() => {
    const syncLanguagesFromGoogleWidget = () => {
      const combo = document.querySelector('.goog-te-combo');
      if (!combo || !combo.options) {
        return false;
      }

      const options = Array.from(combo.options)
        .filter((option) => option.value)
        .map((option) => ({
          code: option.value,
          label: option.textContent || option.value,
        }));

      if (options.length > 0) {
        setSupportedLanguages(options);
        return true;
      }

      return false;
    };

    const waitForLanguageOptions = () => {
      let attempts = 0;
      const maxAttempts = 40;
      const intervalId = window.setInterval(() => {
        attempts += 1;
        const loaded = syncLanguagesFromGoogleWidget();
        if (loaded || attempts >= maxAttempts) {
          window.clearInterval(intervalId);
        }
      }, 250);
    };

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
            layout: window.google.translate.TranslateElement.InlineLayout.SIMPLE,
          },
          'google_translate_element'
        );
      }

      waitForLanguageOptions();
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

  return { language, setLanguage, supportedLanguages };
}
