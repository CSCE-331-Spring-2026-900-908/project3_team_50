import React, { useId, useMemo } from 'react';

/**
 * BobaIcon — Reusable SVG boba-tea cup component.
 *
 * Props:
 *   teaColor       – base liquid fill color
 *   milkColor      – wave / cream color layered on top
 *   iceLevel       – 'Regular Ice' | 'Less Ice' | 'No Ice'
 *   hasBoba        – show pearl dots
 *   bobaColor      – fill colour of the pearls (default dark brown)
 *   waveComplexity – 0 | 1 | 2  (number of animated wave layers)
 *   className      – forwarded to <svg>
 *   logoText       – brand stamp inside the cup (default 'TEAM 50')
 */
export const BobaIcon = ({
  teaColor = '#E6C9A8',
  milkColor = '#FFFFFF',
  iceLevel = 'Regular Ice',
  hasBoba = true,
  bobaColor = '#1A0A02',
  waveComplexity = 1,
  className = '',
  logoText = 'TEAM 50',
}) => {
  const rawId = useId();
  const id = rawId.replace(/:/g, '');

  // Tapered-cup outline shared between clip and strokes
  const cupD = 'M24 35 L33 140 C35 148 40 152 60 152 C80 152 85 148 87 140 L96 35 Z';

  return useMemo(() => {
    /* ── Boba pearls – deterministic positions ── */
    const bobaCircles = hasBoba
      ? Array.from({ length: 18 }, (_, i) => (
          <circle
            key={i}
            cx={38 + ((i * 17) % 44)}
            cy={145 - Math.floor(i / 6) * 6}
            r={4}
            fill={bobaColor}
          />
        ))
      : null;

    /* ── Ice cubes – count varies by iceLevel, stacked vertically ── */
    const ICE_COUNTS = { 'More Ice': 6, 'Regular Ice': 4, 'Less Ice': 2, 'No Ice': 0 };
    const iceCount = ICE_COUNTS[iceLevel] ?? 4;
    /* Vertical cascade positions: each cube steps down the cup with slight x-offsets */
    const icePositions = [
      { x: 42, y: 44 }, { x: 62, y: 48 },
      { x: 50, y: 62 }, { x: 70, y: 66 },
      { x: 44, y: 80 }, { x: 64, y: 84 },
    ];
    const iceCubes = iceCount > 0
      ? icePositions.slice(0, iceCount).map(({ x, y }, i) => (
          <rect
            key={i}
            x={x} y={y}
            width={14} height={14}
            rx={3}
            fill="rgba(255,255,255,0.35)"
            stroke="rgba(255,255,255,0.6)"
            strokeWidth={1}
            transform={`rotate(${10 + i * 15},${x + 7},${y + 7})`}
          />
        ))
      : null;

    /* ── Wave layer – animated translate loop ── */
    const Wave = ({ startY, speed, opacity, amplitude = 10, phase = 0 }) => (
      <g opacity={opacity}>
        <path
          d={`M0 ${startY}
              Q15 ${startY - amplitude} 30 ${startY}
              T60 ${startY} T90 ${startY} T120 ${startY}
              T150 ${startY} T180 ${startY} T210 ${startY} T240 ${startY}
              L240 160 L0 160 Z`}
          fill={milkColor}
        >
          <animateTransform
            attributeName="transform"
            type="translate"
            from={`${phase} 0`}
            to={`${phase - 60} 0`}
            dur={`${speed}s`}
            repeatCount="indefinite"
          />
        </path>
      </g>
    );

    return (
      <svg
        viewBox="0 0 120 160"
        className={className}
        aria-label="Boba tea cup icon"
        role="img"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        style={{ width: '100%', height: '100%', filter: 'drop-shadow(0 2px 5px rgba(0,0,0,0.15))' }}
      >
        <defs>
          <clipPath id={`clip-${id}`}>
            <path d={cupD} />
          </clipPath>
          <linearGradient id={`straw-${id}`} x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%"   stopColor="#C8102E" />
            <stop offset="30%"  stopColor="#A00E26" />
            <stop offset="60%"  stopColor="#C8102E" />
            <stop offset="100%" stopColor="#7B0B1D" />
          </linearGradient>
        </defs>

        {/* Straw — behind liquid */}
        <g transform="rotate(10,60,20)">
          <rect x={55} y={5} width={10} height={140} rx={2} fill={`url(#straw-${id})`} />
        </g>

        {/* Liquid + ice + boba, clipped to cup shape */}
        <g clipPath={`url(#clip-${id})`}>
          <rect x={0} y={40} width={120} height={120} fill={teaColor} />
          {iceCubes}
          <Wave startY={52} speed={12} opacity={0.6} amplitude={7}  phase={-15} />
          {waveComplexity > 0 && <Wave startY={60} speed={8}  opacity={0.8} amplitude={12} phase={0}   />}
          {waveComplexity > 1 && <Wave startY={70} speed={16} opacity={0.5} amplitude={18} phase={-30} />}
          {bobaCircles}
        </g>

        {/* Gloss highlight */}
        <g clipPath={`url(#clip-${id})`} opacity={0.3}>
          <path d="M26 40 Q40 80 34 140 L40 140 Q46 80 32 40 Z" fill="#FFFFFF" />
        </g>

        {/* Cup outline — two strokes for depth */}
        <path d={cupD} stroke="rgba(255,255,255,0.4)" strokeWidth={3} />
        <path d={cupD} stroke="rgba(0,0,0,0.08)"      strokeWidth={1} />

        {/* Rim ellipses */}
        <ellipse cx={60} cy={35} rx={37} ry={4} stroke="rgba(255,255,255,0.6)" strokeWidth={2} />
        <ellipse cx={60} cy={35} rx={36} ry={3} stroke="rgba(0,0,0,0.1)"       strokeWidth={1} />

        {/* Brand stamp */}
        <text
          x="50%" y={120}
          textAnchor="middle"
          fill="rgba(255,255,255,0.7)"
          fontSize={10}
          fontWeight={800}
          letterSpacing={1}
        >
          {logoText}
        </text>
      </svg>
    );
  }, [teaColor, milkColor, iceLevel, hasBoba, bobaColor, waveComplexity, className, logoText, id, cupD]);
};

