import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { getCorsHeaders, handleCors } from '../_shared/cors.ts';

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY') || '';
const FROM_EMAIL = 'JobBridge <onboarding@resend.dev>';

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

function wrapHtml(body: string): string {
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"><title>JobBridge</title></head>
<body style="margin:0;padding:0;background-color:#f4f6f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f6f9;"><tr><td align="center" style="padding:40px 16px;">
<table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;">
<tr><td style="background:linear-gradient(135deg,#1e3a5f 0%,#1d4ed8 100%);border-radius:16px 16px 0 0;padding:40px 40px 32px;text-align:center;">
<img src="https://ppramomuckkjzssrfghi.supabase.co/storage/v1/object/public/assets/jobbridge-logo-white.png" alt="JobBridge" width="180" style="max-width:180px;height:auto;margin-bottom:8px;" onerror="this.style.display='none'">
<div style="font-size:28px;font-weight:800;color:#ffffff;letter-spacing:-0.5px;margin-top:8px;">JobBridge</div>
<div style="width:60px;height:3px;background:#3b82f6;border-radius:2px;margin:16px auto 0;"></div>
</td></tr>
<tr><td style="background:#ffffff;padding:40px;border-left:1px solid #e5e7eb;border-right:1px solid #e5e7eb;">${body}</td></tr>
<tr><td style="background:#f8fafc;border-radius:0 0 16px 16px;border:1px solid #e5e7eb;border-top:none;padding:24px 40px;text-align:center;">
<p style="font-size:13px;color:#9ca3af;line-height:1.6;margin:0;">JobBridge Connect Africa<br>Democratizing opportunity across Africa.</p>
<p style="font-size:12px;color:#d1d5db;margin:12px 0 0;">You received this email because of your activity on JobBridge.<br><a href="https://jobbridge.com.ng" style="color:#6b7280;text-decoration:underline;">Visit JobBridge</a></p>
</td></tr>
</table></td></tr></table></body></html>`;
}

const T = (s: TemplateStringsArray, ...vals: string[]) =>
  s.reduce((acc, str, i) => acc + str + (vals[i] ? vals[i].replace(/[&"'<>]/g, c => ({ '&': '&amp;', '"': '&quot;', "'": '&#39;', '<': '&lt;', '>': '&gt;' })[c] || c) : ''), '');

function welcomeTemplate(name: string): string {
  const n = name || 'there';
  return T`<p style="font-size:16px;color:#374151;line-height:1.7;margin:0 0 20px;">Hi <strong style="color:#111827;">${n}</strong>,</p>
<p style="font-size:16px;color:#374151;line-height:1.7;margin:0 0 24px;">Welcome to <strong style="color:#1d4ed8;">JobBridge</strong> — Nigeria's #1 professional network. We're excited to have you on board!</p>
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f8fafc;border-radius:12px;padding:24px;margin-bottom:28px;"><tr><td>
<div style="font-size:15px;font-weight:700;color:#111827;margin-bottom:16px;">🚀 Get started in 3 steps</div>
<table cellpadding="0" cellspacing="0" style="width:100%;">
<tr><td style="padding-bottom:14px;vertical-align:top;width:32px;"><table cellpadding="0" cellspacing="0" style="width:28px;height:28px;background:#1d4ed8;border-radius:50%;"><tr><td align="center" style="font-size:14px;font-weight:700;color:#ffffff;">1</td></tr></table></td><td style="padding-bottom:14px;font-size:14px;color:#4b5563;line-height:1.6;"><strong style="color:#111827;">Complete your profile</strong> — Add your experience, skills, and preferences so recruiters can find you.</td></tr>
<tr><td style="padding-bottom:14px;vertical-align:top;"><table cellpadding="0" cellspacing="0" style="width:28px;height:28px;background:#1d4ed8;border-radius:50%;"><tr><td align="center" style="font-size:14px;font-weight:700;color:#ffffff;">2</td></tr></table></td><td style="padding-bottom:14px;font-size:14px;color:#4b5563;line-height:1.6;"><strong style="color:#111827;">Browse jobs</strong> — Explore thousands of verified opportunities from top employers.</td></tr>
<tr><td style="vertical-align:top;"><table cellpadding="0" cellspacing="0" style="width:28px;height:28px;background:#1d4ed8;border-radius:50%;"><tr><td align="center" style="font-size:14px;font-weight:700;color:#ffffff;">3</td></tr></table></td><td style="font-size:14px;color:#4b5563;line-height:1.6;"><strong style="color:#111827;">Build your AI resume</strong> — Use our AI-powered tools to create a standout CV.</td></tr>
</table></td></tr></table>
<table width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding-bottom:28px;"><table cellpadding="0" cellspacing="0"><tr><td align="center" style="background:linear-gradient(135deg,#1d4ed8,#2563eb);border-radius:10px;padding:14px 36px;"><a href="https://jobbridge.com.ng/profile" target="_blank" style="color:#ffffff;font-size:16px;font-weight:700;text-decoration:none;display:inline-block;letter-spacing:0.3px;">Complete Your Profile</a></td></tr></table></td></tr></table>
<div style="height:1px;background:#e5e7eb;margin-bottom:24px;"></div>
<p style="font-size:15px;font-weight:700;color:#111827;margin:0 0 14px;">What you can do on JobBridge</p>
${['Apply to jobs with one click', 'Get AI-powered resume and cover letter tools', 'Receive personalized job recommendations', 'Chat with our AI assistant for instant help'].map(f => `<table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:4px;"><tr><td style="padding:6px 0;font-size:14px;color:#4b5563;vertical-align:top;width:24px;">✓</td><td style="padding:6px 0;font-size:14px;color:#4b5563;line-height:1.5;">${f}</td></tr></table>`).join('')}
<p style="font-size:15px;color:#374151;line-height:1.7;margin:20px 0 0;">Need help? Our AI assistant is available on every page, or reach out at <a href="mailto:jobbridgesupport@gmail.com" style="color:#1d4ed8;text-decoration:underline;">jobbridgesupport@gmail.com</a>.</p>`;
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
    const { type, email, name, jobTitle, company, plan, amount, applicantName, summary, status } = await req.json();

    if (!email || !type) {
      return new Response(JSON.stringify({ error: 'Email and type are required' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const cleanEmail = sanitize(email, MAX_EMAIL_LENGTH).toLowerCase();
    if (!EMAIL_RE.test(cleanEmail)) {
      return new Response(JSON.stringify({ error: 'Invalid email format' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const VALID_TYPES = ['welcome', 'subscription', 'application', 'recruiter_notification', 'payment', 'payment_initiated', 'application_status', 'new_recruiter', 'job_posted', 'daily_digest'];
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

    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: FROM_EMAIL, to: cleanEmail, subject, html: wrapHtml(htmlBody) }),
    });

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
