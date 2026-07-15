(async () => {
  try {
    const srk = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const proj = 'https://ppramomuckkjzssrfghi.supabase.co';
    const userId = 'a580cb16-3cdd-489f-8258-68572f638f6b';
    if (!srk) {
      console.error('No SUPABASE_SERVICE_ROLE_KEY in env');
      process.exit(1);
    }
    const res = await fetch(`${proj}/rest/v1/notifications?select=id,user_id,type,title,content,data&user_id=eq.${userId}&order=created_at.desc&limit=5`, {
      headers: { Authorization: `Bearer ${srk}`, apikey: srk },
    });
    console.log('status:', res.status);
    console.log(await res.text());
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
})();
