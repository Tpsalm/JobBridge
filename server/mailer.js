const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const nodemailer = require('nodemailer');

const SMTP_HOST = process.env.SMTP_HOST || 'smtp.gmail.com';
const SMTP_PORT = parseInt(process.env.SMTP_PORT || '587', 10);
const SMTP_USER = process.env.SMTP_USER || '';
const SMTP_PASS = process.env.SMTP_PASS || '';
const FROM_EMAIL = SMTP_USER || 'noreply@jobbridge.com';
const FROM_NAME = 'JobBridge';
const REPLY_TO = process.env.REPLY_TO_EMAIL || SMTP_USER || 'support@jobbridge.com';

let transporter = null;
let smtpConfigured = false;

if (SMTP_USER && SMTP_PASS) {
  try {
    transporter = nodemailer.createTransport({
      host: SMTP_HOST,
      port: SMTP_PORT,
      secure: SMTP_PORT === 465,
      auth: { user: SMTP_USER, pass: SMTP_PASS },
      tls: { rejectUnauthorized: false },
    });
    smtpConfigured = true;
    console.log('Mailer: SMTP configured (' + SMTP_USER + ')');
  } catch (e) {
    console.warn('Mailer: Failed to create SMTP transport, using console fallback', e.message);
  }
} else {
  console.warn('Mailer: No SMTP credentials (SMTP_USER/SMTP_PASS). Emails will be logged to console only.');
  console.warn('Mailer: Set SMTP_USER and SMTP_PASS in .env to send real emails.');
}

async function sendMail({ to, subject, html, text }) {
  if (smtpConfigured && transporter) {
    try {
      const info = await transporter.sendMail({
        from: `"${FROM_NAME}" <${FROM_EMAIL}>`,
        replyTo: `"JobBridge Support" <${REPLY_TO}>`,
        to,
        subject,
        html,
        text: text || html.replace(/<[^>]+>/g, ''),
        headers: {
          'List-ID': 'JobBridge Notifications <jobbridge.com>',
          'X-Mailer': 'JobBridge Mailer',
          'X-Priority': '3',
        },
      });
      console.log('Mailer: Sent "' + subject + '" to ' + to + ' (id: ' + info.messageId + ')');
      return true;
    } catch (err) {
      console.error('Mailer: Failed to send email to ' + to, err.message);
    }
  }
  console.log('');
  console.log('===== EMAIL (console fallback) =====');
  console.log('To:      ' + to);
  console.log('Subject: ' + subject);
  console.log('Body:');
  console.log(text || html.replace(/<[^>]+>/g, ''));
  console.log('======================================');
  console.log('');
  return false;
}

