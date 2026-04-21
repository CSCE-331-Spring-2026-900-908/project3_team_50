import { useState } from 'react';
import { readFontSize, persistFontSize } from '../fontSize';

export function useFontSize() {
  const [fontSize, setFontSizeState] = useState(() => readFontSize());

  const setFontSize = (size) => {
    const s = persistFontSize(size);
    setFontSizeState(s);
  };

  return { fontSize, setFontSize };
}
