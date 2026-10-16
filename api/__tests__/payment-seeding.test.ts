import { describe, expect, it } from 'vitest';
import { isLocalTestOverrideEnabled } from '../../supabase/functions/_shared/payment-seeding.ts';

describe('payment test overrides', () => {
  it('allows an explicit test override only for local Supabase', () => {
    expect(isLocalTestOverrideEnabled('test', 'true', 'http://127.0.0.1:54321')).toBe(true);
    expect(isLocalTestOverrideEnabled('test', 'true', 'http://kong:8000')).toBe(true);
  });

  it('disables overrides for hosted Supabase even if test flags are set', () => {
    expect(isLocalTestOverrideEnabled('test', 'true', 'https://project.supabase.co')).toBe(false);
  });

  it('requires explicit test mode and a true flag', () => {
    expect(isLocalTestOverrideEnabled('production', 'true', 'http://localhost:54321')).toBe(false);
    expect(isLocalTestOverrideEnabled('test', 'false', 'http://localhost:54321')).toBe(false);
    expect(isLocalTestOverrideEnabled(undefined, 'true', 'http://localhost:54321')).toBe(false);
  });
});
