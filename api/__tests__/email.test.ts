import { describe, expect, it } from 'vitest';
import { jobBridgeSender } from '../send-email.js';

describe('notification email sender branding', () => {
  it('forces the JobBridge display name for a configured sender', () => {
    expect(jobBridgeSender('Support <support@jobbridge.com.ng>')).toBe(
      'JobBridge <support@jobbridge.com.ng>',
    );
  });

  it('uses the safe fallback when the configured sender is invalid', () => {
    expect(jobBridgeSender('Support <invalid sender>')).toBe(
      'JobBridge <onboarding@resend.dev>',
    );
  });
});
