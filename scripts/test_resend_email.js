(async () => {
  try {
    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey) {
      console.error('RESEND_API_KEY not set');
      process.exit(1);
    }

    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'JobBridge <onboarding@resend.dev>',
        to: ['owoyemi.samuel.tobi@gmail.com'],
        subject: 'JobBridge Resend Test',
        html: '<p>This is a test email from JobBridge.</p>',
      }),
    });

    const text = await response.text();
    console.log('status:', response.status);
    console.log(text);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
})();
