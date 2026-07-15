(async () => {
  try {
    const srk = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const proj = 'https://ppramomuckkjzssrfghi.supabase.co';
    if(!srk){console.error('No SRK in env');process.exit(1)}
    const res = await fetch(`${proj}/rest/v1/payments?select=user_id,reference&limit=1`,{
      headers: { Authorization: `Bearer ${srk}`, apikey: srk },
    });
    const text = await res.text();
    console.log('status:', res.status);
    console.log(text);
  } catch(e){console.error(e);process.exit(1)}
})();
