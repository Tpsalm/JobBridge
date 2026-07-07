import { supabase, Profile } from './supabase';

// ─── Jobs ───────────────────────────────────────────────────────────────────

export async function fetchJobs() {
  const { data, error } = await supabase
    .from('jobs')
    .select('*')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data || [];
}

export async function fetchJobById(id: string) {
  const { data, error } = await supabase
    .from('jobs')
    .select('*')
    .eq('id', id)
    .single();
  if (error) throw error;
  return data;
}

export async function createJob(job: {
  recruiter_id: string;
  title: string;
  company: string;
  description: string;
  location: string;
  type: string;
  salary_range?: string;
  category?: string;
  requirements?: string[];
  benefits?: string[];
  is_featured?: boolean;
  is_active?: boolean;
  expires_at?: string;
}) {
  const { data, error } = await supabase
    .from('jobs')
    .insert([{
      ...job,
      is_featured: job.is_featured ?? false,
      is_active: job.is_active ?? true,
      views: 0,
      applications_count: 0,
    }])
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function updateJob(id: string, updates: Partial<{
  title: string;
  company: string;
  description: string;
  location: string;
  type: string;
  salary_range: string;
  category: string;
  requirements: string[];
  benefits: string[];
  is_featured: boolean;
  is_active: boolean;
  expires_at: string;
}>) {
  const { data, error } = await supabase
    .from('jobs')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function deleteJob(id: string) {
  const { error } = await supabase
    .from('jobs')
    .delete()
    .eq('id', id);
  if (error) throw error;
}

export async function incrementJobViews(id: string, currentViews: number) {
  const { error } = await supabase
    .from('jobs')
    .update({ views: (currentViews || 0) + 1 })
    .eq('id', id);
  if (error) throw error;
}

// ─── Applications ───────────────────────────────────────────────────────────

export async function fetchApplications(recruiterId?: string) {
  let query = supabase
    .from('applications')
    .select('*, job:jobs(*), applicant:profiles(*)')
    .order('created_at', { ascending: false });
  if (recruiterId) {
    query = query.eq('job.recruiter_id', recruiterId);
  }
  const { data, error } = await query;
  if (error) throw error;
  return data || [];
}

export async function fetchUserApplications(userId: string) {
  const { data, error } = await supabase
    .from('applications')
    .select('*, job:jobs(*)')
    .eq('applicant_id', userId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data || [];
}

export async function createApplication(app: {
  job_id: string;
  applicant_id: string;
  cover_letter?: string;
  resume_url?: string;
}) {
  const { data, error } = await supabase
    .from('applications')
    .insert([{ ...app, status: 'pending' }])
    .select()
    .single();
  if (error) throw error;
  // Increment applications_count on the job
  await supabase.rpc('increment_applications_count', { job_id: app.job_id });
  return data;
}

export async function updateApplicationStatus(id: string, status: string) {
  const { data, error } = await supabase
    .from('applications')
    .update({ status, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  return data;
}

// ─── Profiles ───────────────────────────────────────────────────────────────

export async function fetchProfile(userId: string) {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function fetchProviders() {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('role', 'provider')
    .order('is_featured', { ascending: false })
    .order('is_verified', { ascending: false })
    .order('reviews_count', { ascending: false });
  if (error) throw error;
  return (data || []) as Profile[];
}

export async function updateProfile(userId: string, updates: Record<string, any>) {
  const { data, error } = await supabase
    .from('profiles')
    .upsert({ id: userId, ...updates, updated_at: new Date().toISOString() }, { onConflict: 'id' })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function upsertProfile(profile: {
  id: string;
  email: string;
  full_name: string;
  role: string;
  company?: string;
  phone?: string;
  avatar_url?: string;
  location?: string;
  bio?: string;
}) {
  const { data, error } = await supabase
    .from('profiles')
    .upsert(profile, { onConflict: 'id' })
    .select()
    .single();
  if (error) throw error;
  return data;
}


// ─── Blog Subscriptions ────────────────────────────────────────────────────

export async function subscribeToBlog(email: string) {
  const { error } = await supabase
    .from('blog_subscribers')
    .insert([{ email }]);
  if (error) throw error;
}

// ─── Payments ───────────────────────────────────────────────────────────────

export async function recordPayment(payment: {
  user_id: string;
  plan: string;
  amount: number;
  reference: string;
  status: string;
}) {
  const { data, error } = await supabase
    .from('payments')
    .insert([payment])
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function decrementCredits(userId: string) {
  const { error } = await supabase.rpc('decrement_credits', { user_id: userId });
  if (error) {
    console.warn('decrement_credits RPC failed, attempting direct update:', error);
    // Direct fallback: read current credits and subtract 1
    const { data: profile, error: fetchError } = await supabase
      .from('profiles')
      .select('credits')
      .eq('id', userId)
      .maybeSingle();
    if (fetchError) throw fetchError;
    const currentCredits = profile?.credits || 0;
    const newCredits = Math.max(0, currentCredits - 1);
    const { error: updateError } = await supabase
      .from('profiles')
      .update({ credits: newCredits, updated_at: new Date().toISOString() })
      .eq('id', userId);
    if (updateError) throw updateError;
  }
}
