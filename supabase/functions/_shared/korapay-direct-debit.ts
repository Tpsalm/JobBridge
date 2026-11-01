const KORA_API_BASE = "https://api.korapay.com/merchant/api/v1";

export class KoraDirectDebitError extends Error {
  constructor(
    message: string,
    public readonly httpStatus: number | null,
  ) {
    super(message);
    this.name = "KoraDirectDebitError";
  }
}

type KoraResponse<T> = {
  status: boolean;
  message?: string;
  data?: T;
};

export type KoraAuthorization = {
  reference: string;
  authorization_code: string;
  status: string;
  amount: number;
  currency: string;
  debit_type: string;
  description?: string;
  customer_bank_name?: string;
  customer_account_number?: string;
  customer_account_name?: string;
};

export type KoraDebitResult = {
  transaction_reference?: string;
  authorization_code?: string;
  status?: string;
  amount?: number;
  currency?: string;
  message?: string;
};

async function koraRequest<T>(
  secretKey: string,
  path: string,
  init: RequestInit,
): Promise<KoraResponse<T>> {
  let response: Response;
  try {
    response = await fetch(`${KORA_API_BASE}${path}`, {
      ...init,
      headers: {
        Authorization: `Bearer ${secretKey}`,
        "Content-Type": "application/json",
        ...init.headers,
      },
    });
  } catch {
    throw new KoraDirectDebitError("KoraPay request could not be confirmed.", null);
  }

  const body = await response.json().catch(() => null);
  if (!response.ok || !body?.status) {
    throw new KoraDirectDebitError(
      body?.message || `KoraPay request failed (${response.status})`,
      response.status,
    );
  }
  return body as KoraResponse<T>;
}

export function dateOnly(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export async function createVariableAuthorization(
  secretKey: string,
  input: {
    amount: number;
    name: string;
    email: string;
    phone: string;
    accountNumber: string;
    bankCode: string;
    startDate: string;
    endDate: string;
  },
): Promise<KoraAuthorization> {
  const result = await koraRequest<KoraAuthorization>(
    secretKey,
    "/direct-debit/initiate",
    {
      method: "POST",
      body: JSON.stringify({
        debit_type: "variable",
        amount: input.amount,
        currency: "NGN",
        description: "JobBridge service-provider monthly subscription",
        start_date: input.startDate,
        end_date: input.endDate,
        customer: {
          name: input.name,
          email: input.email,
          phone_number: input.phone,
          account_number: input.accountNumber,
          bank_code: input.bankCode,
        },
      }),
    },
  );

  if (!result.data?.authorization_code || !result.data.reference) {
    throw new Error("KoraPay did not return a Direct Debit authorization reference.");
  }
  return result.data;
}

export async function retrieveAuthorization(
  secretKey: string,
  reference: string,
): Promise<KoraAuthorization> {
  const result = await koraRequest<KoraAuthorization>(
    secretKey,
    `/direct-debit/authorizations/${encodeURIComponent(reference)}`,
    { method: "GET" },
  );
  if (!result.data) throw new Error("KoraPay returned no authorization details.");
  return result.data;
}

export async function debitAuthorization(
  secretKey: string,
  authorizationCode: string,
  input: { amount: number; reference: string; narration: string },
): Promise<KoraDebitResult> {
  const result = await koraRequest<KoraDebitResult>(
    secretKey,
    `/direct-debit/authorizations/${encodeURIComponent(authorizationCode)}/debits`,
    {
      method: "POST",
      body: JSON.stringify({
        reference: input.reference,
        amount: input.amount,
        currency: "NGN",
        narration: input.narration,
      }),
    },
  );
  if (!result.data) throw new Error("KoraPay returned no Direct Debit result.");
  return result.data;
}

export async function verifyCharge(
  secretKey: string,
  reference: string,
): Promise<{
  reference?: string;
  payment_reference?: string;
  transaction_reference?: string;
  status?: string;
  amount?: number | string;
  amount_paid?: number | string;
  currency?: string;
  token?: string;
  card_token?: string;
  card?: { token?: string; last_four?: string };
}> {
  const result = await koraRequest<{
    reference?: string;
    payment_reference?: string;
    transaction_reference?: string;
    status?: string;
    amount?: number | string;
    amount_paid?: number | string;
    currency?: string;
    token?: string;
    card_token?: string;
    card?: { token?: string; last_four?: string };
  }>(secretKey, `/charges/${encodeURIComponent(reference)}`, { method: "GET" });
  if (!result.data) throw new Error("KoraPay returned no charge details.");
  return result.data;
}

export async function hmacIdentity(secret: string, value: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(value),
  );
  return Array.from(new Uint8Array(signature), (byte) =>
    byte.toString(16).padStart(2, "0")
  ).join("");
}
