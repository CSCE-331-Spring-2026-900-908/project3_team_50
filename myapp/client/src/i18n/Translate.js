import { useEffect, useState } from 'react';

const TRANSLATE_SCRIPT_ID = 'google-translate-script';

const DEFAULT_LANGUAGES = [
  { code: 'en', label: 'English' },
  { code: 'es', label: 'Spanish' },
  { code: 'fr', label: 'French' },
  { code: 'de', label: 'German' },
  { code: 'it', label: 'Italian' },
  { code: 'pt', label: 'Portuguese' },
  { code: 'ru', label: 'Russian' },
  { code: 'zh-CN', label: 'Chinese (Simplified)' },
  { code: 'ja', label: 'Japanese' },
  { code: 'ko', label: 'Korean' },
  { code: 'ar', label: 'Arabic' },
  { code: 'hi', label: 'Hindi' },
  { code: 'tr', label: 'Turkish' },
  { code: 'vi', label: 'Vietnamese' },
  { code: 'nl', label: 'Dutch' },
  { code: 'pl', label: 'Polish' },
  { code: 'uk', label: 'Ukrainian' },
  { code: 'id', label: 'Indonesian' },
  { code: 'th', label: 'Thai' },
  { code: 'sv', label: 'Swedish' },
  { code: 'no', label: 'Norwegian' },
  { code: 'da', label: 'Danish' },
  { code: 'fi', label: 'Finnish' },
  { code: 'he', label: 'Hebrew' },
  { code: 'cs', label: 'Czech' },
  { code: 'el', label: 'Greek' },
  { code: 'ro', label: 'Romanian' },
  { code: 'hu', label: 'Hungarian' },
  { code: 'ms', label: 'Malay' },
  { code: 'tl', label: 'Tagalog' }
];

export default function useGoogleTranslate() {
  const [language, setLanguage] = useState(localStorage.getItem('preferredLanguage') || 'en');
  const [supportedLanguages, setSupportedLanguages] = useState(DEFAULT_LANGUAGES);
  const [isTranslating, setIsTranslating] = useState(false);

  const applyLanguage = (langCode) => {
    const combo = document.querySelector('.goog-te-combo');
    if (combo) {
      if (combo.value !== langCode) {
        combo.value = langCode;
        combo.dispatchEvent(new Event('change', { bubbles: true }));
        combo.dispatchEvent(new Event('input', { bubbles: true }));
      }
      return true;
    }

    // Fallback path when widget combo is not ready yet.
    document.cookie = `googtrans=/en/${langCode};path=/`;
    document.cookie = `googtrans=/en/${langCode};domain=${window.location.hostname};path=/`;
    return false;
  };

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

      const translateHost = document.getElementById('google_translate_element');
      if (!translateHost) {
        return;
      }

      const combo = document.querySelector('.goog-te-combo');
      const widgetMissing = !combo && translateHost.childElementCount === 0;
      if (widgetMissing) {
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

  const changeLanguage = (langCode) => {
    if (!langCode || langCode === language) {
      return;
    }

    setIsTranslating(true);
    localStorage.setItem('preferredLanguage', langCode);
    applyLanguage(langCode);
    setLanguage(langCode);

    // Force a full refresh so Google applies translation consistently.
    window.setTimeout(() => {
      window.location.reload();
    }, 250);
  };

  useEffect(() => {
    localStorage.setItem('preferredLanguage', language);
    if (language === 'en') {
      applyLanguage(language);
      setIsTranslating(false);
      return undefined;
    }

    setIsTranslating(true);

    const timeoutId = window.setTimeout(() => {
      setIsTranslating(false);
    }, 3500);

    const intervalId = window.setInterval(() => {
      const applied = applyLanguage(language);
      if (applied) {
        window.clearInterval(intervalId);
        // Translation updates are async; keep spinner briefly for feedback.
        window.setTimeout(() => setIsTranslating(false), 300);
      }
    }, 300);

    return () => {
      window.clearInterval(intervalId);
      window.clearTimeout(timeoutId);
    };
  }, [language]);

  return { language, setLanguage: changeLanguage, supportedLanguages, isTranslating };
}
