export interface PaymentMetrics {
  clicks: Record<string, number>;
  lastUpdated: string;
}

const STORAGE_KEY = 'jobbridge_payment_metrics';

const defaultMetrics: PaymentMetrics = {
  clicks: {},
  lastUpdated: new Date().toISOString(),
};

function readMetrics(): PaymentMetrics {
  if (typeof window === 'undefined') return defaultMetrics;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultMetrics;
    const parsed = JSON.parse(raw) as Partial<PaymentMetrics>;
    return {
      clicks: parsed.clicks || {},
      lastUpdated: parsed.lastUpdated || new Date().toISOString(),
    };
  } catch {
    return defaultMetrics;
  }
}

function writeMetrics(metrics: PaymentMetrics) {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(metrics));
}

export function getPaymentMetrics(): PaymentMetrics {
  return readMetrics();
}

export function resetPaymentMetrics(): PaymentMetrics {
  const reset = { ...defaultMetrics, lastUpdated: new Date().toISOString() };
  writeMetrics(reset);
  return reset;
}

export function recordPaymentClick(key: string) {
  const metrics = readMetrics();
  const next = { ...metrics, clicks: { ...metrics.clicks }, lastUpdated: new Date().toISOString() };
  next.clicks[key] = (next.clicks[key] || 0) + 1;
  writeMetrics(next);
  try { console.info('payment_click', { key, count: next.clicks[key] }); } catch {}
}
