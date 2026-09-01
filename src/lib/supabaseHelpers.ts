export function getSupabaseFunctionsUrl(): string | null {
  const defaultSupabaseUrl = "https://ppramomuckkjzssrfghi.supabase.co";
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
