import { useEffect, useRef, useState } from 'react';

/**
 * Fail-safe scroll-reveal hook.
 *
 * Content is revealed when the element scrolls into view. To guarantee that
 * content is NEVER permanently hidden (e.g. on devices/embeds where the
 * IntersectionObserver never fires, or when the element is taller than the
 * viewport and the threshold can't be reached), this hook:
 *   1. Falls back to `inView = true` immediately when IntersectionObserver is
 *      not supported.
 *   2. Forces `inView = true` after a short grace period even if the observer
 *      has not reported the element as intersecting.
 */
export function useInView(threshold = 0.15, triggerOnce = true) {
  const ref = useRef<HTMLDivElement>(null);
  const [inView, setInView] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) {
      // If the ref isn't attached yet, retry on the next tick so the element
      // is never left invisible.
      const t = window.setTimeout(() => setInView(true), 0);
      return () => window.clearTimeout(t);
    }

    if (typeof IntersectionObserver === 'undefined') {
      setInView(true);
      return;
    }

    let settled = false;
    const forceVisible = () => {
      if (settled) return;
      settled = true;
      setInView(true);
    };

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          settled = true;
          setInView(true);
          if (triggerOnce) observer.unobserve(el);
        } else if (!triggerOnce) {
          setInView(false);
        }
      },
      { threshold }
    );
    observer.observe(el);

    // Safety net: never keep content hidden. If the observer hasn't fired
    // within 700ms, reveal the content anyway.
    const fallbackTimer = window.setTimeout(forceVisible, 700);

    return () => {
      settled = true;
      window.clearTimeout(fallbackTimer);
      observer.disconnect();
    };
  }, [threshold, triggerOnce]);

  return { ref, inView };
}
