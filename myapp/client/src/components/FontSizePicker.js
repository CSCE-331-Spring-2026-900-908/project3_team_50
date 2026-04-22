import React from 'react';
import { useFontSize } from '../hooks/useFontSize';

function FontSizePicker({ variant = 'nav' }) {
  const { fontSize, setFontSize } = useFontSize();

  return (
    <div className={`font-size-wrap font-size-wrap--${variant}`}>
      <label htmlFor="font-size-select">Text size</label>
      <select
        id="font-size-select"
        className="font-size-select"
        value={fontSize}
        onChange={(e) => setFontSize(e.target.value)}
        aria-label="Text size"
      >
        <option value="small">Small</option>
        <option value="medium">Medium</option>
        <option value="large">Large</option>
      </select>
    </div>
  );
}

export default FontSizePicker;
