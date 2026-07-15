(async () => {
  try {
    const srk = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const proj = 'https://ppramomuckkjzssrfghi.supabase.co';
    const ref = process.env.TEST_PAYMENT_REF || 'JB-TEST-SIM-12345';
    if (!srk) {
      console.error('No SUPABASE_SERVICE_ROLE_KEY in env');
      process.exit(1);
    }

    const userRes = await fetch(`${proj}/rest/v1/users?select=id&limit=1`, {
      headers: { Authorization: `Bearer ${srk}`, apikey: srk },
    });
    const usersText = await userRes.text();
    if (userRes.status !== 200) {
      console.error('Failed to fetch users', userRes.status, usersText);
      process.exit(1);
    }
    const users = JSON.parse(usersText);
    if (!users || users.length === 0) {
      console.error('No users found in the database to attach to payment');
      process.exit(1);
    }
    const userId = users[0].id;
    console.log('Using user id:', userId);

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
