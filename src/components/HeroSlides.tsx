import React, { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Search, Users, Zap } from 'lucide-react';
import { pexel } from '../lib/media';
import { recordHeroAbEvent, HeroAbVariant } from '../lib/abMetrics';

// A/B variant handling: stored in localStorage 'hero_ab'. Use ?ab=B to override.
function resolveVariant() {
  try {
    const url = new URL(window.location.href);
    const q = url.searchParams.get('ab');
    if (q === 'A' || q === 'B') {
      localStorage.setItem('hero_ab', q);
      return q as HeroAbVariant;
    }
    const stored = localStorage.getItem('hero_ab');
    if (stored === 'A' || stored === 'B') return stored as HeroAbVariant;
    const rand = Math.random() < 0.5 ? 'A' : 'B';
    localStorage.setItem('hero_ab', rand);
    return rand as HeroAbVariant;
  } catch {
    return 'A';
  }
}

const variant = typeof window !== 'undefined' ? resolveVariant() : 'A';

const DEFAULT_INTERVAL = variant === 'B' ? 4000 : 5000;

const slides = [
  { id: 'discover', imageId: 3194519, w: 1280, h: 800, title: "Your career bridge to what's next", subtitle: 'AI-powered job matching, verified employers, and real-time talent search.', ctas: [{ to: '/jobs', label: 'Find Jobs', icon: <Search className="w-4 h-4" /> }, { to: '/providers', label: 'Hire Talent', icon: <Users className="w-4 h-4" /> }, { to: '/ai-resume', label: 'AI Resume', icon: <Zap className="w-4 h-4" /> }] },
  { id: 'growth', imageId: 7176027, w: 1280, h: 800, title: 'Professional Growth', subtitle: 'Connect with top employers and discover opportunities that match your skills.', ctas: [{ to: '/providers', label: 'Hire Talent', icon: <Users className="w-4 h-4" /> }, { to: '/jobs', label: 'Find Jobs', icon: <Search className="w-4 h-4" /> }] },
  { id: 'insights', imageId: 8386440, w: 1280, h: 800, title: 'Live career insights', subtitle: 'Real-time hiring data and career guidance to accelerate your next move.', ctas: [{ to: '/blog', label: 'Read Insights', icon: <Search className="w-4 h-4" /> }] },
];

function srcFor(id: number, w: number, h: number) {
  return pexel(id, w, h);
}

function srcSetFor(id: number) {
  // provide multiple widths for responsive loading
  const sizes = [640, 900, 1280, 1600];
  return sizes.map(s => `${srcFor(id, s, Math.round((s * 9) / 16))} ${s}w`).join(', ');
}

export default function HeroSlides() {
  const [index, setIndex] = useState(0);
  const timerRef = useRef<number | null>(null);
  const touchStartX = useRef<number | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  // interval depends on variant (A or B)
  const interval = DEFAULT_INTERVAL;

  useEffect(() => {
    recordHeroAbEvent('exposure', variant);
    startTimer();
    return () => stopTimer();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    startTimer();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index]);

  function startTimer() {
    stopTimer();
    timerRef.current = window.setInterval(() => {
      setIndex(i => (i + 1) % slides.length);
    }, interval);
  }

  function stopTimer() {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }

  function onTouchStart(e: React.TouchEvent) {
    touchStartX.current = e.touches[0].clientX;
    stopTimer();
  }

  function onTouchEnd(e: React.TouchEvent) {
    const start = touchStartX.current;
    if (start == null) return;
    const end = e.changedTouches[0].clientX;
    const delta = end - start;
    const threshold = 50;
    if (delta > threshold) {
      setIndex(i => (i - 1 + slides.length) % slides.length);
    } else if (delta < -threshold) {
      setIndex(i => (i + 1) % slides.length);
    }
    touchStartX.current = null;
    startTimer();
  }

  return (
    <div className="relative">
      <div className="pointer-events-none absolute inset-0 rounded-[32px] bg-gradient-to-b from-slate-900/10 via-transparent to-slate-900/5" />
      <div
        ref={containerRef}
        onMouseEnter={stopTimer}
        onMouseLeave={startTimer}
        onTouchStart={onTouchStart}
        onTouchEnd={onTouchEnd}
        className="relative w-full h-[420px] overflow-hidden rounded-[32px] shadow-[0_32px_120px_-45px_rgba(15,23,42,0.65)]"
      >
        {slides.map((s, i) => {
          const active = i === index;
          // Determine CTA order per variant: variant B reverses CTAs
          const ctas = variant === 'B' ? [...s.ctas].reverse() : s.ctas;
          return (
            <div
              key={s.id}
              className={`absolute inset-0 w-full h-full transition-opacity duration-800 ease-out ${active ? 'opacity-100 z-10' : 'opacity-0 z-0'}`}
            >
              <img
                src={srcFor(s.imageId, s.w, s.h)}
                srcSet={srcSetFor(s.imageId)}
                sizes="(max-width: 1024px) 100vw, 50vw"
                loading={active ? 'eager' : 'lazy'}
                decoding="async"
                alt={s.title}
                className="w-full h-full object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-br from-black/30 via-transparent to-black/40" />
              <div className="absolute inset-0 flex flex-col items-start justify-center p-8 lg:p-12 text-white">
                <p className="text-sm uppercase tracking-widest bg-white/10 px-3 py-1 rounded-full mb-4">Featured</p>
                <h3 className="text-2xl sm:text-3xl md:text-4xl font-bold leading-tight mb-3">{s.title}</h3>
                <p className="max-w-md text-sm text-white/80 mb-6">{s.subtitle}</p>
                <div className="flex gap-3">
                  {ctas.map(cta => (
                    <Link
                      key={cta.label}
                      to={cta.to}
                      onClick={() => recordHeroAbEvent('cta_click', variant)}
                      className="inline-flex items-center gap-2 bg-white text-blue-700 font-semibold px-4 py-2 rounded-xl hover:bg-white/90 transition-shadow"
                    >
                      {cta.icon}
                      <span className="text-sm">{cta.label}</span>
                    </Link>
                  ))}
                </div>
              </div>
            </div>
          );
        })}

        <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-2 z-20">
          {slides.map((_, i) => (
            <button key={i} onClick={() => setIndex(i)} aria-label={`Slide ${i + 1}`} className={`rounded-full transition-all duration-300 ${i === index ? 'bg-white w-6 h-2' : 'bg-white/40 w-2 h-2'}`} />
          ))}
        </div>
      </div>

      <div className="mt-4 rounded-xl overflow-hidden bg-blue-50 border border-blue-100 py-2">
        <div className="marquee whitespace-nowrap">
          <div className="marquee-track inline-flex items-center gap-12 px-4">
            <div className="text-sm text-blue-700 font-semibold">24,500+ jobs actively hiring now</div>
            <div className="text-sm text-blue-700 font-semibold">Average placement time: 24 days</div>
            <div className="text-sm text-blue-700 font-semibold">500+ new talent connections daily</div>
            <div className="text-sm text-blue-700 font-semibold">94% placement success rate</div>
            <div className="text-sm text-blue-700 font-semibold">AI-powered matches updated every minute</div>
          </div>
        </div>
      </div>
    </div>
  );
}
