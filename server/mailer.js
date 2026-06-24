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
<body style="margin:0;padding:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:#f0f4f8">
<table role="presentation" cellpadding="0" cellspacing="0" width="100%"><tr><td style="padding:32px 16px">
  <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="max-width:560px;margin:0 auto">
    <tr>
      <td style="background:linear-gradient(135deg,#1e40af,#1e3a8a);padding:32px 24px;text-align:center;border-radius:16px 16px 0 0">
        <div style="width:64px;height:64px;background:rgba(255,255,255,0.15);border-radius:50%;margin:0 auto 16px;display:flex;align-items:center;justify-content:center;font-size:28px">🔐</div>
        <h1 style="color:#fff;margin:0;font-size:24px;font-weight:700">Verify Your Email</h1>
        <p style="color:#93c5fd;margin:8px 0 0;font-size:14px">You're almost there!</p>
      </td>
    </tr>
    <tr>
      <td style="background:#ffffff;padding:32px 24px;border:1px solid #e5e7eb;border-top:none;border-radius:0 0 16px 16px">
        <p style="color:#374151;font-size:15px;line-height:1.6;margin:0 0 8px">Hi there,</p>
        <p style="color:#374151;font-size:15px;line-height:1.6;margin:0 0 24px">
          Thanks for joining <strong style="color:#1e40af">JobBridge</strong>! Please use the verification code below to activate your account.
        </p>
        <table role="presentation" cellpadding="0" cellspacing="0" width="100%">
          <tr>
            <td style="background:#f1f5f9;padding:24px;text-align:center;border-radius:12px">
              <span style="font-size:36px;font-weight:800;letter-spacing:10px;color:#1e40af;font-family:monospace">${code}</span>
            </td>
          </tr>
        </table>
        <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="margin-top:24px">
          <tr>
            <td style="background:#fef2f2;border-radius:8px;padding:12px 16px">
              <p style="color:#dc2626;font-size:12px;margin:0;line-height:1.5">
                ⏰ This code expires in <strong>10 minutes</strong>. If you didn't sign up for JobBridge, please ignore this email.
              </p>
            </td>
          </tr>
        </table>
        <hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0" />
        <p style="color:#94a3b8;font-size:12px;text-align:center;margin:0">Need help? <a href="mailto:jobbridgesupport@gmail.com" style="color:#1e40af">jobbridgesupport@gmail.com</a></p>
      </td>
    </tr>
  </table>
