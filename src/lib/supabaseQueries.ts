import { supabase, Job, JobAlert, Profile } from "./supabase";

// ─── Jobs ───────────────────────────────────────────────────────────────────

export async function fetchJobs() {
  const { data, error } = await supabase
    .from("jobs")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data || [];
}

export async function fetchJobById(id: string) {
  const { data, error } = await supabase
    .from("jobs")
    .select("*")
    .eq("id", id)
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
    .from("jobs")
    .insert([
      {
        ...job,
        is_featured: job.is_featured ?? false,
        is_active: job.is_active ?? true,
        views: 0,
        applications_count: 0,
      },
    ])
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function updateJob(
  id: string,
  updates: Partial<{
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
  }>,
) {
  const { data, error } = await supabase
    .from("jobs")
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq("id", id)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function deleteJob(id: string) {
  const { error } = await supabase.from("jobs").delete().eq("id", id);
  if (error) throw error;
}

export async function incrementJobViews(id: string, currentViews: number) {
  const { error } = await supabase
    .from("jobs")
    .update({ views: (currentViews || 0) + 1 })
    .eq("id", id);
  if (error) throw error;
}

// ─── Applications ───────────────────────────────────────────────────────────

export async function fetchApplications(recruiterId?: string) {
  let query = supabase
    .from("applications")
    .select("*, job:jobs(*), applicant:profiles(*)")
    .order("created_at", { ascending: false });
  if (recruiterId) {
    query = query.eq("job.recruiter_id", recruiterId);
  }
  const { data, error } = await query;
  if (error) throw error;
  return data || [];
}

export async function fetchUserApplications(userId: string) {
  const { data, error } = await supabase
    .from("applications")
    .select("*, job:jobs(*)")
    .eq("applicant_id", userId)
    .order("created_at", { ascending: false });
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
    .from("applications")
    .insert([{ ...app, status: "pending" }])
    .select()
    .single();
  if (error) throw error;
  // Increment applications_count on the job
  await supabase.rpc("increment_applications_count", { job_id: app.job_id });
  return data;
}

export async function updateApplicationStatus(id: string, status: string) {
  const { data, error } = await supabase
    .from("applications")
    .update({ status, updated_at: new Date().toISOString() })
    .eq("id", id)
    .select()
    .single();
  if (error) throw error;
  return data;
}

// ─── Profiles ───────────────────────────────────────────────────────────────

export async function fetchProfile(userId: string) {
  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", userId)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function fetchProviders() {
  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("role", "provider")
    .order("is_featured", { ascending: false })
    .order("is_verified", { ascending: false })
    .order("reviews_count", { ascending: false });
  if (error) throw error;
  return (data || []) as Profile[];
}

export async function updateProfile(
  userId: string,
  updates: Record<string, unknown>,
) {
  const { data, error } = await supabase
    .from("profiles")
    .upsert(
      { id: userId, ...updates, updated_at: new Date().toISOString() },
      { onConflict: "id" },
    )
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
    .from("profiles")
    .upsert(profile, { onConflict: "id" })
    .select()
    .single();
  if (error) throw error;
  return data;
}

// ─── Blog Subscriptions ────────────────────────────────────────────────────

export async function subscribeToBlog(email: string) {
  const normalizedEmail = email.trim().toLowerCase();
  const { error } = await supabase
    .from("blog_subscribers")
    .upsert([{ email: normalizedEmail }], { onConflict: "email" });

  if (error) {
    // Treat unique constraint as success so repeated subscriptions don't fail the UI.
    if (error.code === "23505") {
      return;
    }
    throw error;
  }
}

// ─── Payments ───────────────────────────────────────────────────────────────

export async function recordPayment(payment: {
  user_id: string;
  plan: string;
  amount: number;
  reference: string;
  status: string;
  currency?: string;
  provider_reference?: string | null;
  metadata?: Record<string, unknown>;
}) {
  const { data, error } = await supabase
    .from("payments")
    .insert([payment])
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function fetchPaymentByReference(reference: string) {
  const { data, error } = await supabase
    .from("payments")
    .select("*")
    .eq("reference", reference)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function fetchNotifications(userId: string) {
  const { data, error } = await supabase
    .from("notifications")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data || [];
}

export type JobAlertSeed = Pick<JobAlert, "query" | "location" | "enabled">;
export type JobAlertWithCount = JobAlert & { count: number };

type JobAlertJobCandidate = Pick<
  Job,
  | "id"
  | "title"
  | "company"
  | "description"
  | "location"
  | "expires_at"
  | "is_active"
>;

function normalizeMatchValue(value?: string | null) {
  return (value || "").trim().toLowerCase();
}

function isJobOpen(
  job: Pick<JobAlertJobCandidate, "expires_at" | "is_active">,
) {
  if (!job.is_active) return false;
  if (!job.expires_at) return true;

  const expiresAt = new Date(job.expires_at);
  if (Number.isNaN(expiresAt.getTime())) return true;

  return expiresAt.getTime() >= Date.now();
}

function matchesJobAlert(
  job: Pick<
    JobAlertJobCandidate,
    "title" | "company" | "description" | "location"
  >,
  alert: Pick<JobAlert, "query" | "location">,
) {
  const query = normalizeMatchValue(alert.query);
  const location = normalizeMatchValue(alert.location);
  const searchableText = [job.title, job.company, job.description || ""]
    .join(" ")
    .toLowerCase();
  const jobLocation = normalizeMatchValue(job.location);

  const queryMatches = !query || searchableText.includes(query);
  const locationMatches = !location || jobLocation.includes(location);

  return queryMatches && locationMatches;
}

export async function fetchJobAlerts(userId: string) {
  const { data, error } = await supabase
    .from("job_alerts")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return (data || []) as JobAlert[];
}

export async function seedDefaultJobAlerts(
  userId: string,
  defaults: JobAlertSeed[],
) {
  if (defaults.length === 0) return [];

  const payload = defaults.map((alert) => ({
    user_id: userId,
    query: alert.query,
    location: alert.location,
    enabled: alert.enabled ?? true,
  }));

  const { error } = await supabase
    .from("job_alerts")
    .upsert(payload, { onConflict: "user_id,query,location" });

  if (error) throw error;
  return fetchJobAlerts(userId);
}

export async function fetchJobAlertsWithCounts(
  userId: string,
  defaults: JobAlertSeed[] = [],
) {
  let alerts = await fetchJobAlerts(userId);

  if (alerts.length === 0 && defaults.length > 0) {
    alerts = await seedDefaultJobAlerts(userId, defaults);
  }

  if (alerts.length === 0) {
    return [] as JobAlertWithCount[];
  }

  const { data, error } = await supabase
    .from("jobs")
    .select("id, title, company, description, location, expires_at, is_active")
    .eq("is_active", true);

  if (error) throw error;

  const openJobs = ((data || []) as JobAlertJobCandidate[]).filter(isJobOpen);

  return alerts.map((alert) => ({
    ...alert,
    count: openJobs.filter((job) => matchesJobAlert(job, alert)).length,
  }));
}

export async function updateJobAlertEnabled(alertId: string, enabled: boolean) {
  const { data, error } = await supabase
    .from("job_alerts")
    .update({ enabled, updated_at: new Date().toISOString() })
    .eq("id", alertId)
    .select()
    .single();

  if (error) throw error;
  return data as JobAlert;
}

export async function fetchUnreadNotificationCount(userId: string) {
  const { count, error } = await supabase
    .from("notifications")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("is_read", false);
  if (error) throw error;
  return count || 0;
}

export async function markNotificationRead(notificationId: string) {
  const { data, error } = await supabase
    .from("notifications")
    .update({ is_read: true, read_at: new Date().toISOString() })
    .eq("id", notificationId)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function markAllNotificationsRead(userId: string) {
  const { error } = await supabase
    .from("notifications")
    .update({ is_read: true, read_at: new Date().toISOString() })
    .eq("user_id", userId)
    .eq("is_read", false);
  if (error) throw error;
}

export async function deleteNotification(notificationId: string) {
  const { error } = await supabase
    .from("notifications")
    .delete()
    .eq("id", notificationId);
  if (error) throw error;
}

export async function decrementCredits(userId: string) {
  const { error } = await supabase.rpc("decrement_credits", {
    user_id: userId,
  });
  if (error) {
    console.warn(
      "decrement_credits RPC failed, attempting direct update:",
      error,
    );
    // Direct fallback: read current credits and subtract 1
    const { data: profile, error: fetchError } = await supabase
      .from("profiles")
      .select("credits")
      .eq("id", userId)
      .maybeSingle();
    if (fetchError) throw fetchError;
    const currentCredits = profile?.credits || 0;
    const newCredits = Math.max(0, currentCredits - 1);
    const { error: updateError } = await supabase
      .from("profiles")
      .update({ credits: newCredits, updated_at: new Date().toISOString() })
      .eq("id", userId);
    if (updateError) throw updateError;
  }
}
