import { describe, expect, it } from 'vitest';
import { normalizeSeedUserId } from './payment-seeding';

describe('normalizeSeedUserId', () => {
  it('returns a UUID unchanged when one is already provided', () => {
    const value = '11111111-2222-4a22-8aaa-555555555555';
    expect(normalizeSeedUserId(value)).toBe(value);
  });

  it('generates a UUID for placeholder identifiers', () => {
    const value = normalizeSeedUserId('test-ai-001');
    expect(value).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
  });
});
