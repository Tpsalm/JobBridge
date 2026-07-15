const fetch = require('node-fetch');
const SUPABASE_URL = 'https://ppramomuckkjzssrfghi.supabase.co';
const ANON_KEY = '4fbb784ff472602fb57b821a81583a671a871c65e96518487b841a6fd13fb678';
const email = 'ceo@jobbridge.com.ng';
const password = 'JobBridgeCEO@2026!';

(async () => {
  try {
    const url = `${SUPABASE_URL.replace(/\/+$/, '')}/auth/v1/token?grant_type=password`;
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: ANON_KEY,
        Authorization: `Bearer ${ANON_KEY}`,
      },
      body: JSON.stringify({ email, password }),
    });

    const text = await res.text();
    console.log('status:', res.status);
    console.log(text);
  } catch (err) {
    console.error(err);
  }
})();
