export function normalizeReferenceValue(value: unknown): string {
  if (typeof value !== 'string') return '';
  return value.trim().replace(/^reference\s*[:=]\s*/i, '').replace(/^fallback\s*[:=]\s*/i, '').replace(/^original\s*[:=]\s*/i, '').trim();
}

export function buildReferenceCandidates(input: Record<string, unknown>): string[] {
  const rawValues = [
    input.reference,
    input.fallback_reference,
    input.original_reference,
    input.ref,
    input.fallbackRef,
    input.originalRef,
  ];

  const candidates = rawValues.flatMap((value) => {
    const normalized = normalizeReferenceValue(value);
    if (!normalized) return [];

    return normalized
      .split(/[,|\s]+/)
      .map((item) => item.trim())
      .filter(Boolean)
      .filter((item) => !item.startsWith('http'));
  });

  return Array.from(new Set(candidates));
}

export function isChargeNotFoundError(detail: unknown): boolean {
  if (!detail || typeof detail !== 'object') return false;
  const record = detail as Record<string, unknown>;
  const code = String(record.code || '').toUpperCase();
  const message = String(record.message || '').toLowerCase();
  return code === 'AA026' || message.includes('charge not found');
}
