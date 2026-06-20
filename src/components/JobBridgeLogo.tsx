import React from 'react';

interface JobBridgeLogoProps {
  /** Layout variant */
  variant?: 'icon' | 'horizontal' | 'stacked';
  /** Size of the icon mark in pixels */
  iconSize?: number;
  /** Show tagline below text */
  tagline?: boolean;
  /** Light mode for dark backgrounds */
  light?: boolean;
  /** Additional className */
  className?: string;
}

/* ─── SVG Icon Mark: stylised "j" with bridge arch ─── */
const LogoMark: React.FC<{ size: number; light?: boolean }> = ({ size, light }) => {
  const blue = light ? '#60A5FA' : '#1D4ED8';       // bright blue
  const dotBlue = light ? '#93C5FD' : '#2563EB';
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-label="JobBridge logo"
    >
      {/* Circle dot on top */}
      <circle cx="24" cy="8" r="6" fill={dotBlue} />

      {/* Vertical stem of "j" */}
      <rect x="18" y="16" width="12" height="36" rx="2" fill={blue} />

      {/* Hook/curve at the bottom of "j" */}
      <path
        d="M30 52 C30 58, 24 62, 18 58 C14 55, 14 50, 18 48"
        stroke={blue}
        strokeWidth="10"
        strokeLinecap="round"
        fill="none"
      />

      {/* Bridge arch connecting from the "j" */}
      <path
        d="M30 28 Q40 14, 52 28"
        stroke={blue}
        strokeWidth="4"
        strokeLinecap="round"
        fill="none"
      />

      {/* Bridge deck (horizontal line) */}
      <line x1="28" y1="28" x2="54" y2="28" stroke={blue} strokeWidth="3.5" strokeLinecap="round" />

      {/* Bridge pillars / suspension lines */}
      <line x1="34" y1="19" x2="34" y2="28" stroke={blue} strokeWidth="2.5" strokeLinecap="round" />
      <line x1="41" y1="15.5" x2="41" y2="28" stroke={blue} strokeWidth="2.5" strokeLinecap="round" />
      <line x1="48" y1="19" x2="48" y2="28" stroke={blue} strokeWidth="2.5" strokeLinecap="round" />

      {/* Right abutment */}
      <rect x="50" y="28" width="6" height="24" rx="2" fill={blue} />
    </svg>
  );
};

/* ─── Text block: "JobBridge" with optional tagline ─── */
const LogoText: React.FC<{ light?: boolean; tagline?: boolean; textSize?: string; taglineSize?: string }> = ({
  light,
  tagline,
  textSize = 'text-lg',
  taglineSize = 'text-[8px]',
}) => {
  const darkColor = light ? 'text-white' : 'text-gray-900';
  const brightColor = light ? 'text-blue-300' : 'text-blue-600';
  const taglineColor = light ? 'text-blue-200' : 'text-gray-600';

  return (
    <div>
      <span className={`${textSize} font-extrabold tracking-tight leading-none`}>
        <span className={darkColor}>Job</span>
        <span className={brightColor}>Bridge</span>
      </span>
      {tagline && (
        <div className={`${taglineSize} font-semibold tracking-[0.15em] uppercase leading-tight mt-0.5 ${taglineColor}`}>
          Connecting Talent. Building Futures.
        </div>
      )}
    </div>
  );
};

/* ─── Main Component ─── */
const JobBridgeLogo: React.FC<JobBridgeLogoProps> = ({
  variant = 'horizontal',
  iconSize = 32,
  tagline = false,
  light = false,
  className = '',
}) => {
  if (variant === 'icon') {
    return (
      <span className={`inline-flex items-center justify-center ${className}`}>
        <LogoMark size={iconSize} light={light} />
      </span>
    );
  }

  if (variant === 'stacked') {
    return (
      <div className={`flex flex-col items-center gap-2 ${className}`}>
        <LogoMark size={iconSize} light={light} />
        <LogoText light={light} tagline={tagline} textSize="text-2xl" taglineSize="text-[9px]" />
      </div>
    );
  }

  // horizontal (default)
  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <LogoMark size={iconSize} light={light} />
      <LogoText light={light} tagline={tagline} textSize="text-lg" taglineSize="text-[8px]" />
    </div>
  );
};

export default JobBridgeLogo;