function otpEmailHtml(code) {
  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:#f3f4f6">
<table role="presentation" cellpadding="0" cellspacing="0" width="100%"><tr><td style="padding:24px 16px">
  <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="max-width:520px;margin:0 auto">
    <tr>
      <td style="background:linear-gradient(135deg,#1e40af,#1e3a8a);padding:28px 24px;text-align:center;border-radius:12px 12px 0 0">
        <h1 style="color:#fff;margin:0;font-size:22px;font-weight:600">Welcome to JobBridge</h1>
        <p style="color:#93c5fd;margin:6px 0 0;font-size:13px">Your account is almost ready</p>
      </td>
    </tr>
    <tr>
      <td style="background:#fff;padding:28px 24px;border:1px solid #e5e7eb;border-top:none;border-radius:0 0 12px 12px">
        <p style="color:#374151;font-size:15px;line-height:1.6;margin:0 0 16px">Hi there,</p>
        <p style="color:#374151;font-size:15px;line-height:1.6;margin:0 0 20px">
          Please enter the confirmation code below to activate your JobBridge account.
        </p>
        <table role="presentation" cellpadding="0" cellspacing="0" width="100%">
          <tr>
            <td style="background:#f3f4f6;padding:20px;text-align:center;border-radius:8px;font-size:32px;font-weight:700;letter-spacing:8px;color:#1e40af;font-family:monospace">
              ${code}
            </td>
          </tr>
        </table>
        <p style="color:#6b7280;font-size:12px;line-height:1.5;margin:20px 0 0">
          This confirmation code works for 10 minutes. If you did not request this, please ignore this message.
        </p>
        <hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0" />
        <p style="color:#9ca3af;font-size:11px;text-align:center;margin:0">
          JobBridge &mdash; Professional Network<br />
          Connecting top talent with leading employers
        </p>
      </td>
    </tr>
  </table>
</td></tr></table>
</body>
</html>`;
}

function welcomeEmailHtml(name, role) {
  const isRecruiter = role === 'recruiter';
  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:#f3f4f6">
<table role="presentation" cellpadding="0" cellspacing="0" width="100%"><tr><td style="padding:24px 16px">
  <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="max-width:520px;margin:0 auto">
    <tr>
      <td style="background:${isRecruiter ? 'linear-gradient(135deg,#1e40af,#1e3a8a)' : 'linear-gradient(135deg,#059669,#047857)'};padding:28px 24px;text-align:center;border-radius:12px 12px 0 0">
        <h1 style="color:#fff;margin:0;font-size:22px;font-weight:600">Welcome to JobBridge!</h1>
        <p style="color:${isRecruiter ? '#93c5fd' : '#6ee7b7'};margin:6px 0 0;font-size:13px">${isRecruiter ? 'Start hiring top talent today' : 'Grow your business with JobBridge'}</p>
      </td>
    </tr>
    <tr>
      <td style="background:#fff;padding:28px 24px;border:1px solid #e5e7eb;border-top:none;border-radius:0 0 12px 12px">
        <p style="color:#374151;font-size:15px;line-height:1.6;margin:0 0 12px">Hello ${name || 'there'},</p>
        <p style="color:#374151;font-size:15px;line-height:1.6;margin:0 0 16px">
          Welcome to JobBridge! Your ${isRecruiter ? 'recruiter' : 'service provider'} account is active.
        </p>
        <p style="color:#374151;font-size:14px;line-height:1.6;margin:0 0 8px;font-weight:600">Here's what you can do next:</p>
        <table role="presentation" cellpadding="0" cellspacing="0" width="100%">
          <tr><td style="padding:4px 0 4px 20px;color:#374151;font-size:14px;line-height:1.6">${isRecruiter ? 'Post job openings and reach qualified candidates' : 'Create your service profile and showcase your skills'}</td></tr>
          <tr><td style="padding:4px 0 4px 20px;color:#374151;font-size:14px;line-height:1.6">${isRecruiter ? 'Browse talent profiles with AI-powered matching' : 'Receive inquiries from potential clients'}</td></tr>
          <tr><td style="padding:4px 0 4px 20px;color:#374151;font-size:14px;line-height:1.6">${isRecruiter ? 'Schedule interviews directly through the platform' : 'Get discovered through featured visibility'}</td></tr>
        </table>
        <hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0" />
        <p style="color:#9ca3af;font-size:11px;text-align:center;margin:0">
          JobBridge &mdash; Professional Network<br />
          Connecting top talent with leading employers
        </p>
      </td>
    </tr>
  </table>
</td></tr></table>
</body>
</html>`;
}

async function sendOtpEmail(email, code) {
  return sendMail({
    to: email,
    subject: 'Your JobBridge confirmation code',
    html: otpEmailHtml(code),
    text: 'Your JobBridge confirmation code is: ' + code + '\n\nThis code is valid for 10 minutes.\n\nIf you did not request this, please ignore this message.',
  });
}

async function sendWelcomeEmail(email, name, role) {
  return sendMail({
    to: email,
    subject: 'Welcome to JobBridge, ' + (name || 'there') + '!',
    html: welcomeEmailHtml(name, role),
    text: 'Welcome to JobBridge, ' + (name || 'there') + '! Your account has been created successfully.\n\n' + (role === 'recruiter'
      ? 'Post job openings, browse talent, and schedule interviews.'
      : 'Create your profile, showcase skills, and connect with clients.'),
  });
}

module.exports = { sendOtpEmail, sendWelcomeEmail, smtpConfigured };
