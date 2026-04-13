import React from 'react';

function LanguageSwitcher({ language, setLanguage, supportedLanguages }) {
  return (
    <div className="language-select-wrap">
      <label htmlFor="language-select">Language</label>
      <select
        id="language-select"
        className="language-select"
        value={language}
        onChange={(e) => setLanguage(e.target.value)}
      >
        {supportedLanguages.map((lang) => (
          <option key={lang.code} value={lang.code}>
            {lang.label}
          </option>
        ))}
      </select>
      <div id="google_translate_element" className="google-translate-hidden" />
    </div>
  );
}

export default LanguageSwitcher;
