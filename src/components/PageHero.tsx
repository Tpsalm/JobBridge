import HeroCarousel from './HeroCarousel';
import FloatingDecorations from './FloatingDecorations';

interface PageHeroProps {
  title: string;
  subtitle?: string;
  images: string | string[];
  imageAlt?: string;
  compact?: boolean;
  overlay?: 'blue' | 'dark';
  variant?: 'fade' | 'slide3d';
}

export default function PageHero({
  title,
  subtitle,
  images,
  imageAlt = '',
  compact = false,
  overlay = 'blue',
  variant = 'slide3d',
}: PageHeroProps) {
  const imageArray = Array.isArray(images) ? images : [images];
  const overlayClass =
    overlay === 'dark'
      ? 'from-gray-900/85 via-gray-900/70 to-gray-900/50'
      : 'from-blue-900/90 via-blue-800/75 to-blue-700/60';

  return (
    <section className={`relative overflow-hidden ${compact ? 'mb-4' : 'mb-8'}`} style={{ perspective: '1000px' }}>
      <HeroCarousel images={imageArray} alt={imageAlt} variant={variant} interval={6000} />
      <div className={`absolute inset-0 bg-gradient-to-r ${overlayClass}`} />
      <FloatingDecorations className="opacity-75" />
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-10 left-10 h-40 w-40 rounded-full bg-white/10 blur-3xl animate-drift" />
        <div className="absolute bottom-12 right-12 h-24 w-24 rounded-full bg-blue-300/20 blur-3xl animate-drift" />
        <div className="absolute top-1/3 right-0 h-20 w-20 rounded-full bg-sky-300/20 blur-3xl animate-drift" />
      </div>
      <div
        className={`relative max-w-7xl mx-auto px-4 sm:px-6 transition-all duration-700 ease-out ${compact ? 'py-8' : 'py-12 sm:py-16'}`}
      >
        <h1
          className={`font-bold text-white leading-tight ${compact ? 'text-2xl sm:text-3xl' : 'text-3xl sm:text-4xl'}`}
          style={{ transformStyle: 'preserve-3d', transform: 'translateZ(30px)' }}
        >
          {title}
        </h1>
        {subtitle && (
          <p
            className={`text-blue-100 mt-2 max-w-2xl ${compact ? 'text-sm' : 'text-base sm:text-lg'}`}
            style={{ transformStyle: 'preserve-3d', transform: 'translateZ(15px)' }}
          >
            {subtitle}
          </p>
        )}
      </div>
    </section>
  );
}