/* ─────────────────────────────────────────────────────────────
   BobaTopping — compact icon card for addons selector.
   Renders unique coloured SVG per topping. Popping boba are
   glossy & semi-transparent; regular boba are solid & opaque.
   ───────────────────────────────────────────────────────────── */

/**
 * Palette lookup keyed by the exact `name` value from the API.
 * `popping: true` → glossy translucent SVG sphere.
 * Exported so the cart can resolve a boba name → pearl fill colour.
 */
export const TOPPING_STYLES = {
  // ── Popping Boba ──
  'Popping Boba (Strawberry)': { fill: '#E63946', rim: '#B02030', highlight: '#FF8A95', popping: true },
  'Popping Boba (Mango)':      { fill: '#F4A261', rim: '#C97B3A', highlight: '#FFD6A0', popping: true },
  'Popping Boba (Pineapple)':  { fill: '#FFD166', rim: '#C9A030', highlight: '#FFF0B3', popping: true },

  // ── Regular Boba ──
  'Black Tapioca Pearls':      { fill: '#1A0A02', rim: '#3D1A04', highlight: '#5C3A1E', popping: false },
  'Honey Boba':                { fill: '#D4A017', rim: '#A8780A', highlight: '#F0D060', popping: false },
  'Crystal Agar Boba':         { fill: '#D4EEF7', rim: '#9CC8DA', highlight: '#FFFFFF', popping: false },
  'Purple Sweet Potato Boba':  { fill: '#7B2D8E', rim: '#5A1A6A', highlight: '#B86FCC', popping: false },
  'Sago Pearls':               { fill: '#F5F0E8', rim: '#D4C8AA', highlight: '#FFFFFF', popping: false },
};

const defaultStyle = { fill: '#2D1B09', rim: '#1A0A02', highlight: '#5C3A1E', popping: false };

/**
 * BobaTopping — visual card for a single boba/topping option.
 */
export const BobaTopping = ({ topping, selected, onClick }) => {
  const { name, price } = topping;
  const { fill, rim, highlight, popping } = TOPPING_STYLES[name] ?? defaultStyle;
  const uid = name.replace(/\W/g, '');

  /* 2×2 pearl cluster positions */
  const positions = [[12, 13], [22, 13], [12, 22], [22, 22]];

  return (
    <button
      className={`boba-topping-card${selected ? ' selected' : ''}`}
      onClick={onClick}
      aria-pressed={selected}
      title={name}
    >
      <svg viewBox="0 0 34 34" aria-hidden="true" className="boba-topping-svg">
        {popping && (
          <defs>
            <radialGradient id={`pop-${uid}`} cx="35%" cy="35%" r="60%">
              <stop offset="0%"   stopColor={highlight} stopOpacity="0.9" />
              <stop offset="50%"  stopColor={fill}      stopOpacity="0.5" />
              <stop offset="100%" stopColor={rim}       stopOpacity="0.3" />
            </radialGradient>
          </defs>
        )}
        {positions.map(([cx, cy], i) =>
          popping ? (
            <g key={i}>
              <circle cx={cx} cy={cy} r={8} fill={`url(#pop-${uid})`} stroke={rim} strokeWidth={0.8} strokeOpacity={0.5} />
              <ellipse cx={cx - 2} cy={cy - 2} rx={3} ry={2} fill="rgba(255,255,255,0.6)" />
            </g>
          ) : (
            <g key={i}>
              <circle cx={cx} cy={cy} r={8} fill={fill} stroke={rim} strokeWidth={1.5} />
              <ellipse cx={cx - 1.5} cy={cy - 2} rx={2.5} ry={1.5} fill={highlight} opacity={0.4} />
            </g>
          )
        )}
      </svg>
      <span className="boba-topping-name">{name}</span>
      <span className="boba-topping-price">+${price.toFixed(2)}</span>
    </button>
  );
};

/** Returns true when a topping name matches the popping boba pattern. */
export const isPopping = (name) => name.startsWith('Popping Boba');

