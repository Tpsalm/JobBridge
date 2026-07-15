(async () => {
  try {
    const secret = process.env.KORA_SECRET_KEY;
    const variant = process.env.SIGN_VARIANT || 'data'; // raw|data|stable|stable_no_ws
    const project = 'https://ppramomuckkjzssrfghi.supabase.co';
    const url = `${project}/functions/v1/kora-webhook`;
    if (!secret) {
      console.error('KORA_SECRET_KEY not set');
      process.exit(1);
    }

    const payload = {
      event: 'charge.success',
      data: {
        reference: 'JB-TEST-SIM-12345',
        amount: 2000,
        amount_expected: 2000,
        amount_paid: 2000,
        fee: 0,
        status: 'success',
        currency: 'NGN',
        payment_reference: 'KORA-PAYMENT-TEST-001',
        transaction_reference: 'KORA-TRANS-TEST-001',
        transaction_status: 'success',
        simulate_verification: true,
      },
    };

    function stableStringify(value) {
      if (value === null || typeof value !== 'object') return JSON.stringify(value);
      if (Array.isArray(value)) return `[${value.map((i) => stableStringify(i)).join(',')}]`;
      const entries = Object.entries(value).sort(([a], [b]) => a.localeCompare(b)).map(([k, v]) => `${JSON.stringify(k)}:${stableStringify(v)}`);
      return `{${entries.join(',')}}`;
    }

    const raw = JSON.stringify(payload);
    const dataStr = JSON.stringify(payload.data);
    const stable = stableStringify(payload.data);
    const stableNoWs = stable.replace(/\s+/g, '');

    const crypto = await import('crypto');
    const hmac = (s) => crypto.createHmac('sha256', secret).update(s, 'utf8').digest('hex');

    const variants = { raw, data: dataStr, stable, stable_no_ws: stableNoWs };
    console.log('Available variants and signatures:');
    for (const [k, v] of Object.entries(variants)) {
      console.log(k, hmac(v));
    }

    const chosen = variants[variant] || dataStr;
    console.log('Sending with variant:', variant);
    const signature = hmac(chosen);

    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-korapay-signature': signature,
      },
      body: raw,
    });

    const text = await res.text();
    console.log('response status:', res.status);
    console.log(text);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
})();
