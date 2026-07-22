import type { VercelRequest, VercelResponse } from '@vercel/node';

export default function handler(req: VercelRequest, res: VercelResponse) {
  const configured = process.env.RESEND_FROM || '';
  const expected = 'support@jobbridge.com.ng';
  return res.status(200).json({
    matchesExpected: configured === expected,
    hasValue: configured.length > 0,
    expected,
  });
}
