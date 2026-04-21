import React, { useState, useEffect, useRef } from 'react';
import { getLanguageDisplayLabel } from './languageDisplayLabels';

function LanguageSwitcher({ language, setLanguage, supportedLanguages, isTranslating = false }) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef(null);

  useEffect(() => {
    const onDocMouseDown = (e) => {
      if (!rootRef.current || rootRef.current.contains(e.target)) return;
      setOpen(false);
    };
    const onKeyDown = (e) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onDocMouseDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onDocMouseDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, []);

  const currentLabel = getLanguageDisplayLabel(
    language,
    supportedLanguages.find((l) => l.code === language)?.label
  );

  return (
    <>
    <div
      ref={rootRef}
      className="language-select-wrap notranslate"
      translate="no"
      lang="en"
    >
      <span className="language-select-label notranslate" translate="no">
        Language
      </span>
      <div className="language-dropdown">
        <button
          type="button"
          id="language-select-button"
          className="language-select language-select-button notranslate"
          translate="no"
          aria-haspopup="listbox"
          aria-expanded={open}
          aria-label="Language"
          disabled={isTranslating}
          onClick={() => setOpen((v) => !v)}
        >
          <span className="language-select-current notranslate" translate="no">
            {currentLabel}
          </span>
          <span className="language-select-chevron" aria-hidden>
            ▾
          </span>
        </button>
        {open && (
          <ul className="language-menu notranslate" translate="no" role="listbox">
            {supportedLanguages.map((lang) => (
              <li key={lang.code} role="none">
                <button
                  type="button"
                  role="option"
                  aria-selected={lang.code === language}
                  className={`language-menu-item notranslate${lang.code === language ? ' is-active' : ''}`}
                  translate="no"
                  onClick={() => {
                    setLanguage(lang.code);
                    setOpen(false);
                  }}
                >
                  {getLanguageDisplayLabel(lang.code, lang.label)}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
      {isTranslating && language !== 'en' && (
        <span className="language-loading notranslate" translate="no">
          Translating...
        </span>
      )}
    </div>
    {/* Host outside notranslate so the widget/combo is not inside a no-translate subtree */}
    <div id="google_translate_element" className="google-translate-hidden" aria-hidden />
    </>
  );
}

export default LanguageSwitcher;
