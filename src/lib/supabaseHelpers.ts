export function getSupabaseFunctionsUrl(): string | null {
  const defaultSupabaseUrl = "https://gtstcstmezfiepzlvndt.supabase.co";
  const functionsUrl = (import.meta.env.VITE_SUPABASE_FUNCTIONS_URL || `${defaultSupabaseUrl}/functions/v1`).trim();
  const supabaseUrl = (import.meta.env.VITE_SUPABASE_URL || defaultSupabaseUrl).trim();
  const candidates = [functionsUrl, supabaseUrl ? `${supabaseUrl.replace(/\/+$/, '')}/functions/v1` : undefined];

  for (const candidate of candidates) {
    if (!candidate) continue;

    try {
      const url = new URL(candidate);
      if (url.protocol !== 'https:') continue;
      if (!url.hostname.endsWith('.supabase.co')) continue;
      if (url.hostname === 'supabase.co') continue;
      return candidate.replace(/\/+$/, '');
    } catch {
      continue;
    }
  }

  return null;
}

export async function getFunctionInvokeErrorMessage(
  error: unknown,
  fallback: string,
): Promise<string> {
  if (error && typeof error === "object" && "context" in error) {
    const context = error.context;
    if (context instanceof Response) {
      const body = await context.clone().json().catch(() => null);
      if (
        body &&
        typeof body === "object" &&
        "error" in body &&
        typeof body.error === "string"
      ) {
        return body.error;
      }
      return `The server rejected the request (HTTP ${context.status}). ${fallback}`;
    }
  }

  if (error instanceof Error && error.message) return error.message;
  return fallback;
}
