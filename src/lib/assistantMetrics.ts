export interface AssistantMetrics {
  clicks: Record<string, number>;
  lastUpdated: string;
}

const STORAGE_KEY = "jobbridge_assistant_metrics";

const defaultMetrics: AssistantMetrics = {
  clicks: {},
  lastUpdated: new Date().toISOString(),
};

function readMetrics(): AssistantMetrics {
  if (typeof window === "undefined") return defaultMetrics;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultMetrics;
    const parsed = JSON.parse(raw) as Partial<AssistantMetrics>;
    return {
      clicks: parsed.clicks || {},
      lastUpdated: parsed.lastUpdated || new Date().toISOString(),
    };
  } catch {
    return defaultMetrics;
  }
}

function writeMetrics(metrics: AssistantMetrics) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(metrics));
}

export function getAssistantMetrics(): AssistantMetrics {
  return readMetrics();
}

export function resetAssistantMetrics(): AssistantMetrics {
  const reset = { ...defaultMetrics, lastUpdated: new Date().toISOString() };
  writeMetrics(reset);
  return reset;
}

export function recordAssistantRouteClick(route: string) {
  const metrics = readMetrics();
  const next = { ...metrics, clicks: { ...metrics.clicks }, lastUpdated: new Date().toISOString() };
  next.clicks[route] = (next.clicks[route] || 0) + 1;
  writeMetrics(next);
  // Also emit a console event for easy debugging in production
  try {
    // eslint-disable-next-line no-console
    console.info("assistant_click", { route, count: next.clicks[route] });
  } catch {}
}
