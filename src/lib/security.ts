// ─── XSS Sanitization ───────────────────────────────────────────
export function sanitize(input: string): string {
  const d = document.createElement('div');
  d.textContent = input;
  return d.innerHTML;
}

// ─── Input Validation ───────────────────────────────────────────
export function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export function isValidPhone(phone: string): boolean {
  return /^\+?[\d\s\-()]{7,15}$/.test(phone);
}

export function isValidUrl(url: string): boolean {
  try { new URL(url); return true }
  catch { return false }
}

export function stripTags(input: string): string {
  return input.replace(/<[^>]*>/g, '');
}

// ─── Rate Limiting (client-side) ────────────────────────────────
const rateLimitStore: Record<string, { count: number; resetAt: number }> = {};

export function checkRateLimit(key: string, maxAttempts = 5, windowMs = 60000): boolean {
  const now = Date.now();
  const entry = rateLimitStore[key];
  if (!entry || now > entry.resetAt) {
    rateLimitStore[key] = { count: 1, resetAt: now + windowMs };
    return true;
  }
  if (entry.count >= maxAttempts) return false;
  entry.count++;
  return true;
}

export function getRateLimitRemaining(key: string, maxAttempts = 5): number {
  const entry = rateLimitStore[key];
  if (!entry || Date.now() > entry.resetAt) return maxAttempts;
  return Math.max(0, maxAttempts - entry.count);
}

// ─── CSRF Token ─────────────────────────────────────────────────
const CSRF_KEY = 'jb_csrf_token';

export function getCsrfToken(): string {
  let token = sessionStorage.getItem(CSRF_KEY);
  if (!token) {
    token = crypto.randomUUID?.() || Math.random().toString(36).slice(2) + Date.now().toString(36);
    sessionStorage.setItem(CSRF_KEY, token);
  }
  return token;
}

// ─── Data Export Sanitization ───────────────────────────────────
export function sanitizeForCSV(value: string): string {
  // Prevent CSV injection (formulas starting with =, +, -, @)
  const dangerous = ['=', '+', '-', '@', '\t', '\n'];
  if (dangerous.some(c => value.startsWith(c))) {
    return "'" + value;
  }
  return value.replace(/"/g, '""');
}

// ─── Secure Random ID ───────────────────────────────────────────
export function secureId(): string {
  return crypto.randomUUID?.() || Date.now().toString(36) + Math.random().toString(36).slice(2);
}
