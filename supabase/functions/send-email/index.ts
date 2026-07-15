import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { getCorsHeaders, handleCors } from '../_shared/cors.ts';

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY') || '';
const BRAND_PRIMARY = '#1d4ed8';
const BRAND_SECONDARY = '#0f766e';
const BRAND_ACCENT = '#38bdf8';
const BRAND_BG = '#f4f7fb';
const BRAND_CARD = '#ffffff';
const BRAND_TEXT = '#0f172a';
const BRAND_MUTED = '#64748b';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const MAX_EMAIL_LENGTH = 320;
const MAX_NAME_LENGTH = 256;
const MAX_STR_LENGTH = 512;

const ipCounters = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT_WINDOW = 60_000;
const MAX_REQUESTS_PER_WINDOW = 10;

function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const entry = ipCounters.get(ip);
  if (!entry || now > entry.resetAt) {
    ipCounters.set(ip, { count: 1, resetAt: now + RATE_LIMIT_WINDOW });
    return true;
  }
  if (entry.count >= MAX_REQUESTS_PER_WINDOW) return false;
  entry.count++;
  return true;
}

function sanitize(val: string | undefined | null, maxLen: number): string {
  if (!val) return '';
  return val.replace(/[<>]/g, '').slice(0, maxLen).trim();
}

function resolveFromEmail(rawFrom: string | undefined | null): string {
  const candidate = (rawFrom || '').trim();
  if (!candidate) {
    return 'JobBridge <onboarding@resend.dev>';
  }

  const normalized = candidate.toLowerCase();
  if (normalized.includes('@jobbridge.com.ng') || normalized.includes('@www.jobbridge.com.ng')) {
    console.warn('[Send Email] Using safe resend.dev sender instead of unverified jobbridge.com.ng address');
    return 'JobBridge <onboarding@resend.dev>';
  }

  return candidate;
}

