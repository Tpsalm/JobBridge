import { useState, useEffect, useCallback } from 'react';

interface HeroCarouselProps {
  images: string[];
  alt?: string;
  interval?: number;
  className?: string;
  variant?: 'fade' | 'slide3d';
}

export default function HeroCarousel({ images, alt = '', interval = 5000, className = '', variant = 'fade' }: HeroCarouselProps) {
  const [current, setCurrent] = useState(0);
  const [prev, setPrev] = useState(images.length - 1);

  const next = useCallback(() => {
    setPrev(current);
    setCurrent((prev) => (prev + 1) % images.length);
  }, [current, images.length]);

  useEffect(() => {
    if (images.length <= 1) return;
    const timer = setInterval(next, interval);
    return () => clearInterval(timer);
  }, [next, interval, images.length]);

  if (images.length === 0) return null;

  return (
    <div className={`absolute inset-0 ${className} overflow-hidden`} style={{ perspective: variant === 'slide3d' ? '1200px' : undefined }}>
      {images.map((src, i) => {
        const isActive = i === current;
        const isLeaving = i === prev && !isActive;
        return (
          <img
            key={i}
            src={src}
            alt={i === 0 ? alt : ''}
            className={`absolute inset-0 w-full h-full object-cover transition-all duration-1000 ease-out ${
              variant === 'slide3d'
                ? isActive
                  ? 'opacity-100 scale-100 rotateY-0'
                  : 'opacity-0 scale-110'
                : isActive
                  ? 'opacity-100'
                  : 'opacity-0'
            }`}
            style={{
              willChange: 'transform, opacity',
              ...(variant === 'slide3d' && isLeaving
                ? { transform: 'scale(1.05) translateZ(-50px)', filter: 'brightness(0.6) blur(1px)', opacity: 0 }
                : isActive && variant === 'slide3d'
                  ? { transform: 'scale(1) translateZ(0)', filter: 'brightness(1) blur(0)' }
                  : {}),
            }}
          />
        );
      })}
      {images.length > 1 && (
        <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1.5 z-10">
          {images.map((_, i) => (
            <button
              key={i}
              onClick={() => { setPrev(current); setCurrent(i); }}
              className={`rounded-full transition-all duration-500 ${
                i === current
                  ? 'bg-white w-6 h-2'
                  : 'bg-white/40 w-2 h-2 hover:bg-white/70'
              }`}
              aria-label={`Slide ${i + 1}`}
            />
          ))}
        </div>
      )}
      {/* Depth overlay for 3D variant */}
      {variant === 'slide3d' && (
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-black/20 pointer-events-none" />
      )}
    </div>
  );
}
