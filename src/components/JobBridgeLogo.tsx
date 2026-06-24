interface JobBridgeLogoProps {
  /** Layout variant */
  variant?: 'icon' | 'horizontal' | 'stacked';
  /** Size of the icon/image in pixels */
  iconSize?: number;
  /** Show tagline below text */
  tagline?: boolean;
  /** Light mode for dark backgrounds */
  light?: boolean;
  /** Additional className */
  className?: string;
}

const LOGO_PATH = '/images/jobbridge-logo.jpeg';

/* ─── Image Logo Mark ─── */
const LogoMark: React.FC<{ size: number }> = ({ size }) => (
  <img
    src={LOGO_PATH}
    alt="JobBridge logo"
    width={size}
    height={size}
    className="object-contain"
    style={{ borderRadius: size * 0.18 }}
  />
);

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
        <LogoMark size={iconSize} />
      </span>
    );
  }

  if (variant === 'stacked') {
    return (
      <div className={`flex flex-col items-center gap-2 ${className}`}>
        <LogoMark size={iconSize} />
        <LogoText light={light} tagline={tagline} textSize="text-2xl" taglineSize="text-[9px]" />
      </div>
    );
  }

  // horizontal (default)
  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <LogoMark size={iconSize} />
      <LogoText light={light} tagline={tagline} textSize="text-lg" taglineSize="text-[8px]" />
    </div>
  );
};

export default JobBridgeLogo;
