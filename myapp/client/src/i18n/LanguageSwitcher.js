import React from 'react';

function LanguageSwitcher({ language, setLanguage, supportedLanguages, isTranslating = false }) {
  return (
    <div className="language-select-wrap">
      <label htmlFor="language-select">Language</label>
      <select
        id="language-select"
        className="language-select"
        value={language}
        onChange={(e) => setLanguage(e.target.value)}
        disabled={isTranslating}
      >
        {supportedLanguages.map((lang) => (
          <option key={lang.code} value={lang.code}>
            {lang.label}
          </option>
        ))}
      </select>
      {isTranslating && <span className="language-loading">Translating...</span>}
      <div id="google_translate_element" className="google-translate-hidden" />
    </div>
  );
}

export default LanguageSwitcher;
