import React, { useId } from 'react';

export const BobaIcon = ({
  // Core Liquid Gradient Stops
  liquidGradient = [
    { offset: "0%", color: "#2E1A11" },  // Bottom
    { offset: "40%", color: "#8E5F41" }, // Middle
    { offset: "100%", color: "#F0DFD1" } // Top
  ],

  // Dirty Noise
  showDirty = true,
  dirtyColor = "#4A220D",
  topSwirlColor = "#FFFFFF",
  dirtyOpacity = 0.9,
  noiseFrequencyX = 0.05,
  noiseFrequencyY = 0.1,

  // Boba Pearls
  showBoba = true,
  bobaColor = "#1A0F00",

  // Ice
  showIce = true,

  // Lid/Outline
  cupOutlineColor = "#D5CDA9",

  // Text Overlay
  logoText = "",

  className = "w-24 h-24"
}) => {
  const rawId = useId() || "static_id";
  const idPrefix = rawId.replace(/:/g, '');

  const cupPath = "M24 35 L33 140 C 35 148 40 152 60 152 C 80 152 85 148 87 140 L96 35 Z";

  return (
    <svg
      viewBox="0 0 120 160"
      className={className}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      style={{ width: '100%', height: '100%', filter: 'drop-shadow(0px 2px 4px rgba(0,0,0,0.1))' }}
    >
      <defs>
        <linearGradient id={`liquid-grad-${idPrefix}`} x1="0" y1="1" x2="0" y2="0">
          {liquidGradient.map((stop, i) => (
            <stop key={i} offset={stop.offset} stopColor={stop.color} />
          ))}
        </linearGradient>

        <filter id={`domain-warp-${idPrefix}`} x="-50%" y="-50%" width="200%" height="200%">
          <feTurbulence
            type="turbulence"
            baseFrequency={`${noiseFrequencyX} ${noiseFrequencyY}`}
            numOctaves="2"
            result="noise"
          />
          <feGaussianBlur in="noise" stdDeviation="0.5" result="smoothNoise" />
          <feDisplacementMap
            in="SourceGraphic"
            in2="smoothNoise"
            scale="60"
            xChannelSelector="R"
            yChannelSelector="G"
            result="displaced"
          />
        </filter>

        <linearGradient id={`syrup-gradient-${idPrefix}`} x1="0" y1="1" x2="0" y2="0">
          {/* Bottom swirl (dark syrup) coming up */}
          <stop offset="0%" stopColor={dirtyColor} stopOpacity="1" />
          <stop offset="25%" stopColor={dirtyColor} stopOpacity="0.9" />
          <stop offset="55%" stopColor={dirtyColor} stopOpacity="0" />
          
          {/* Top swirl (milk) coming down */}
          <stop offset="45%" stopColor={topSwirlColor} stopOpacity="0" />
          <stop offset="75%" stopColor={topSwirlColor} stopOpacity="0.9" />
          <stop offset="100%" stopColor={topSwirlColor} stopOpacity="1" />
        </linearGradient>

        <clipPath id={`cup-clip-${idPrefix}`}>
          <path d={cupPath} />
        </clipPath>

        {/* Ice cube shape */}
        <g id={`ice-cube-${idPrefix}`}>
          <path d="M0,3 L10,-1 L20,3 L20,13 L10,17 L0,13 Z" fill="#ffffff" fillOpacity="0.4" stroke="#ffffff" strokeWidth="0.5" strokeOpacity="0.6" />
          <path d="M0,3 L10,7 L20,3" fill="none" stroke="#ffffff" strokeWidth="0.5" strokeOpacity="0.6" />
          <path d="M10,7 L10,17" fill="none" stroke="#ffffff" strokeWidth="0.5" strokeOpacity="0.6" />
        </g>
      </defs>

      {/* 1. Base Liquid */}
      <path
        d={cupPath}
        fill={`url(#liquid-grad-${idPrefix})`}
      />

      {/* 2. Dirty/Noise effect using SVG Domain Warping */}
      {showDirty && (
        <g clipPath={`url(#cup-clip-${idPrefix})`}>
          <rect
            x="0" y="0" width="120" height="160"
            fill={`url(#syrup-gradient-${idPrefix})`}
            opacity={dirtyOpacity}
            filter={`url(#domain-warp-${idPrefix})`}
          />
        </g>
      )}

      {/* 3. Ice Cubes */}
      {showIce && (
        <g>
          <use href={`#ice-cube-${idPrefix}`} x="40" y="40" transform="scale(0.8) rotate(15 40 40)" />
          <use href={`#ice-cube-${idPrefix}`} x="60" y="55" transform="scale(1.1) rotate(-10 60 55)" />
          <use href={`#ice-cube-${idPrefix}`} x="35" y="70" transform="scale(0.9) rotate(5 35 70)" />
          <use href={`#ice-cube-${idPrefix}`} x="70" y="45" transform="scale(0.7) rotate(25 70 45)" />
          <use href={`#ice-cube-${idPrefix}`} x="50" y="80" transform="scale(1) rotate(-5 50 80)" />
          <use href={`#ice-cube-${idPrefix}`} x="65" y="90" transform="scale(0.85) rotate(-15 65 90)" />
          <use href={`#ice-cube-${idPrefix}`} x="38" y="95" transform="scale(0.9) rotate(12 38 95)" />
        </g>
      )}

      {/* 4. Boba Pearls */}
      {showBoba && (
        <g fill={bobaColor} opacity="0.95">
          <circle cx="45" cy="144" r="6" />
          <circle cx="58" cy="146" r="6.5" />
          <circle cx="72" cy="143" r="5.5" />
          <circle cx="52" cy="134" r="6" />
          <circle cx="66" cy="135" r="6" />
          <circle cx="40" cy="132" r="5" />
          <circle cx="80" cy="133" r="5.5" />
          <circle cx="60" cy="122" r="6" />
          <circle cx="48" cy="120" r="5" />
          <circle cx="72" cy="121" r="5.5" />
        </g>
      )}

      {/* 5. Highlight / Glass Reflection */}
      <path
        d="M 28 40 L 35 130 Q 36 140 42 145 Q 38 135 36 80 Z"
        fill="#ffffff"
        opacity="0.4"
      />
      <path
        d="M 90 40 L 85 130"
        stroke="#ffffff"
        strokeWidth="1.5"
        strokeLinecap="round"
        opacity="0.3"
      />

      {/* 6. Cup Outline */}
      <path
        d={cupPath}
        stroke={cupOutlineColor}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />

      {/* 7. Logo Text Overlay */}
      {logoText && (
        <text
          x="60" y="85"
          textAnchor="middle"
          fill="#ffffff"
          opacity="0.9"
          fontSize="8"
          fontWeight="400"
          letterSpacing="1"
          transform="rotate(90 60 85)"
          style={{ fontFamily: "'Inter', system-ui, sans-serif" }}
        >
          {logoText}
        </text>
      )}

      {/* 8. The Lid (Feng Cha style) */}
      <g stroke={cupOutlineColor} strokeWidth="1.5" fill="none">
        {/* Seal edge */}
        <ellipse cx="60" cy="35" rx="38" ry="4" strokeWidth="2" />
        {/* Lid dome */}
        <path d="M 24 35 Q 24 25 30 22 L 90 22 Q 96 25 96 35" />
        <ellipse cx="60" cy="22" rx="30" ry="3" />
        {/* Small cap */}
        <path d="M 50 19 L 50 16 L 70 16 L 70 19" />
      </g>
    </svg>
  );
};
