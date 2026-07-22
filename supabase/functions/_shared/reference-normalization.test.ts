import { describe, expect, it } from 'vitest';
import { buildReferenceCandidates, isChargeNotFoundError } from './reference-normalization';

describe('buildReferenceCandidates', () => {
  it('extracts the primary reference from a plain object payload', () => {
    expect(buildReferenceCandidates({ reference: '  JB-KORA-123  ' })).toEqual(['JB-KORA-123']);
  });

  it('strips common reference prefixes and supports fallback values', () => {
    expect(buildReferenceCandidates({ reference: 'reference=JB-KORA-456', fallback_reference: 'fallback=JB-KORA-789' })).toEqual([
      'JB-KORA-456',
      'JB-KORA-789',
    ]);
  });

  it('splits comma-delimited candidate references', () => {
    expect(buildReferenceCandidates({ reference: 'JB-KORA-1, JB-KORA-2' })).toEqual(['JB-KORA-1', 'JB-KORA-2']);
  });
});

describe('isChargeNotFoundError', () => {
  it('detects Korapay charge-not-found responses', () => {
    expect(isChargeNotFoundError({ status: false, code: 'AA026', message: 'Charge not found' })).toBe(true);
  });

  it('returns false for unrelated errors', () => {
    expect(isChargeNotFoundError({ status: false, code: 'AA001', message: 'Invalid request' })).toBe(false);
  });
});
