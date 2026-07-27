import { createClient } from './node_modules/@supabase/supabase-js/dist/index.mjs';
const url = 'https://ppramomuckkjzssrfghi.supabase.co';
const key = '8b350fb505b7115a933880ede42aaf550527354c181734c342c6283f590faeb3';
const supabase = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });

const paymentQuery = async () => {
  const { data, error } = await supabase
    .from('payments')
    .select('id,user_id,plan,status,amount,currency,reference,provider_reference,metadata,created_at')
    .eq('amount', 1500)
    .order('created_at', { ascending: false })
    .limit(20);
  console.log('payments_error', error?.message || null);
  console.log('payments_count', data?.length || 0);
  console.log(JSON.stringify(data, null, 2));
  return data;
};

const userQuery = async (userId) => {
  if (!userId) return;
  const [{ data: profileData, error: profileError }, { data: userData, error: userError }] = await Promise.all([
    supabase.from('profiles').select('*').eq('id', userId).maybeSingle(),
    supabase.auth.admin.getUserById(userId),
  ]);
  console.log('profile_error', profileError?.message || null);
  console.log('user_error', userError?.message || null);
  console.log('profile', JSON.stringify(profileData, null, 2));
  console.log('authUser', JSON.stringify(userData?.user || null, null, 2));
};

const payments = await paymentQuery();
if (payments && payments.length) {
  await userQuery(payments[0].user_id);
}
