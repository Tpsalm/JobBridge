(async () => {
  try {
    const srk = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const proj = 'https://ppramomuckkjzssrfghi.supabase.co';
    if (!srk) {
      console.error('No SUPABASE_SERVICE_ROLE_KEY in env');
      process.exit(1);
    }
    const q = encodeURIComponent('reference');
    const ref = encodeURIComponent('JB-TEST-SIM-12345');
    const url = `${proj}/rest/v1/payments?select=*&reference=eq.${ref}`;
    const res = await fetch(url, {
      headers: {
        Authorization: `Bearer ${srk}`,
        apikey: srk,
      },
    });
    console.log('status:', res.status);
    console.log(await res.text());
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
})();
