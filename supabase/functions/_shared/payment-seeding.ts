export function normalizeSeedUserId(value: unknown): string {
  const raw = String(value ?? '').trim();
    if (!raw) return '';
    const uuidRe = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    if (uuidRe.test(raw)) return raw;

    // Prefer native UUID when available (Node/Deno environments)
    try {
      // @ts-ignore
      if (typeof crypto !== 'undefined' && typeof (crypto as any).randomUUID === 'function') {
        // @ts-ignore
        return (crypto as any).randomUUID();
      }
    } catch (_e) {
      // fall through to deterministic fallback
    }

    const fallback = raw.replace(/[^a-z0-9]+/gi, '-').replace(/^-+|-+$/g, '').toLowerCase();
    if (!fallback) return '';

    // Deterministic 16-byte hash fallback -> UUIDv4 format
    let h = 2166136261 >>> 0;
    for (let i = 0; i < fallback.length; i++) {
      h = Math.imul(h ^ fallback.charCodeAt(i), 16777619) >>> 0;
    }
    const bytes: number[] = new Array(16).fill(0).map((_, i) => (h >>> ((i % 4) * 8)) & 0xff);
    bytes[6] = (bytes[6] & 0x0f) | 0x40; // set version 4
    bytes[8] = (bytes[8] & 0x3f) | 0x80; // set variant
    const hex = bytes.map((b) => b.toString(16).padStart(2, '0')).join('');
    return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20, 32)}`;
}

export function shouldAutoSeedPayment(payload: Record<string, unknown>): boolean {
  const event = String((payload as Record<string, unknown>).event || '').toLowerCase();
  const data = (payload as Record<string, unknown>).data as Record<string, unknown> | undefined;
  if (event !== 'charge.success') return false;

  const simulateVerification = Boolean(
    data?.simulate_verification || data?.test_mode || data?.metadata?.test_mode,
  );
  return simulateVerification;
}

export function buildSeedPaymentPayload(payload: Record<string, unknown>) {
  const data = (payload as Record<string, unknown>).data as Record<string, unknown> | undefined;
  const metadata = ((data?.metadata as Record<string, unknown>) || {}) as Record<string, unknown>;
  const userId = normalizeSeedUserId(metadata.user_id || data?.user_id || '');
  const plan = String(metadata.plan || data?.plan || 'ai_monthly');
  const reference = String(
    data?.reference || data?.payment_reference || data?.transaction_reference || 'JB-TEST-SEED',
  );
  const amount = Number(data?.amount_paid ?? data?.amount_expected ?? data?.amount ?? 1500);
  const currency = String(data?.currency || 'NGN');

  if (!userId || !reference) return null;

  return {
    user_id: userId,
    plan,
    status: 'pending',
    amount: Number.isFinite(amount) ? amount : 1500,
    currency,
    reference,
    metadata: {
      ...metadata,
      source: metadata.source || 'simulated_webhook_seed',
      seeded_by: 'kora-webhook',
    },
  };
}

export function buildSeedProfilePayload(payload: Record<string, unknown>) {
  const data = (payload as Record<string, unknown>).data as Record<string, unknown> | undefined;
  const metadata = ((data?.metadata as Record<string, unknown>) || {}) as Record<string, unknown>;
  const userId = normalizeSeedUserId(metadata.user_id || data?.user_id || '');
  const email = String(metadata.email || `${userId}@jobbridge.test`);
  const fullName = String(metadata.full_name || metadata.name || 'Simulated User');
  if (!userId) return null;

  return {
    id: userId,
    email,
    full_name: fullName,
    role: 'job_seeker',
    credits: 0,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
}
