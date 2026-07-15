(async () => {
  try {
    const signature = process.env.OVERRIDE_SIG;
    const project = 'https://ppramomuckkjzssrfghi.supabase.co';
    const url = `${project}/functions/v1/kora-webhook`;
    if (!signature) {
      console.error('OVERRIDE_SIG not set');
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

    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-korapay-signature': signature,
      },
      body: JSON.stringify(payload),
    });

    const text = await res.text();
    console.log('response status:', res.status);
    console.log(text);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
})();