</td></tr></table>
</body>
</html>`;
}

function welcomeEmailHtml(name, role) {
  const isRecruiter = role === 'recruiter';
  const isProvider = role === 'provider';
  const isJobSeeker = role === 'job_seeker' || (!isRecruiter && !isProvider);
  const heroImg = 'https://images.pexels.com/photos/5669602/pexels-photo-5669602.jpeg?auto=compress&cs=tinysrgb&w=600&dpr=2';
  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:#f0f4f8">
<table role="presentation" cellpadding="0" cellspacing="0" width="100%"><tr><td style="padding:32px 16px">
  <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="max-width:560px;margin:0 auto">
    <tr>
      <td style="padding:0;border-radius:16px 16px 0 0;overflow:hidden;line-height:0">
        <img src="${heroImg}" alt="Welcome to JobBridge" style="width:100%;height:auto;display:block;max-width:560px" />
      </td>
    </tr>
    <tr>
      <td style="background:linear-gradient(135deg,#1e40af,#1e3a8a);padding:28px 24px;text-align:center">
        <h1 style="color:#fff;margin:0;font-size:24px;font-weight:700">Welcome to JobBridge, ${name || 'there'}!</h1>
        <p style="color:#93c5fd;margin:8px 0 0;font-size:14px">${isRecruiter ? 'Your hiring journey starts here' : isProvider ? 'Your service business awaits' : 'Your dream career starts now'}</p>
      </td>
    </tr>
    <tr>
      <td style="background:#ffffff;padding:32px 24px;border:1px solid #e5e7eb;border-top:none;border-radius:0 0 16px 16px">
        <p style="color:#374151;font-size:15px;line-height:1.6;margin:0 0 20px">
          We're thrilled to have you on board! Your <strong style="color:#1e40af">${role || 'job_seeker'}</strong> account is now active and ready to go.
        </p>

        <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="background:#f8fafc;border-radius:12px;padding:20px;margin-bottom:20px">
          <tr>
            <td style="padding:4px 0">
              <p style="color:#64748b;font-size:13px;margin:0 0 12px;font-weight:600">Here's what you can do next:</p>
              ${isRecruiter ? `
              <p style="color:#374151;font-size:14px;margin:0 0 8px;padding-left:20px">✅ Post job openings and reach qualified candidates</p>
              <p style="color:#374151;font-size:14px;margin:0 0 8px;padding-left:20px">✅ Browse talent profiles with AI-powered matching</p>
              <p style="color:#374151;font-size:14px;margin:0 0 8px;padding-left:20px">✅ Schedule interviews directly through the platform</p>
              <p style="color:#374151;font-size:14px;margin:0 0 0;padding-left:20px">✅ Subscribe to premium plans for more visibility</p>
              ` : isProvider ? `
              <p style="color:#374151;font-size:14px;margin:0 0 8px;padding-left:20px">✅ Create your service profile and showcase your skills</p>
              <p style="color:#374151;font-size:14px;margin:0 0 8px;padding-left:20px">✅ Receive inquiries from potential clients</p>
              <p style="color:#374151;font-size:14px;margin:0 0 8px;padding-left:20px">✅ Get discovered through featured visibility</p>
              <p style="color:#374151;font-size:14px;margin:0 0 0;padding-left:20px">✅ Choose a plan to boost your reach</p>
              ` : `
              <p style="color:#374151;font-size:14px;margin:0 0 8px;padding-left:20px">✅ Browse thousands of jobs across multiple industries</p>
              <p style="color:#374151;font-size:14px;margin:0 0 8px;padding-left:20px">✅ Build an AI-powered resume that gets you noticed</p>
              <p style="color:#374151;font-size:14px;margin:0 0 8px;padding-left:20px">✅ Generate tailored cover letters with AI</p>
              <p style="color:#374151;font-size:14px;margin:0 0 0;padding-left:20px">✅ Practice interviews and negotiate salary with confidence</p>
              `}
            </td>
          </tr>
        </table>

        <table role="presentation" cellpadding="0" cellspacing="0" width="100%">
          <tr>
            <td style="text-align:center;padding:8px 0 20px">
              <a href="https://jobbridge.com/login" style="display:inline-block;background:linear-gradient(135deg,#1e40af,#1e3a8a);color:#ffffff;text-decoration:none;font-size:14px;font-weight:600;padding:14px 36px;border-radius:8px">Get Started Now</a>
            </td>
          </tr>
        </table>

        <hr style="border:none;border-top:1px solid #e5e7eb;margin:20px 0" />
        <p style="color:#94a3b8;font-size:12px;text-align:center;margin:0 0 4px">Need help? Contact us at</p>
        <p style="color:#1e40af;font-size:13px;text-align:center;margin:0 0 2px;font-weight:500">jobbridgesupport@gmail.com</p>
        <p style="color:#94a3b8;font-size:12px;text-align:center;margin:0">or call 09136171354</p>
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

function subscriptionEmailHtml(email) {
  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:#f3f4f6">
<table role="presentation" cellpadding="0" cellspacing="0" width="100%"><tr><td style="padding:24px 16px">
  <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="max-width:520px;margin:0 auto">
    <tr>
      <td style="background:linear-gradient(135deg,#1e40af,#1e3a8a);padding:28px 24px;text-align:center;border-radius:12px 12px 0 0">
        <h1 style="color:#fff;margin:0;font-size:22px;font-weight:600">JobBridge Insights</h1>
        <p style="color:#93c5fd;margin:6px 0 0;font-size:13px">Thank you for subscribing!</p>
      </td>
    </tr>
    <tr>
      <td style="background:#fff;padding:28px 24px;border:1px solid #e5e7eb;border-top:none;border-radius:0 0 12px 12px">
        <p style="color:#374151;font-size:15px;line-height:1.6;margin:0 0 16px">Hi there,</p>
        <p style="color:#374151;font-size:15px;line-height:1.6;margin:0 0 20px">
          Thank you for subscribing to <strong>JobBridge Insights</strong>! You'll now receive the latest articles on careers, hiring, and the future of work delivered straight to your inbox.
        </p>
        <table role="presentation" cellpadding="0" cellspacing="0" width="100%">
          <tr>
            <td style="background:#f3f4f6;padding:20px;text-align:center;border-radius:8px">
              <p style="color:#1e40af;font-size:16px;font-weight:600;margin:0">Welcome to the JobBridge community!</p>
            </td>
          </tr>
        </table>
        <p style="color:#374151;font-size:15px;line-height:1.6;margin:20px 0 0">
          Stay tuned for expert advice on resume building, interview tips, salary negotiation, and AI-powered career tools.
        </p>
        <p style="color:#374151;font-size:15px;line-height:1.6;margin:16px 0 0">
          Best regards,<br/>The JobBridge Team
        </p>
      </td>
    </tr>
    <tr>
      <td style="padding:16px 24px;text-align:center">
        <p style="color:#9ca3af;font-size:11px;margin:0">You're receiving this because you subscribed on JobBridge. If you didn't subscribe, please ignore this email.</p>
      </td>
    </tr>
  </table>
</td></tr></table>
</body>
</html>`;
}

