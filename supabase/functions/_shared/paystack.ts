// =========================================================================
// JobBridge — Paystack charge orchestration (shared by billing worker, webhook
// and subscription endpoints). NGN amounts are in Naira; Paystack uses kobo.
// =========================================================================

export const PAYSTACK_API_BASE = "https://api.paystack.co";

export interface PaystackChargeResult {
  ok: boolean;
  status?: string;
  reference?: string;
  providerReference?: string;
  amountPaid?: number; // in kobo
  currency?: string;
  failureCode?: string;
  gatewayResponse?: string;
  raw?: unknown;
}

function fmtError(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}

function serializeCharge(data: any): PaystackChargeResult {
  const source = data?.data || {};
  const status = String(source?.status ?? source?.gateway_response ?? "");
  const ok = data?.status === true && status.toLowerCase() === "success";

  return {
    ok,
    status,
    reference: source?.reference || data?.reference,
    providerReference: source?.transaction_reference || source?.reference,
    amountPaid: Number(source?.amount ?? source?.requested_amount ?? 0),
    currency: source?.currency || "NGN",
    failureCode: source?.failure_code || source?.failure_message || undefined,
    gatewayResponse: source?.gateway_response,
    raw: data,
  };
}

/**
 * Charge a previously-tokenized card (authorization) on behalf of a customer
 * via charge_authorization. Amount is in kobo (NGN x 100).
 */
export async function chargeAuthorization({
  secretKey,
  email,
  authorizationCode,
  amountKobo,
  reference,
  metadata,
}: {
  secretKey: string;
  email: string;
  authorizationCode: string;
  amountKobo: number;
  reference: string;
  metadata?: Record<string, unknown>;
}): Promise<PaystackChargeResult> {
  try {
    const res = await fetch(`${PAYSTACK_API_BASE}/transaction/charge_authorization`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${secretKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        email,
        amount: amountKobo,
        reference,
        authorization_code: authorizationCode,
        metadata,
      }),
    });
    const text = await res.text();
    const json = text ? JSON.parse(text) : {};
    // Paystack returns HTTP 200 with `status:false` on decline/insufficient funds.
    return serializeCharge(json);
  } catch (e) {
    return { ok: false, raw: e, failureCode: "network_error", gatewayResponse: fmtError(e) };
  }
}

/** Create (or fetch implied) a Paystack customer by email. */
export async function ensurePaystackCustomer(
  secretKey: string,
  email: string,
): Promise<{ customer: any; error?: string }> {
  try {
    const res = await fetch(`${PAYSTACK_API_BASE}/customer`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${secretKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ email }),
    });
    const json = await res.json();
    if (!json?.status) {
      return { customer: null, error: json?.message || "Failed to create customer" };
    }
    return { customer: json.data };
  } catch (e) {
    return { customer: null, error: fmtError(e) };
  }
}

export function amountToKobo(ngn: number): number {
  return Math.round(ngn * 100);
}
export function amountFromKobo(kobo: number): number {
  return Math.round(kobo / 100);
}