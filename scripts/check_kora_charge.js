(async () => {
  try {
    const secret = process.env.KORA_SECRET_KEY;
    const reference = process.env.KORA_CHARGE_REFERENCE || 'JB-TEST-SIM-12345';
    if (!secret) {
      console.error('KORA_SECRET_KEY is required');
      process.exit(1);
    }

    const url = `https://api.korapay.com/merchant/api/v1/charges/${encodeURIComponent(reference)}`;
    console.log('Request URL:', url);

    const res = await fetch(url, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${secret}`,
        'Content-Type': 'application/json',
      },
    });

    console.log('status:', res.status);
    const text = await res.text();
    console.log('body:', text);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
})();
