export type HeroAbVariant = 'A' | 'B';

type HeroAbEventType = 'exposure' | 'cta_click';

export interface HeroAbMetrics {
  variant: HeroAbVariant;
  exposures: Record<HeroAbVariant, number>;
  ctaClicks: Record<HeroAbVariant, number>;
  lastUpdated: string;
}

const STORAGE_KEY = 'jobbridge_hero_ab_metrics';

const defaultMetrics: HeroAbMetrics = {
  variant: 'A',
  exposures: { A: 0, B: 0 },
  ctaClicks: { A: 0, B: 0 },
  lastUpdated: new Date().toISOString(),
};

function readMetrics(): HeroAbMetrics {
  if (typeof window === 'undefined') return defaultMetrics;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultMetrics;
    const parsed = JSON.parse(raw) as Partial<HeroAbMetrics>;
    return {
      variant: parsed.variant === 'B' ? 'B' : 'A',
      exposures: {
        A: parsed.exposures?.A ?? 0,
        B: parsed.exposures?.B ?? 0,
      },
      ctaClicks: {
        A: parsed.ctaClicks?.A ?? 0,
        B: parsed.ctaClicks?.B ?? 0,
      },
      lastUpdated: parsed.lastUpdated ?? new Date().toISOString(),
    };
  } catch {
    return defaultMetrics;
  }
}

function writeMetrics(metrics: HeroAbMetrics) {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(metrics));
}

export function getHeroAbMetrics(): HeroAbMetrics {
  return readMetrics();
}

export function resetHeroAbMetrics(): HeroAbMetrics {
  const reset = { ...defaultMetrics, lastUpdated: new Date().toISOString() };
  writeMetrics(reset);
  return reset;
}

export function recordHeroAbEvent(eventType: HeroAbEventType, variant: HeroAbVariant) {
  const metrics = readMetrics();
  const next = {
    ...metrics,
    variant,
    exposures: { ...metrics.exposures },
    ctaClicks: { ...metrics.ctaClicks },
    lastUpdated: new Date().toISOString(),
  };

  if (eventType === 'exposure') {
    next.exposures[variant] = (next.exposures[variant] ?? 0) + 1;
  }
  if (eventType === 'cta_click') {
    next.ctaClicks[variant] = (next.ctaClicks[variant] ?? 0) + 1;
  }

  writeMetrics(next);
}
