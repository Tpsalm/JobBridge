(async () => {
  try {
    const srk = process.env.SUPABASE_SERVICE_ROLE_KEY || '8b350fb505b7115a933880ede42aaf550527354c181734c342c6283f590faeb3';
    const proj = 'https://ppramomuckkjzssrfghi.supabase.co';
    const ref = 'JB-TEST-SIM-12345';
    const body = {
      user_id: '00000000-0000-0000-0000-000000000000',
      plan: 'basic',
      status: 'pending',
      amount: 2000,
      currency: 'NGN',
      reference: ref,
      metadata: { source: 'test_webhook' },
    };

    const res = await fetch(`${proj}/rest/v1/payments`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${srk}`,
        apikey: srk,
        Prefer: 'return=representation',
      },
      body: JSON.stringify(body),
    });

    const text = await res.text();
    console.log('status:', res.status);
    console.log(text);
  } catch (e) {
    console.error(e);
    process.exit(1);
  }
})();