function wrapHtml(body: string, title = 'JobBridge'): string {
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"><title>${title}</title></head>
<body style="margin:0;padding:0;background:${BRAND_BG};font-family:Inter,Segoe UI,Roboto,Arial,sans-serif;color:${BRAND_TEXT};">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${BRAND_BG};padding:32px 16px;">
    <tr><td align="center">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:640px;background:${BRAND_CARD};border-radius:24px;overflow:hidden;border:1px solid #e2e8f0;box-shadow:0 18px 45px rgba(15,23,42,0.08);">
        <tr>
          <td style="background:linear-gradient(135deg,${BRAND_PRIMARY} 0%,${BRAND_SECONDARY} 100%);padding:32px 32px 24px;text-align:center;">
            <div style="display:inline-block;padding:10px 14px;border-radius:999px;background:rgba(255,255,255,0.16);margin-bottom:14px;font-size:12px;font-weight:700;letter-spacing:0.18em;color:#f8fafc;text-transform:uppercase;">JobBridge</div>
            <div style="font-size:30px;font-weight:800;color:#ffffff;letter-spacing:-0.4px;">Modern hiring, smarter careers</div>
            <div style="margin-top:10px;font-size:14px;color:#e2e8f0;line-height:1.6;">Professional tools for ambitious professionals and growing teams.</div>
          </td>
        </tr>
        <tr><td style="padding:36px 32px 24px;">${body}</td></tr>
        <tr>
          <td style="padding:0 32px 32px;">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:linear-gradient(90deg,rgba(29,78,216,0.06),rgba(15,118,110,0.06));border:1px solid #dbeafe;border-radius:16px;padding:16px;">
              <tr><td style="font-size:14px;color:${BRAND_MUTED};line-height:1.7;">Need help? Reach us at <a href="mailto:jobbridgesupport@gmail.com" style="color:${BRAND_PRIMARY};text-decoration:none;font-weight:600;">jobbridgesupport@gmail.com</a>.</td></tr>
            </table>
          </td>
        </tr>
        <tr>
          <td style="background:#f8fafc;padding:24px 32px;border-top:1px solid #e2e8f0;text-align:center;">
            <div style="font-size:13px;color:${BRAND_MUTED};line-height:1.7;">JobBridge Connect Africa<br>Democratizing opportunity across Africa.</div>
            <div style="margin-top:10px;font-size:12px;color:#94a3b8;">You received this email because of your activity on JobBridge. <a href="https://jobbridge.com.ng" style="color:${BRAND_PRIMARY};text-decoration:none;">Visit JobBridge</a></div>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body></html>`;
}

const T = (s: TemplateStringsArray, ...vals: string[]) =>
  s.reduce((acc, str, i) => acc + str + (vals[i] ? vals[i].replace(/[&"'<>]/g, c => ({ '&': '&amp;', '"': '&quot;', "'": '&#39;', '<': '&lt;', '>': '&gt;' })[c] || c) : ''), '');

function heroCard(title: string, body: string, ctaText?: string, ctaHref?: string): string {
  return `
    <div style="background:linear-gradient(135deg,rgba(29,78,216,0.08),rgba(15,118,110,0.08));border:1px solid #dbeafe;border-radius:18px;padding:24px 22px;margin-bottom:20px;">
      <div style="font-size:13px;font-weight:700;letter-spacing:0.16em;text-transform:uppercase;color:${BRAND_PRIMARY};margin-bottom:8px;">${title}</div>
      <div style="font-size:16px;line-height:1.7;color:${BRAND_TEXT};margin-bottom:14px;">${body}</div>
      ${ctaText && ctaHref ? `<a href="${ctaHref}" style="display:inline-block;background:linear-gradient(135deg,${BRAND_PRIMARY},${BRAND_SECONDARY});color:#ffffff;text-decoration:none;padding:12px 18px;border-radius:999px;font-weight:700;font-size:14px;">${ctaText}</a>` : ''}
    </div>`;
}

function escapeHtml(text: string): string {
  return text.replace(/[&"'<>]/g, c => ({ '&': '&amp;', '"': '&quot;', "'": '&#39;', '<': '&lt;', '>': '&gt;' })[c] || c);
}

function welcomeTemplate(name: string): string {
  const n = escapeHtml(name || 'there');
  return `<p style="font-size:16px;color:${BRAND_TEXT};line-height:1.7;margin:0 0 18px;">Hi <strong style="color:#111827;">${n}</strong>,</p>
<p style="font-size:16px;color:${BRAND_TEXT};line-height:1.7;margin:0 0 20px;">Welcome to <strong style="color:${BRAND_PRIMARY};">JobBridge</strong> — the modern professional network built for opportunity, growth, and smarter hiring across Africa.</p>
${heroCard('Start here', 'Complete your profile, unlock visibility, and start connecting with the right opportunities.', 'Complete Your Profile', 'https://jobbridge.com.ng/profile')}
<div style="margin:18px 0 20px;padding:18px 20px;border:1px solid #e2e8f0;border-radius:16px;background:#ffffff;">
  <div style="font-size:15px;font-weight:700;color:#111827;margin-bottom:12px;">What you can do next</div>
  <div style="font-size:14px;color:${BRAND_MUTED};line-height:1.7;">• Build a standout profile<br>• Discover curated jobs and opportunities<br>• Access AI-powered career tools<br>• Stay on top of applications and alerts</div>
</div>
<p style="font-size:14px;color:${BRAND_MUTED};line-height:1.7;margin:0;">Need help? Our AI assistant is available on every page, or reach out at <a href="mailto:jobbridgesupport@gmail.com" style="color:${BRAND_PRIMARY};text-decoration:none;font-weight:600;">jobbridgesupport@gmail.com</a>.</p>`;
}

function subscriptionTemplate(name: string): string {
  return T`<p style="font-size:16px;color:#374151;line-height:1.7;margin:0 0 20px;">Hi ${name ? `<strong style="color:#111827;">${name}</strong>,` : 'there,'}</p>
<p style="font-size:16px;color:#374151;line-height:1.7;margin:0 0 24px;">You've successfully subscribed to <strong style="color:#1d4ed8;">JobBridge Insights</strong>! You'll now receive the latest articles on careers, hiring, AI in recruitment, remote work, and the future of work — delivered straight to your inbox.</p>
<div style="background:#f0fdf4;border-radius:12px;padding:24px;margin-bottom:24px;border:1px solid #bbf7d0;">
<p style="font-size:14px;color:#166534;margin:0 0 8px;font-weight:600;">📬 What to expect</p>
<p style="font-size:14px;color:#166534;margin:0;line-height:1.6;">Weekly curated articles, expert tips, and exclusive insights to help you navigate your career journey. No spam — ever.</p>
</div>
<p style="font-size:15px;color:#374151;line-height:1.7;margin:0;">In the meantime, browse our <a href="https://jobbridge.com.ng/blog" style="color:#1d4ed8;text-decoration:underline;">latest articles</a> or explore <a href="https://jobbridge.com.ng/jobs" style="color:#1d4ed8;text-decoration:underline;">job opportunities</a> on JobBridge.</p>`;
}

function applicationTemplate(name: string, jobTitle: string, company: string): string {
  const jt = jobTitle || 'a position';
  const co = company || 'the company';
  return T`<p style="font-size:16px;color:#374151;line-height:1.7;margin:0 0 20px;">Hi <strong style="color:#111827;">${name}</strong>,</p>
<div style="background:#eff6ff;border-radius:12px;padding:24px;margin-bottom:24px;border:1px solid #bfdbfe;">
<p style="font-size:15px;color:#1e40af;margin:0 0 4px;font-weight:600;">✅ Application Submitted</p>
<p style="font-size:22px;font-weight:700;color:#111827;margin:8px 0;">${jt}</p>
<p style="font-size:15px;color:#4b5563;margin:0;">${co}</p>
</div>
<p style="font-size:16px;color:#374151;line-height:1.7;margin:0 0 20px;">Your application has been received successfully. The recruiter will review your profile and get back to you if there's a match.</p>
<div style="background:#f8fafc;border-radius:12px;padding:24px;margin-bottom:24px;">
<p style="font-size:14px;font-weight:600;color:#111827;margin:0 0 12px;">💡 Tips while you wait</p>
<p style="font-size:14px;color:#4b5563;margin:0;line-height:1.6;">• Keep your JobBridge profile up to date<br>• Set up job alerts for similar roles<br>• Continue exploring other opportunities on the platform</p>
</div>
<p style="font-size:15px;color:#374151;line-height:1.7;margin:0;">Good luck! 🎯</p>`;
}

function recruiterNotificationTemplate(jobTitle: string, applicantName: string): string {
  const jt = jobTitle || 'a position';
  const an = applicantName || 'a candidate';
  return T`<p style="font-size:16px;color:#374151;line-height:1.7;margin:0 0 20px;">Hi there,</p>
<div style="background:#fefce8;border-radius:12px;padding:24px;margin-bottom:24px;border:1px solid #fde68a;">
<p style="font-size:15px;color:#92400e;margin:0 0 4px;font-weight:600;">📩 New Application Received</p>
<p style="font-size:20px;font-weight:700;color:#111827;margin:8px 0;">${jt}</p>
<p style="font-size:15px;color:#4b5563;margin:0;">Applicant: <strong>${an}</strong></p>
</div>
<p style="font-size:16px;color:#374151;line-height:1.7;margin:0 0 20px;">A new candidate has applied to your job posting. Visit your dashboard to review their profile and application.</p>
<table width="100%" cellpadding="0" cellspacing="0"><tr><td align="center"><table cellpadding="0" cellspacing="0"><tr><td align="center" style="background:linear-gradient(135deg,#1d4ed8,#2563eb);border-radius:10px;padding:14px 36px;"><a href="https://jobbridge.com.ng/dashboard" target="_blank" style="color:#ffffff;font-size:16px;font-weight:700;text-decoration:none;display:inline-block;">View Applications</a></td></tr></table></td></tr></table>`;
}

function statusDisplay(status: string): string {
  switch (status) {
    case 'shortlisted':
      return '— You\'ve Been Shortlisted! ⭐';
    case 'rejected':
      return '— Update on Your Application';
    case 'hired':
      return '— Congratulations! You\'re Hired! 🎉';
    case 'reviewed':
      return '— Application Reviewed';
    default:
      return '— Status Updated';
  }
}

function applicationStatusTemplate(name: string, jobTitle: string, company: string, status: string): string {
  const jt = jobTitle || 'a position';
  const co = company || 'the company';
  const st = status || 'updated';

  let statusEmoji = '📋';
  let statusColor = '#3b82f6';
  let statusBg = '#eff6ff';
  let statusBorder = '#bfdbfe';
  let message = '';

  switch (st) {
    case 'shortlisted':
      statusEmoji = '⭐';
      statusColor = '#059669';
      statusBg = '#f0fdf4';
      statusBorder = '#bbf7d0';
      message = 'Congratulations! The recruiter has shortlisted you for this position. You may be contacted for an interview shortly.';
      break;
    case 'reviewed':
      statusEmoji = '👀';
      statusColor = '#2563eb';
      statusBg = '#eff6ff';
      statusBorder = '#bfdbfe';
      message = 'Your application has been reviewed by the recruiter. They will reach out if you are a match.';
      break;
    case 'rejected':
      statusEmoji = '💡';
      statusColor = '#dc2626';
      statusBg = '#fef2f2';
      statusBorder = '#fecaca';
      message = 'Unfortunately, the recruiter has decided to move forward with other candidates for this position. Don\'t be discouraged — keep applying to other opportunities on JobBridge!';
      break;
    case 'hired':
      statusEmoji = '🎉';
      statusColor = '#059669';
      statusBg = '#f0fdf4';
      statusBorder = '#bbf7d0';
      message = 'Congratulations! The recruiter has selected you for this position. You will be contacted with next steps to finalize your offer.';
      break;
    default:
      message = `Your application status has been updated to: ${st}`;
  }

  return T`<p style="font-size:16px;color:#374151;line-height:1.7;margin:0 0 20px;">Hi <strong style="color:#111827;">${name}</strong>,</p>
<div style="background:${statusBg};border-radius:12px;padding:24px;margin-bottom:24px;border:1px solid ${statusBorder};">
<p style="font-size:15px;color:${statusColor};margin:0 0 4px;font-weight:600;">${statusEmoji} Application ${st === 'hired' ? 'Successful' : st === 'rejected' ? 'Not Successful' : 'Status Updated'}</p>
<p style="font-size:20px;font-weight:700;color:#111827;margin:8px 0;">${jt}</p>
<p style="font-size:15px;color:#4b5563;margin:0;">${co}</p>
<div style="margin-top:16px;padding-top:16px;border-top:1px solid ${statusBorder};">
<p style="font-size:15px;color:#374151;line-height:1.7;margin:0;">${message}</p>
</div>
</div>
<table width="100%" cellpadding="0" cellspacing="0"><tr><td align="center"><table cellpadding="0" cellspacing="0"><tr><td align="center" style="background:linear-gradient(135deg,#1d4ed8,#2563eb);border-radius:10px;padding:14px 36px;"><a href="https://jobbridge.com.ng/my-jobs" target="_blank" style="color:#ffffff;font-size:16px;font-weight:700;text-decoration:none;display:inline-block;">View My Applications</a></td></tr></table></td></tr></table>
<p style="font-size:14px;color:#6b7280;line-height:1.6;margin:20px 0 0;">Keep your JobBridge profile updated and continue exploring other opportunities.</p>`;
}

function paymentInitiatedTemplate(name: string, plan: string, amount: string): string {
  const pn = plan || 'Plan';
  const am = amount || '0';
  return T`<p style="font-size:16px;color:#374151;line-height:1.7;margin:0 0 20px;">Hi <strong style="color:#111827;">${name}</strong>,</p>
<p style="font-size:16px;color:#374151;line-height:1.7;margin:0 0 24px;">You've initiated a payment for the following plan on JobBridge:</p>
<div style="background:#fffbeb;border-radius:12px;padding:24px;margin-bottom:24px;border:1px solid #fde68a;">
<p style="font-size:15px;color:#92400e;margin:0 0 4px;font-weight:600;">💳 Payment Initiated</p>
<p style="font-size:20px;font-weight:700;color:#111827;margin:8px 0;">${pn}</p>
<p style="font-size:15px;color:#4b5563;margin:0;">Amount: <strong>NGN ${am}</strong></p>
</div>
<p style="font-size:16px;color:#374151;line-height:1.7;margin:0 0 20px;">Please complete the checkout process to activate your plan. If you did not initiate this payment, please contact us immediately at <a href="mailto:jobbridgesupport@gmail.com" style="color:#1d4ed8;text-decoration:underline;">jobbridgesupport@gmail.com</a>.</p>
<p style="font-size:14px;color:#6b7280;line-height:1.6;margin:0;">This is an automated notification. No action is needed if you are already completing the payment.</p>`;
}

function signInTemplate(name: string): string {
  const n = escapeHtml(name || 'there');
  return `<p style="font-size:16px;color:#374151;line-height:1.7;margin:0 0 20px;">Hi <strong style="color:#111827;">${n}</strong>,</p>
<p style="font-size:16px;color:#374151;line-height:1.7;margin:0 0 24px;">We detected a successful sign-in to your JobBridge account. If this was you, no further action is required.</p>
${heroCard('Security update', 'If you do not recognize this activity, change your password right away and contact support so we can secure your account.', 'Secure My Account', 'https://jobbridge.com.ng/profile')}
<p style="font-size:14px;color:#6b7280;line-height:1.6;margin:0;">This email confirms a recent sign-in to JobBridge. Keep your password safe and never share your login details.</p>`;
}

function signOutTemplate(name: string): string {
  const n = escapeHtml(name || 'there');
  return `<p style="font-size:16px;color:#374151;line-height:1.7;margin:0 0 20px;">Hi <strong style="color:#111827;">${n}</strong>,</p>
<p style="font-size:16px;color:#374151;line-height:1.7;margin:0 0 24px;">You have successfully signed out of JobBridge. We hope to see you again soon.</p>
${heroCard('Signed out', 'If you were not expecting this sign-out, your account may have been accessed elsewhere. Review your account security and sign in again if needed.', 'Review Security', 'https://jobbridge.com.ng/profile')}
<p style="font-size:14px;color:#6b7280;line-height:1.6;margin:0;">Thank you for using JobBridge. We’re here to help whenever you need support.</p>`;
}

function profileReminderTemplate(name: string): string {
  const n = escapeHtml(name || 'there');
  return `<p style="font-size:16px;color:#374151;line-height:1.7;margin:0 0 20px;">Hi <strong style="color:#111827;">${n}</strong>,</p>
<p style="font-size:16px;color:#374151;line-height:1.7;margin:0 0 24px;">Your JobBridge profile is almost ready. Complete it now to increase your visibility to employers, recruiters, and clients.</p>
${heroCard('Finish your profile', 'A complete profile helps you get discovered faster and increases your chances of interview requests. Add your experience, skills, location, and professional headline to stand out.', 'Complete Your Profile', 'https://jobbridge.com.ng/profile')}
<div style="background:#f8fafc;border-radius:12px;padding:24px;margin-top:20px;border:1px solid #e2e8f0;">
  <p style="font-size:14px;color:#374151;line-height:1.7;margin:0 0 12px;font-weight:700;">Why finish your profile?</p>
  <ul style="font-size:14px;color:#4b5563;line-height:1.8;margin:0;padding-left:18px;">
    <li>• Get matched with better job recommendations</li>
    <li>• Appear in recruiter searches</li>
    <li>• Make your application stand out</li>
    <li>• Unlock career tools and coaching invites</li>
  </ul>
</div>
<p style="font-size:14px;color:#6b7280;line-height:1.6;margin:24px 0 0;">Need help? Reach out at <a href="mailto:jobbridgesupport@gmail.com" style="color:${BRAND_PRIMARY};text-decoration:underline;">jobbridgesupport@gmail.com</a>.</p>`;
}

function newRecruiterTemplate(name: string, recruiterEmail: string): string {
  return T`<p style="font-size:16px;color:#374151;line-height:1.7;margin:0 0 20px;">Hi Admin,</p>
<div style="background:#fefce8;border-radius:12px;padding:24px;margin-bottom:24px;border:1px solid #fde68a;">
<p style="font-size:15px;color:#92400e;margin:0 0 4px;font-weight:600;">👤 New Recruiter Registration</p>
<p style="font-size:18px;font-weight:700;color:#111827;margin:8px 0;">${name}</p>
<p style="font-size:15px;color:#4b5563;margin:0;">Email: <strong>${recruiterEmail}</strong></p>
</div>
<p style="font-size:16px;color:#374151;line-height:1.7;margin:0 0 20px;">A new recruiter has just signed up on JobBridge. You may want to review their account and reach out to assist them with getting started.</p>
<table width="100%" cellpadding="0" cellspacing="0"><tr><td align="center"><table cellpadding="0" cellspacing="0"><tr><td align="center" style="background:linear-gradient(135deg,#1d4ed8,#2563eb);border-radius:10px;padding:14px 36px;"><a href="https://jobbridge.com.ng/admin" target="_blank" style="color:#ffffff;font-size:16px;font-weight:700;text-decoration:none;display:inline-block;">View Admin Dashboard</a></td></tr></table></td></tr></table>`;
}

function jobPostedTemplate(name: string, jobTitle: string, company: string): string {
  const jt = jobTitle || 'a position';
  const co = company || 'your company';
  return T`<p style="font-size:16px;color:#374151;line-height:1.7;margin:0 0 20px;">Hi <strong style="color:#111827;">${name}</strong>,</p>
<div style="background:#f0fdf4;border-radius:12px;padding:24px;margin-bottom:24px;border:1px solid #bbf7d0;">
<p style="font-size:15px;color:#166534;margin:0 0 4px;font-weight:600;">✅ Job Posted Successfully</p>
<p style="font-size:20px;font-weight:700;color:#111827;margin:8px 0;">${jt}</p>
<p style="font-size:15px;color:#4b5563;margin:0;">${co}</p>
</div>
<p style="font-size:16px;color:#374151;line-height:1.7;margin:0 0 20px;">Your job has been published on JobBridge and is now visible to thousands of job seekers.</p>
<div style="background:#f8fafc;border-radius:12px;padding:24px;margin-bottom:24px;">
<p style="font-size:14px;font-weight:600;color:#111827;margin:0 0 12px;">📊 What happens next</p>
<p style="font-size:14px;color:#4b5563;margin:0;line-height:1.6;">• Candidates will start applying to your position<br>• You'll receive email notifications for new applications<br>• Review and shortlist candidates from your dashboard<br>• Use AI-powered candidate ranking to find the best match</p>
</div>
<table width="100%" cellpadding="0" cellspacing="0"><tr><td align="center"><table cellpadding="0" cellspacing="0"><tr><td align="center" style="background:linear-gradient(135deg,#1d4ed8,#2563eb);border-radius:10px;padding:14px 36px;"><a href="https://jobbridge.com.ng/recruiter" target="_blank" style="color:#ffffff;font-size:16px;font-weight:700;text-decoration:none;display:inline-block;">Manage Job Postings</a></td></tr></table></td></tr></table>
<p style="font-size:14px;color:#6b7280;line-height:1.6;margin:20px 0 0;">Good luck finding the perfect candidate! 🎯</p>`;
}

serve(async (req) => {
  const origin = req.headers.get('origin');
  const corsHeaders = getCorsHeaders(origin);

  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  try {
    const { type, email, name, jobTitle, company, plan, amount, applicantName, summary, status, from } = await req.json();

    if (!email || !type) {
      return new Response(JSON.stringify({ error: 'Email and type are required' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const cleanEmail = sanitize(email, MAX_EMAIL_LENGTH).toLowerCase();
    if (!EMAIL_RE.test(cleanEmail)) {
      return new Response(JSON.stringify({ error: 'Invalid email format' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const VALID_TYPES = ['welcome', 'subscription', 'application', 'recruiter_notification', 'payment', 'payment_initiated', 'application_status', 'new_recruiter', 'job_posted', 'daily_digest', 'sign_in', 'sign_out', 'profile_reminder'];
    if (!VALID_TYPES.includes(type)) {
      return new Response(JSON.stringify({ error: `Unknown email type: ${type}` }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    let subject = '';
    let htmlBody = '';

    switch (type) {
      case 'welcome':
        subject = 'Welcome to JobBridge! 🚀';
        htmlBody = welcomeTemplate(sanitize(name, MAX_NAME_LENGTH));
        break;
      case 'subscription':
        subject = 'You\'re subscribed to JobBridge Insights 📬';
        htmlBody = subscriptionTemplate(sanitize(name, MAX_NAME_LENGTH));
        break;
      case 'application':
        subject = `Application Received: ${sanitize(jobTitle, MAX_STR_LENGTH) || 'Job'} at ${sanitize(company, MAX_STR_LENGTH) || 'Company'} ✅`;
        htmlBody = applicationTemplate(sanitize(name, MAX_NAME_LENGTH), sanitize(jobTitle, MAX_STR_LENGTH), sanitize(company, MAX_STR_LENGTH));
        break;
      case 'recruiter_notification':
        subject = `New Application for ${sanitize(jobTitle, MAX_STR_LENGTH) || 'your job'} 📩`;
        htmlBody = recruiterNotificationTemplate(sanitize(jobTitle, MAX_STR_LENGTH), sanitize(applicantName, MAX_NAME_LENGTH));
        break;
      case 'payment':
        subject = `Payment Confirmed — ${sanitize(plan, MAX_STR_LENGTH) || 'Plan'} Activated 🎉`;
        htmlBody = paymentTemplate(sanitize(name, MAX_NAME_LENGTH), sanitize(plan, MAX_STR_LENGTH), sanitize(amount, MAX_STR_LENGTH));
        break;
      case 'payment_initiated':
        subject = 'Payment Initiated — JobBridge';
        htmlBody = paymentInitiatedTemplate(sanitize(name, MAX_NAME_LENGTH), sanitize(plan, MAX_STR_LENGTH), sanitize(amount, MAX_STR_LENGTH));
        break;
      case 'sign_in':
        subject = 'New sign-in to your JobBridge account 🔐';
        htmlBody = signInTemplate(sanitize(name, MAX_NAME_LENGTH));
        break;
      case 'sign_out':
        subject = 'You signed out of JobBridge 👋';
        htmlBody = signOutTemplate(sanitize(name, MAX_NAME_LENGTH));
        break;
      case 'profile_reminder':
        subject = 'Finish your JobBridge profile to get discovered 📌';
        htmlBody = profileReminderTemplate(sanitize(name, MAX_NAME_LENGTH));
        break;
      case 'application_status':
        subject = `Application Update: ${sanitize(jobTitle, MAX_STR_LENGTH) || 'Your Application'} ${statusDisplay(sanitize(status, MAX_STR_LENGTH))}`;
        htmlBody = applicationStatusTemplate(sanitize(name, MAX_NAME_LENGTH), sanitize(jobTitle, MAX_STR_LENGTH), sanitize(company, MAX_STR_LENGTH), sanitize(status, MAX_STR_LENGTH));
        break;
      case 'new_recruiter':
        subject = `New Recruiter Signup: ${sanitize(name, MAX_NAME_LENGTH)}`;
        htmlBody = newRecruiterTemplate(sanitize(name, MAX_NAME_LENGTH), sanitize(email, MAX_EMAIL_LENGTH));
        break;
      case 'job_posted':
        subject = `Job Posted Successfully: ${sanitize(jobTitle, MAX_STR_LENGTH) || 'Your Job'} 🎉`;
        htmlBody = jobPostedTemplate(sanitize(name, MAX_NAME_LENGTH), sanitize(jobTitle, MAX_STR_LENGTH), sanitize(company, MAX_STR_LENGTH));
        break;
      case 'daily_digest':
        subject = 'Your JobBridge Daily Update';
        htmlBody = dailyDigestTemplate(sanitize(name, MAX_NAME_LENGTH), sanitize(summary, MAX_STR_LENGTH));
        break;
    }

    if (!RESEND_API_KEY) {
      console.error('[Send Email] Missing RESEND_API_KEY');
      return new Response(JSON.stringify({ error: 'Missing RESEND_API_KEY' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const senderEmail = resolveFromEmail(from);

    async function postWithRetry(url: string, body: any, attempts = 3) {
      let lastErr: any = null;
      for (let i = 0; i < attempts; i++) {
        try {
          const r = await fetch(url, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
          });
          if (!r.ok) {
            const t = await r.text();
            lastErr = new Error(`status=${r.status} body=${t}`);
            // continue to retry
          } else {
            return r;
          }
        } catch (e) {
          lastErr = e;
        }
        // simple backoff
        await new Promise((res) => setTimeout(res, 500 * (i + 1)));
      }
      throw lastErr;
    }

    const res = await postWithRetry('https://api.resend.com/emails', { from: senderEmail, to: cleanEmail, subject, html: wrapHtml(htmlBody, subject) });

    if (!res.ok) {
      const errText = await res.text();
      console.error(`Resend error (${type}) status=${res.status}:`, errText);
      return new Response(JSON.stringify({ error: 'Failed to send email', details: errText }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const data = await res.json();
    console.log(`${type} email sent to ${cleanEmail}:`, data.id);
    return new Response(JSON.stringify({ success: true }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (err) {
    console.error('Function error:', err);
    return new Response(JSON.stringify({ error: 'Internal error' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
