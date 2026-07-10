import { describe, expect, it } from 'vitest';
import { getCorsHeaders } from '../../../supabase/functions/_shared/cors';

describe('getCorsHeaders', () => {
  it('defaults to the canonical www origin when no origin is provided', () => {
    const headers = getCorsHeaders(null);
    expect(headers['Access-Control-Allow-Origin']).toBe('https://www.jobbridge.com.ng');
  });

  it('echoes an allowed www origin back to the browser', () => {
    const headers = getCorsHeaders('https://www.jobbridge.com.ng');
    expect(headers['Access-Control-Allow-Origin']).toBe('https://www.jobbridge.com.ng');
  });
});
