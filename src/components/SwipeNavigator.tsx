import { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

export const SWIPE_ROUTES = ['/', '/jobs', '/providers', '/recruiter', '/pricing', '/payment'];
const SWIPE_MIN_DISTANCE = 80;
const SWIPE_MAX_VERTICAL_OFFSET = 80;

function isInteractiveTarget(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) return false;
  return ['INPUT', 'TEXTAREA', 'SELECT', 'BUTTON', 'A'].includes(target.tagName);
}

function routeLabel(path: string) {
  return (
    {
      '/': 'Home',
      '/jobs': 'Jobs',
      '/providers': 'Providers',
      '/recruiter': 'Recruiter',
      '/pricing': 'Pricing',
      '/payment': 'Payment',
    } as Record<string, string>
  )[path] || path.replace('/', '') || 'Page';
}

export default function SwipeNavigator() {
  const location = useLocation();
  const navigate = useNavigate();
  const touchStartX = useRef(0);
  const touchStartY = useRef(0);
  const touchActive = useRef(false);
  const [showHint, setShowHint] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const supportsTouch = 'ontouchstart' in window || navigator.maxTouchPoints > 0 || (navigator as any).msMaxTouchPoints > 0;
    if (!supportsTouch) return;
    setShowHint(true);

    const hintTimer = window.setTimeout(() => setShowHint(false), 9000);
    return () => window.clearTimeout(hintTimer);
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const supportsTouch = 'ontouchstart' in window || navigator.maxTouchPoints > 0 || (navigator as any).msMaxTouchPoints > 0;
    if (!supportsTouch) return;

    const handleTouchStart = (event: TouchEvent) => {
      if (event.touches.length !== 1) return;
      if (isInteractiveTarget(event.target)) return;
      touchStartX.current = event.touches[0].clientX;
      touchStartY.current = event.touches[0].clientY;
      touchActive.current = true;
    };

    const handleTouchEnd = (event: TouchEvent) => {
      if (!touchActive.current) return;
      touchActive.current = false;
      const touch = event.changedTouches[0];
      const dx = touch.clientX - touchStartX.current;
      const dy = touch.clientY - touchStartY.current;
      if (Math.abs(dx) < SWIPE_MIN_DISTANCE || Math.abs(dy) > SWIPE_MAX_VERTICAL_OFFSET) return;

      const currentIndex = SWIPE_ROUTES.indexOf(location.pathname);
      if (currentIndex === -1) return;
      if (dx < 0 && currentIndex < SWIPE_ROUTES.length - 1) {
        navigate(SWIPE_ROUTES[currentIndex + 1]);
      } else if (dx > 0 && currentIndex > 0) {
        navigate(SWIPE_ROUTES[currentIndex - 1]);
      }
    };

    window.addEventListener('touchstart', handleTouchStart, { passive: true });
    window.addEventListener('touchend', handleTouchEnd, { passive: true });

    return () => {
      window.removeEventListener('touchstart', handleTouchStart);
      window.removeEventListener('touchend', handleTouchEnd);
    };
  }, [location.pathname, navigate]);

  const currentIndex = SWIPE_ROUTES.indexOf(location.pathname);
  if (!showHint || currentIndex === -1) return null;

  const nextLeft = currentIndex > 0 ? routeLabel(SWIPE_ROUTES[currentIndex - 1]) : null;
  const nextRight = currentIndex < SWIPE_ROUTES.length - 1 ? routeLabel(SWIPE_ROUTES[currentIndex + 1]) : null;

  return (
    <div className="pointer-events-none fixed bottom-20 left-1/2 z-50 -translate-x-1/2 rounded-full bg-slate-900/85 px-4 py-2 text-xs text-white shadow-xl shadow-slate-900/20 md:hidden">
      <div className="flex items-center gap-3">
        {nextLeft && <span className="font-semibold">◀ Swipe right for {nextLeft}</span>}
        {nextLeft && nextRight && <span className="text-slate-300">•</span>}
        {nextRight && <span className="font-semibold">Swipe left for {nextRight} ▶</span>}
      </div>
    </div>
  );
}
