(async () => {
  try {
    const SUPABASE_URL = process.env.SUPABASE_URL;
    const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;
    const email = process.env.EMAIL;
    const password = process.env.PASSWORD;

    if (!SUPABASE_URL || !SUPABASE_ANON_KEY || !email || !password) {
      console.error('Missing required env vars. Need SUPABASE_URL, SUPABASE_ANON_KEY, EMAIL, PASSWORD');
      process.exit(1);
    }

    const url = `${SUPABASE_URL.replace(/\/+$/, '')}/auth/v1/token?grant_type=password`;
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
      },
      body: JSON.stringify({ email, password }),
    });

    const text = await res.text();
    console.log('status:', res.status);
    try {
      console.log(JSON.stringify(JSON.parse(text), null, 2));
    } catch (e) {
      console.log(text);
    }
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
})();
