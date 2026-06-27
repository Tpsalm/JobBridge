import { supabase } from './supabase';

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

export async function updateProfile(userId: string, updates: Partial<{
  full_name: string;
  phone: string;
  avatar_url: string;
  location: string;
  bio: string;
  company: string;
  date_of_birth: string;
  gender: string;
  is_disabled: string;
  is_displaced: string;
  professional_headline: string;
  years_of_experience: string;
  function: string;
  work_type: string;
  highest_qualification: string;
  availability: string;
  salary_expectation: string;
  specialty: string;
  hourly_rate: number;
  skills: string[];
  is_verified: boolean;
  is_featured: boolean;
  reviews_count: number;
  is_active: boolean;
  is_premium: boolean;
  subscription_tier: string;
  subscription_expires_at: string;
  credits: number;
}>) {
  const { data, error } = await supabase
    .from('profiles')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', userId)
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

// ─── Admin ──────────────────────────────────────────────────────────────────

export async function adminFetchUsers() {
  // Note: This requires the supabase user to have admin privileges
  // or a service_role key. For now, this fetches from profiles.
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data || [];
}

export async function adminFetchJobs() {
  const { data, error } = await supabase
    .from('jobs')
    .select('*, recruiter:profiles(*)')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data || [];
}

export async function adminFetchApplications() {
  const { data, error } = await supabase
    .from('applications')
    .select('*, job:jobs(*), applicant:profiles(*)')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data || [];
}

export async function adminUpdateUserRole(userId: string, role: string) {
  const { error } = await supabase
    .from('profiles')
    .update({ role })
    .eq('id', userId);
  if (error) throw error;
}

export async function adminToggleJobActive(id: string, isActive: boolean) {
  const { error } = await supabase
    .from('jobs')
    .update({ is_active: isActive })
    .eq('id', id);
  if (error) throw error;
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

export async function activatePremiumPlan(userId: string, planKey: string, amount: number) {
  const tier = planKey === 'basic' ? 'basic'
    : planKey === 'standard' ? 'standard'
    : planKey === 'premium' ? 'premium'
    : planKey === 'ai_monthly' || planKey === 'ai_annual' ? 'ai_tools'
    : planKey === 'service_verified' ? 'service_verified'
    : 'basic';

  const durationDays = planKey === 'basic' ? 7
    : planKey === 'standard' ? 14
    : planKey === 'premium' ? 30
    : planKey === 'ai_monthly' ? 30
    : planKey === 'ai_annual' ? 365
    : planKey === 'service_verified' ? 30
    : planKey === 'service_featured' ? 30
    : 7;

  const credits = planKey === 'basic' ? 1
    : planKey === 'standard' ? 1
    : planKey === 'premium' ? 3
    : 0;

  const now = new Date();
  const expiresAt = new Date(now.getTime() + durationDays * 24 * 60 * 60 * 1000).toISOString();

  const updates: Record<string, any> = {
    is_premium: true,
    subscription_tier: tier,
    subscription_expires_at: expiresAt,
    credits,
    updated_at: now.toISOString(),
  };

  if (planKey === 'service_verified') {
    updates.is_verified = true;
    updates.is_featured = false;
  } else if (planKey === 'service_featured') {
    updates.is_verified = true;
    updates.is_featured = true;
  }

  const { error } = await supabase
    .from('profiles')
    .update(updates)
    .eq('id', userId);

  if (error) throw error;
}
