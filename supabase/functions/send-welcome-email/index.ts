import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY') || '';
const FROM_EMAIL = 'JobBridge <onboarding@resend.dev>';

serve(async (req) => {
  try {
    const { email, name } = await req.json();

    if (!email) {
      return new Response(JSON.stringify({ error: 'Email is required' }), { status: 400 });
    }

    const displayName = name || 'there';

    const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Welcome to JobBridge</title>
</head>
<body style="margin:0;padding:0;background-color:#f4f6f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f6f9;">
    <tr>
      <td align="center" style="padding:40px 16px;">
        <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;">
          <!-- Header -->
          <tr>
            <td style="background:linear-gradient(135deg,#1e3a5f 0%,#1d4ed8 100%);border-radius:16px 16px 0 0;padding:40px 40px 32px;text-align:center;">
              <img src="https://ppramomuckkjzssrfghi.supabase.co/storage/v1/object/public/assets/jobbridge-logo-white.png" alt="JobBridge" width="180" style="max-width:180px;height:auto;margin-bottom:8px;" onerror="this.style.display='none'">
              <div style="font-size:28px;font-weight:800;color:#ffffff;letter-spacing:-0.5px;margin-top:8px;">Welcome to JobBridge</div>
              <div style="width:60px;height:3px;background:#3b82f6;border-radius:2px;margin:16px auto 0;"></div>
            </td>
          </tr>
          <!-- Body -->
          <tr>
            <td style="background:#ffffff;padding:40px;border-left:1px solid #e5e7eb;border-right:1px solid #e5e7eb;">
              <p style="font-size:16px;color:#374151;line-height:1.7;margin:0 0 20px;">Hi <strong style="color:#111827;">${displayName}</strong>,</p>
              <p style="font-size:16px;color:#374151;line-height:1.7;margin:0 0 24px;">
                Welcome to <strong style="color:#1d4ed8;">JobBridge</strong> — Nigeria's #1 professional network. We're excited to have you on board!
              </p>

              <!-- Getting Started Card -->
              <table width="100%" cellpadding="0" cellspacing="0" style="background:#f8fafc;border-radius:12px;padding:24px;margin-bottom:28px;">
                <tr>
                  <td>
                    <div style="font-size:15px;font-weight:700;color:#111827;margin-bottom:16px;">🚀 Get started in 3 steps</div>
                    <table cellpadding="0" cellspacing="0" style="width:100%;">
                      <tr>
                        <td style="padding-bottom:14px;vertical-align:top;width:32px;">
                          <table cellpadding="0" cellspacing="0" style="width:28px;height:28px;background:#1d4ed8;border-radius:50%;">
                            <tr><td align="center" style="font-size:14px;font-weight:700;color:#ffffff;">1</td></tr>
                          </table>
                        </td>
                        <td style="padding-bottom:14px;font-size:14px;color:#4b5563;line-height:1.6;">
                          <strong style="color:#111827;">Complete your profile</strong> — Add your experience, skills, and preferences so recruiters can find you.
                        </td>
                      </tr>
                      <tr>
                        <td style="padding-bottom:14px;vertical-align:top;">
                          <table cellpadding="0" cellspacing="0" style="width:28px;height:28px;background:#1d4ed8;border-radius:50%;">
                            <tr><td align="center" style="font-size:14px;font-weight:700;color:#ffffff;">2</td></tr>
                          </table>
                        </td>
                        <td style="padding-bottom:14px;font-size:14px;color:#4b5563;line-height:1.6;">
                          <strong style="color:#111827;">Browse jobs</strong> — Explore thousands of verified opportunities from top employers.
                        </td>
                      </tr>
                      <tr>
                        <td style="vertical-align:top;">
                          <table cellpadding="0" cellspacing="0" style="width:28px;height:28px;background:#1d4ed8;border-radius:50%;">
                            <tr><td align="center" style="font-size:14px;font-weight:700;color:#ffffff;">3</td></tr>
                          </table>
                        </td>
                        <td style="font-size:14px;color:#4b5563;line-height:1.6;">
                          <strong style="color:#111827;">Build your AI resume</strong> — Use our AI-powered tools to create a standout CV.
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>

              <!-- CTA Button -->
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td align="center" style="padding-bottom:28px;">
                    <table cellpadding="0" cellspacing="0">
                      <tr>
                        <td align="center" style="background:linear-gradient(135deg,#1d4ed8,#2563eb);border-radius:10px;padding:14px 36px;">
                          <a href="https://tpsalm.github.io/JobBridge/profile" target="_blank" style="color:#ffffff;font-size:16px;font-weight:700;text-decoration:none;display:inline-block;letter-spacing:0.3px;">
                            Complete Your Profile
                          </a>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>

              <!-- Divider -->
              <div style="height:1px;background:#e5e7eb;margin-bottom:24px;"></div>

              <!-- Features -->
              <p style="font-size:15px;font-weight:700;color:#111827;margin:0 0 14px;">What you can do on JobBridge</p>
              <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:24px;">
                <tr>
                  <td style="padding:8px 0;font-size:14px;color:#4b5563;vertical-align:top;width:24px;">✓</td>
                  <td style="padding:8px 0;font-size:14px;color:#4b5563;line-height:1.5;">Apply to jobs with one click</td>
                </tr>
                <tr>
                  <td style="padding:8px 0;font-size:14px;color:#4b5563;vertical-align:top;">✓</td>
                  <td style="padding:8px 0;font-size:14px;color:#4b5563;line-height:1.5;">Get AI-powered resume and cover letter tools</td>
                </tr>
                <tr>
                  <td style="padding:8px 0;font-size:14px;color:#4b5563;vertical-align:top;">✓</td>
                  <td style="padding:8px 0;font-size:14px;color:#4b5563;line-height:1.5;">Receive personalized job recommendations</td>
                </tr>
                <tr>
                  <td style="padding:8px 0;font-size:14px;color:#4b5563;vertical-align:top;">✓</td>
                  <td style="padding:8px 0;font-size:14px;color:#4b5563;line-height:1.5;">Chat with our AI assistant for instant help</td>
                </tr>
              </table>

              <p style="font-size:15px;color:#374151;line-height:1.7;margin:0 0 8px;">
                Need help? Our AI assistant is available on every page, or reach out at <a href="mailto:jobbridgeesupport@gmail.com" style="color:#1d4ed8;text-decoration:underline;">jobbridgeesupport@gmail.com</a>.
              </p>
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="background:#f8fafc;border-radius:0 0 16px 16px;border:1px solid #e5e7eb;border-top:none;padding:24px 40px;text-align:center;">
              <p style="font-size:13px;color:#9ca3af;line-height:1.6;margin:0;">
                JobBridge Connect Africa<br>
                Democratizing opportunity across Africa.
              </p>
              <p style="font-size:12px;color:#d1d5db;margin:12px 0 0;">
                You received this because you created a JobBridge account.
                <br><a href="https://tpsalm.github.io/JobBridge" style="color:#6b7280;text-decoration:underline;">Visit JobBridge</a>
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: FROM_EMAIL,
        to: email,
        subject: 'Welcome to JobBridge! 🚀',
        html,
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      console.error('Resend error:', err);
      return new Response(JSON.stringify({ error: 'Failed to send email' }), { status: 500 });
    }

    const data = await res.json();
    console.log('Welcome email sent:', data.id);
    return new Response(JSON.stringify({ success: true }), { status: 200 });
  } catch (err) {
    console.error('Function error:', err);
    return new Response(JSON.stringify({ error: 'Internal error' }), { status: 500 });
  }
});
