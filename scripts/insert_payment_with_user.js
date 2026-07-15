(async () => {
  try {
    const srk = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const proj = 'https://ppramomuckkjzssrfghi.supabase.co';
    const ref = process.env.TEST_PAYMENT_REF || 'JB-TEST-SIM-12345';
    const userId = process.env.TEST_USER_ID || 'a580cb16-3cdd-489f-8258-68572f638f6b';
    if (!srk) {
      console.error('No SUPABASE_SERVICE_ROLE_KEY in env');
      process.exit(1);
    }

    const body = {
      user_id: userId,
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
    console.log('insert status:', res.status);
    console.log(text);
  } catch (e) {
    console.error(e);
    process.exit(1);
  }
})();
