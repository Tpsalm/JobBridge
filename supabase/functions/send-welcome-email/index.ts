import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY') || '';
const FROM_EMAIL = 'noreply@jobbridge.africa';

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
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 0; padding: 0; background: #f5f5f5; }
    .container { max-width: 600px; margin: 0 auto; padding: 32px 24px; }
    .card { background: white; border-radius: 12px; padding: 32px; box-shadow: 0 2px 8px rgba(0,0,0,0.06); }
    .logo { font-size: 24px; font-weight: bold; color: #1d4ed8; margin-bottom: 8px; }
    h1 { font-size: 22px; color: #111; margin: 0 0 8px; }
    p { color: #555; line-height: 1.6; margin: 0 0 16px; font-size: 15px; }
    .btn { display: inline-block; background: #1d4ed8; color: white; padding: 12px 28px; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 15px; }
    .footer { margin-top: 24px; padding-top: 16px; border-top: 1px solid #eee; font-size: 13px; color: #999; }
  </style>
</head>
<body>
  <div class="container">
    <div class="card">
      <div class="logo">JobBridge</div>
      <h1>Welcome to JobBridge, ${displayName}! 👋</h1>
      <p>We're thrilled to have you on board. JobBridge is Nigeria's #1 professional network connecting talent with opportunity.</p>
      <p>Here's what you can do right now:</p>
      <p>
        • <strong>Complete your profile</strong> — add your experience, skills, and preferences<br>
        • <strong>Browse jobs</strong> — find roles that match your expertise<br>
        • <strong>Build your AI resume</strong> — use our AI-powered tools to stand out
      </p>
      <p style="text-align: center; margin-top: 24px;">
        <a class="btn" href="https://tpsalm.github.io/JobBridge/profile">Complete Your Profile</a>
      </p>
      <p>If you have any questions, simply reply to this email or reach out at jobbridgesupport@gmail.com.</p>
      <div class="footer">
        JobBridge Connect Africa &mdash; Democratizing opportunity across Africa.
      </div>
    </div>
  </div>
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
        subject: 'Welcome to JobBridge!',
        html,
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      console.error('Resend error:', err);
      return new Response(JSON.stringify({ error: 'Failed to send email' }), { status: 500 });
    }

    return new Response(JSON.stringify({ success: true }), { status: 200 });
  } catch (err) {
    console.error('Function error:', err);
    return new Response(JSON.stringify({ error: 'Internal error' }), { status: 500 });
  }
});