async function sendSubscriptionEmail(email) {
  return sendMail({
    to: email,
    subject: 'Thank you for subscribing to JobBridge Insights!',
    html: subscriptionEmailHtml(email),
    text: 'Thank you for subscribing to JobBridge Insights! You will now receive the latest articles on careers, hiring, and the future of work.',
  });
}

function subscriptionConfirmationHtml(name, planName, durationDays, amount) {
  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:#f0f4f8">
<table role="presentation" cellpadding="0" cellspacing="0" width="100%"><tr><td style="padding:32px 16px">
  <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="max-width:560px;margin:0 auto">
    <tr>
      <td style="background:linear-gradient(135deg,#1e40af,#1e3a8a);padding:32px 24px;text-align:center;border-radius:16px 16px 0 0">
        <div style="width:64px;height:64px;background:rgba(255,255,255,0.15);border-radius:50%;margin:0 auto 16px;display:flex;align-items:center;justify-content:center;font-size:28px">🎉</div>
        <h1 style="color:#fff;margin:0;font-size:24px;font-weight:700">Welcome to Premium!</h1>
        <p style="color:#93c5fd;margin:8px 0 0;font-size:14px">Your subscription is now active</p>
      </td>
    </tr>
    <tr>
      <td style="background:#ffffff;padding:32px 24px;border:1px solid #e5e7eb;border-top:none;border-radius:0 0 16px 16px">
        <p style="color:#374151;font-size:15px;line-height:1.6;margin:0 0 6px">Hi <strong style="color:#1e40af">${name || 'there'}</strong>,</p>
        <p style="color:#374151;font-size:15px;line-height:1.6;margin:0 0 20px">
          Thank you for subscribing to <strong style="color:#1e40af">${planName}</strong>! You now have access to all the premium features that come with your plan.
        </p>
        <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="background:#f8fafc;border-radius:12px;padding:20px;margin-bottom:20px">
          <tr>
            <td style="padding:4px 0">
              <span style="color:#64748b;font-size:13px">Plan</span><br/>
              <span style="color:#1e293b;font-size:15px;font-weight:600">${planName}</span>
            </td>
          </tr>
          <tr>
            <td style="padding:4px 0">
              <span style="color:#64748b;font-size:13px">Duration</span><br/>
              <span style="color:#1e293b;font-size:15px;font-weight:600">${durationDays} days</span>
            </td>
          </tr>
          <tr>
            <td style="padding:4px 0">
              <span style="color:#64748b;font-size:13px">Amount Paid</span><br/>
              <span style="color:#059669;font-size:15px;font-weight:600">₦${amount?.toLocaleString() || '—'}</span>
            </td>
          </tr>
          <tr>
            <td style="padding:4px 0">
              <span style="color:#64748b;font-size:13px">Status</span><br/>
              <span style="display:inline-block;background:#dcfce7;color:#059669;font-size:12px;font-weight:600;padding:2px 10px;border-radius:999px;margin-top:2px">Active ✅</span>
            </td>
          </tr>
        </table>
        <p style="color:#374151;font-size:14px;line-height:1.6;margin:0 0 20px">
          You can now start using all the premium features immediately. If you have any questions or need assistance, we're here to help!
        </p>
        <table role="presentation" cellpadding="0" cellspacing="0" width="100%">
          <tr>
            <td style="text-align:center;padding:8px 0 20px">
              <a href="https://jobbridge.com/dashboard" style="display:inline-block;background:linear-gradient(135deg,#1e40af,#1e3a8a);color:#ffffff;text-decoration:none;font-size:14px;font-weight:600;padding:12px 32px;border-radius:8px">Go to Dashboard</a>
            </td>
          </tr>
        </table>
        <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="border-top:1px solid #e5e7eb;padding-top:16px">
          <tr>
            <td style="text-align:center">
              <p style="color:#94a3b8;font-size:12px;margin:0 0 4px">Need help? Contact us at</p>
              <a href="mailto:jobbridgesupport@gmail.com" style="color:#1e40af;font-size:13px;text-decoration:none;font-weight:500">jobbridgesupport@gmail.com</a>
              <p style="color:#94a3b8;font-size:12px;margin:4px 0 0">or call 09136171354</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
    <tr>
      <td style="padding:16px 24px;text-align:center">
        <p style="color:#94a3b8;font-size:11px;margin:0">JobBridge — Building bridges between talent and opportunity</p>
      </td>
    </tr>
  </table>
</td></tr></table>
</body>
</html>`;
}

async function sendSubscriptionConfirmationEmail(email, name, planName, durationDays, amount) {
  return sendMail({
    to: email,
    subject: '🎉 Welcome to ' + planName + ' — Your Subscription is Active!',
    html: subscriptionConfirmationHtml(name, planName, durationDays, amount),
    text: 'Welcome to ' + planName + '! Your premium subscription is now active. Start using all the features immediately. Need help? Contact jobbridgesupport@gmail.com',
  });
}

function adminLoginAlertHtml(adminId, ip, time) {
  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:#f0f4f8">
<table role="presentation" cellpadding="0" cellspacing="0" width="100%"><tr><td style="padding:32px 16px">
  <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="max-width:560px;margin:0 auto">
    <tr>
      <td style="background:linear-gradient(135deg,#1e40af,#1e3a8a);padding:32px 24px;text-align:center;border-radius:16px 16px 0 0">
        <div style="width:64px;height:64px;background:rgba(255,255,255,0.15);border-radius:50%;margin:0 auto 16px;display:flex;align-items:center;justify-content:center;font-size:28px">🔐</div>
        <h1 style="color:#fff;margin:0;font-size:22px;font-weight:600">Admin Login Alert</h1>
        <p style="color:#93c5fd;margin:8px 0 0;font-size:13px">Stealth Console Access</p>
      </td>
    </tr>
    <tr>
      <td style="background:#ffffff;padding:32px 24px;border:1px solid #e5e7eb;border-top:none;border-radius:0 0 16px 16px">
        <p style="color:#374151;font-size:15px;line-height:1.6;margin:0 0 16px">The Stealth Console was accessed.</p>
        <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="background:#f8fafc;border-radius:12px;padding:20px;margin-bottom:20px">
          <tr><td style="padding:4px 0"><span style="color:#64748b;font-size:13px">Admin ID</span><br/><span style="color:#1e293b;font-size:15px;font-weight:600">${adminId}</span></td></tr>
          <tr><td style="padding:4px 0;padding-top:12px"><span style="color:#64748b;font-size:13px">IP Address</span><br/><span style="color:#1e293b;font-size:15px;font-weight:600">${ip || 'Unknown'}</span></td></tr>
          <tr><td style="padding:4px 0;padding-top:12px"><span style="color:#64748b;font-size:13px">Time</span><br/><span style="color:#1e293b;font-size:15px;font-weight:600">${time || new Date().toLocaleString()}</span></td></tr>
          <tr><td style="padding:4px 0;padding-top:12px"><span style="color:#64748b;font-size:13px">Status</span><br/><span style="display:inline-block;background:#dcfce7;color:#059669;font-size:12px;font-weight:600;padding:2px 10px;border-radius:999px;margin-top:2px">Successful ✅</span></td></tr>
        </table>
        <p style="color:#94a3b8;font-size:12px;line-height:1.5;margin:0">If you did not perform this action, change your credentials immediately and contact support.</p>
      </td>
    </tr>
  </table>
</td></tr></table>
</body>
</html>`;
}

async function sendAdminLoginAlert(adminId, ip) {
  return sendMail({
    to: SMTP_USER || 'tobiopeyemi057@gmail.com',
    subject: '🔐 Stealth Console Access — Admin Login Alert',
    html: adminLoginAlertHtml(adminId, ip, new Date().toLocaleString()),
    text: 'Stealth Console was accessed by ' + adminId + ' from IP ' + (ip || 'Unknown') + ' at ' + new Date().toLocaleString(),
  });
}

module.exports = { sendOtpEmail, sendWelcomeEmail, sendSubscriptionEmail, sendSubscriptionConfirmationEmail, sendAdminLoginAlert, smtpConfigured };
