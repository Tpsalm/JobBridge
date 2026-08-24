import { supabase, Job, JobAlert, Profile, Advertisement, SubscriptionInfo, Review } from "./supabase";

// ─── Jobs ───────────────────────────────────────────────────────────────────

export async function fetchJobs() {
  // Billing gates (defense-in-depth; mirrors the jobs RLS policy):
  //  - only active posts,
  //  - paid posts OR legacy posts that predate the billing columns,
  //  - not expired (one-time) OR still inside the grace window (recurring).
  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from("jobs")
    .select("*")
    .eq("is_active", true)
    .or(`post_paid.eq.true,post_plan.is.null`)
    .or(`post_expires_at.is.null,post_expires_at.gt.${now},grace_ends_at.gt.${now}`)
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
  post_plan?: string;
  post_paid?: boolean;
  billing_mode?: string;
  post_expires_at?: string;
}) {
  const { data, error } = await supabase
    .from("jobs")
    .insert([
      {
        ...job,
        is_featured: job.is_featured ?? false,
        is_active: job.is_active ?? true,
        post_paid: job.post_paid ?? true,
        billing_mode: job.billing_mode ?? "one_time",
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
    post_plan: string;
    post_paid: boolean;
    billing_mode: string;
    post_expires_at: string;
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
    .select("*, job:jobs!inner(*), applicant:profiles(*)")
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
  // Prefer the server-side API because RLS on service_providers only allows
  // admin reads by default. The API uses the service role key so all visitors
  // (signed in or not) can see the provider directory.
  try {
    const resp = await fetch('/api/get-providers');
    if (resp.ok) {
      const json = await resp.json();
      if (Array.isArray(json) && json.length > 0) {
        return json as Profile[];
      }
    }
    console.warn('[fetchProviders] /api/get-providers failed or empty:', resp.status);
  } catch (e) {
    console.warn('[fetchProviders] /api/get-providers network error:', e);
  }

  // Client-side fallbacks if the API is unreachable.
  const mapServiceProvider = (record: any): Profile => {
    const profile = record.profile || {};
    return {
      id: profile.id || record.profile_id || record.id,
      email: profile.email || '',
      full_name: profile.full_name || '',
      role: profile.role || 'provider',
      company: profile.company,
      phone: profile.phone,
      avatar_url: profile.avatar_url,
      cover_url: profile.cover_url,
      location: profile.location,
      bio: profile.bio,
      is_premium: profile.is_premium,
      subscription_tier: profile.subscription_tier,
      subscription_expires_at: profile.subscription_expires_at,
      profile_reminder_sent_at: profile.profile_reminder_sent_at,
      credits: profile.credits,
      created_at: profile.created_at || record.created_at,
      updated_at: profile.updated_at || record.updated_at,
      specialty: record.specialty || profile.specialty || profile.service_category,
      hourly_rate: record.hourly_rate ?? profile.hourly_rate,
      reviews_count: record.reviews_count ?? profile.reviews_count ?? 0,
      rating: record.rating ?? 0,
      is_verified: record.is_verified ?? profile.is_verified ?? false,
      is_featured: profile.is_featured ?? false,
      is_active: profile.is_active ?? true,
      service_category: profile.service_category,
      skills: profile.skills || [],
      subscription: profile.subscription as SubscriptionInfo | undefined,
    } as Profile;
  };

  try {
    const { data, error } = await supabase
      .from('service_providers')
      .select('*, profile:profiles(*)');

    if (!error && Array.isArray(data) && data.length > 0) {
      const providers = data.map(mapServiceProvider);
      providers.sort((a, b) => {
        if ((b.is_featured ? 1 : 0) !== (a.is_featured ? 1 : 0)) {
          return (b.is_featured ? 1 : 0) - (a.is_featured ? 1 : 0);
        }
        if ((b.is_verified ? 1 : 0) !== (a.is_verified ? 1 : 0)) {
          return (b.is_verified ? 1 : 0) - (a.is_verified ? 1 : 0);
        }
        return (b.reviews_count || 0) - (a.reviews_count || 0);
      });
      return providers;
    }

    if (error) {
      console.warn('[fetchProviders] service_providers client fetch failed:', error);
    }
  } catch (e) {
    console.warn('[fetchProviders] service_providers client fetch failed, attempting fallback', e);
  }

  try {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('role', 'provider')
      .order('is_featured', { ascending: false })
      .order('is_verified', { ascending: false })
      .order('reviews_count', { ascending: false });

    if (!error && Array.isArray(data) && data.length > 0) {
      return data as Profile[];
    }

    if (error) {
      console.warn('[fetchProviders] profiles client fetch failed:', error);
    }
  } catch (e) {
    console.warn('[fetchProviders] profiles client fetch failed', e);
  }

  return [] as Profile[];
}

export async function updateProfile(
  userId: string,
  updates: Record<string, unknown>,
) {
  // First, try to update with .select() to return the updated row
  const { data, error } = await supabase
    .from("profiles")
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq("id", userId)
    .select()
    .maybeSingle();

  // If select failed (e.g. RLS blocks read-back, or column not found),
  // try a simple update without select
  if (error) {
    console.warn("[updateProfile] Update with select failed, retrying without select:", error.message);
    const { error: silentError } = await supabase
      .from("profiles")
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq("id", userId);
    
    if (silentError) {
      // If still failing, try column by column removing unknown columns
      console.warn("[updateProfile] Silent update also failed:", silentError.message);
      
      // Final fallback: remove profile_sections and retry
      const safeUpdates = { ...updates };
      delete safeUpdates.profile_sections;
      
      const { error: fallbackError } = await supabase
        .from("profiles")
        .update({ ...safeUpdates, updated_at: new Date().toISOString() })
        .eq("id", userId);
      
      if (fallbackError) throw fallbackError;
    }
  }

  return data || null;
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
    .insert([{ email: normalizedEmail }]);

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
  if (!reference) return null;
  const conditions = `reference.eq.${reference},provider_reference.eq.${reference}`;
  const { data, error } = await supabase
    .from("payments")
    .select("*")
    .or(conditions)
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

export async function fetchConversations(userId: string) {
  try {
    const resp = await fetch(`/api/get-conversations?userId=${encodeURIComponent(userId)}`);
    if (resp.ok) {
      const json = await resp.json();
      if (Array.isArray(json)) {
        return json;
      }
    }
    console.warn('[fetchConversations] API failed, falling back to direct query:', resp.status);
  } catch (e) {
    console.warn('[fetchConversations] API network error, falling back to direct query:', e);
  }

  const { data, error } = await supabase
    .from('conversations')
    .select('*, participant1:profiles(id, full_name, email), participant2:profiles(id, full_name, email)')
    .or(`participant1_id.eq.${userId},participant2_id.eq.${userId}`)
    .order('last_message_at', { ascending: false });
  if (error) throw error;
  const conversations = data || [];

  // Fallback unread counts (the API path computes these server-side; mirror
  // them here so the WhatsApp-style unread badge works even without the API).
  try {
    const { data: unreadRows, error: unreadError } = await supabase
      .from('messages')
      .select('conversation_id')
      .eq('recipient_id', userId)
      .eq('is_read', false);
    if (!unreadError && Array.isArray(unreadRows)) {
      const unreadCounts: Record<string, number> = {};
      for (const row of unreadRows) {
        if (row?.conversation_id) {
          unreadCounts[row.conversation_id] = (unreadCounts[row.conversation_id] || 0) + 1;
        }
      }
      for (const conv of conversations) {
        (conv as any).unread_count = unreadCounts[conv.id] || 0;
      }
    }
  } catch (e) {
    console.warn('[fetchConversations] unread count fallback failed:', e);
  }

  return conversations;
}

export async function fetchConversationMessages(conversationId: string) {
  try {
    const resp = await fetch(`/api/get-conversation-messages?conversationId=${encodeURIComponent(conversationId)}`);
    if (resp.ok) {
      const json = await resp.json();
      if (Array.isArray(json)) {
        return json;
      }
    }
    console.warn('[fetchConversationMessages] API failed, falling back to direct query:', resp.status);
  } catch (e) {
    console.warn('[fetchConversationMessages] API network error, falling back to direct query:', e);
  }

  const { data, error } = await supabase
    .from('messages')
    .select('*')
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: true });
  if (error) throw error;
  return data || [];
}

export async function fetchConversationById(conversationId: string) {
  try {
    const resp = await fetch(`/api/get-conversation-by-id?conversationId=${encodeURIComponent(conversationId)}`);
    if (resp.ok) {
      const json = await resp.json();
      if (json && json.id) {
        return json;
      }
    }
    console.warn('[fetchConversationById] API failed, falling back to direct query:', resp.status);
  } catch (e) {
    console.warn('[fetchConversationById] API network error, falling back to direct query:', e);
  }

  const { data, error } = await supabase
    .from('conversations')
    .select('*, participant1:profiles(id, full_name, email), participant2:profiles(id, full_name, email)')
    .eq('id', conversationId)
    .maybeSingle();
  if (error) throw error;
  return data;
}

async function findOrCreateConversation(participant1_id: string, participant2_id: string) {
  if (!participant1_id || !participant2_id || participant1_id === participant2_id) {
    throw new Error('Invalid conversation participants');
  }

  const ordered = [participant1_id, participant2_id].sort();
  const participantsFilter = `or(and(participant1_id.eq.${ordered[0]},participant2_id.eq.${ordered[1]}),and(participant1_id.eq.${ordered[1]},participant2_id.eq.${ordered[0]}))`;

  const { data: existingConversation, error: selectError } = await supabase
    .from("conversations")
    .select("*")
    .or(participantsFilter)
    .maybeSingle();

  if (selectError) {
    throw selectError;
  }

  if (existingConversation) {
    return existingConversation;
  }

  const { data: insertedConversation, error: insertError } = await supabase
    .from("conversations")
    .insert([
      {
        participant1_id: participant1_id,
        participant2_id: participant2_id,
        last_message: null,
        last_message_at: null,
      },
    ])
    .select()
    .single();

  // The DB has a UNIQUE index on LEAST/GREATEST(participant1_id,
  // participant2_id) which guarantees ONE thread per pair. If a concurrent
  // request created the thread first (unique violation 23505), fall back to
  // fetching it instead of failing — never create a second thread.
  if (insertError && insertError.code === '23505') {
    const { data: racedConversation, error: racedError } = await supabase
      .from("conversations")
      .select("*")
      .or(participantsFilter)
      .maybeSingle();
    if (racedError) throw racedError;
    if (racedConversation) return racedConversation;
  }

  if (insertError) {
    throw insertError;
  }

  return insertedConversation;
}

/**
 * Mark every incoming (recipient) message in a conversation as read — the
 * WhatsApp-style "Seen" receipt. Uses the SECURITY DEFINER RPC because the
 * messages UPDATE policy intentionally only lets the SENDER edit their own
 * row; this function flips is_read ONLY on messages addressed to the caller.
 */
export async function markConversationRead(conversationId: string, readerId: string) {
  if (!conversationId || !readerId) return;
  try {
    const { error } = await supabase.rpc("mark_conversation_read", {
      p_conversation_id: conversationId,
      p_reader_id: readerId,
    });
    if (error) {
      console.warn('[markConversationRead] RPC failed:', error.message);
    }
  } catch (e) {
    console.warn('[markConversationRead] RPC error:', e);
  }
}

export async function createConversationMessage(params: {
  senderId: string;
  senderName: string;
  recipientId: string;
  recipientName: string;
  recipientEmail?: string;
  message: string;
}): Promise<string | null> {
  const { senderId, senderName, recipientId, recipientName, recipientEmail, message } = params;

  if (!senderId || !recipientId || senderId === recipientId) {
    throw new Error('Invalid message recipients');
  }

  // Try the API endpoint first (uses service role key, bypasses RLS)
  try {
    const resp = await fetch('/api/send-message', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        senderId,
        senderName,
        recipientId,
        recipientName,
        recipientEmail,
        message,
      }),
    });

    if (resp.ok) {
      const json = await resp.json();
      if (json?.success && json?.conversationId) {
        return json.conversationId;
      }
    }
    console.warn('[createConversationMessage] API failed, falling back to direct query:', resp.status);
  } catch (e) {
    console.warn('[createConversationMessage] API network error, falling back to direct query:', e);
  }

  // Fallback: use direct Supabase queries
  // Find or create the conversation and persist the message. Fail loudly so the
  // UI never reports a "sent" message that was actually lost.
  const conversation = await findOrCreateConversation(senderId, recipientId);
  if (!conversation?.id) {
    throw new Error('Could not create or find conversation');
  }
  const conversationId: string = conversation.id;

  const { error: updateError } = await supabase
    .from('conversations')
    .update({
      last_message: message,
      last_message_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', conversationId);
  if (updateError) {
    // A server-side trigger keeps last_message in sync, so this failure is not
    // fatal — but it must never be silently ignored.
    console.warn('[createConversationMessage] conversation update failed (trigger will sync):', updateError);
  }

  const { data: insertedMessage, error: insertError } = await supabase
    .from('messages')
    .insert([
      {
        conversation_id: conversationId,
        sender_id: senderId,
        sender_name: senderName,
        recipient_id: recipientId,
        recipient_name: recipientName,
        content: message,
        is_read: false,
      },
    ])
    .select()
    .single();

  if (insertError || !insertedMessage) {
    throw insertError || new Error('Message could not be persisted');
  }

  // Build notification payloads and send them via a secure server-side
  // endpoint so inserts use the Supabase service role (bypassing RLS).
  // UNIFIED CHAT SPACE rule: message content lives ONLY inside the dedicated
  // thread. Notifications are a "you have a new message" signal and never
  // embed the message text, so no preview leaks outside the chat view.
  const recipientNotification = {
    user_id: recipientId,
    type: 'message',
    title: `New message from ${senderName}`,
    content: 'You have a new message. Open Messages to read and reply.',
    data: {
      conversation_id: conversationId,
      sender_id: senderId,
      recipient_id: recipientId,
      direction: 'incoming',
      related_id: senderId,
      sender_name: senderName,
      recipient_name: recipientName,
    },
  };

  const senderNotification = {
    user_id: senderId,
    type: 'message',
    title: `Message sent to ${recipientName}`,
    content: 'Your message was sent. Open Messages to continue the chat.',
    data: {
      conversation_id: conversationId,
      sender_id: senderId,
      recipient_id: recipientId,
      direction: 'outgoing',
      related_id: recipientId,
      sender_name: senderName,
      recipient_name: recipientName,
    },
  };

  try {
    // Call server endpoint to create notifications with service role key
    await fetch('/api/create-notification', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(recipientNotification),
    });
  } catch (e) {
    console.warn('[createConversationMessage] failed to create recipient notification via API:', e);
  }

  try {
    await fetch('/api/create-notification', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(senderNotification),
    });
  } catch (e) {
    console.warn('[createConversationMessage] failed to create sender notification via API:', e);
  }

  if (recipientEmail) {
    try {
      await import('./email').then(({ sendEmail }) =>
        sendEmail({
          type: 'message_alert',
          email: recipientEmail,
          name: recipientName,
        }),
      );
    } catch (emailError) {
      console.warn('[createConversationMessage] email alert failed:', emailError);
    }
  }

  return conversationId;
}

export async function createAdvertisement(ad: {
  owner_id: string;
  business_name: string;
  title: string;
  description: string;
  category: string;
  package: string;
  is_featured?: boolean;
  image_url?: string | null;
  website_url?: string | null;
  phone?: string | null;
  email?: string | null;
  starts_at?: string | null;
  expires_at?: string | null;
  amount_paid?: number | null;
}) {
  const payload = {
    owner_id: ad.owner_id,
    business_name: ad.business_name,
    title: ad.title,
    description: ad.description,
    category: ad.category,
    package: ad.package,
    is_featured: ad.is_featured ?? false,
    image_url: ad.image_url || null,
    website_url: ad.website_url || null,
    phone: ad.phone || null,
    email: ad.email || null,
    starts_at: ad.starts_at || new Date().toISOString(),
    expires_at: ad.expires_at || null,
    status: 'active',
    views: 0,
    clicks: 0,
    payment_status: 'paid',
    amount_paid: ad.amount_paid ?? null,
  };

  const { data, error } = await supabase
    .from('advertisements')
    .insert([payload])
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function fetchAdvertisementsByOwner(ownerId: string) {
  const { data, error } = await supabase
    .from('advertisements')
    .select('*')
    .eq('owner_id', ownerId)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return (data || []) as Advertisement[];
}

// Public marketplace: returns ACTIVE advertisements created by business users
// who subscribed to the Business Advertisement package. These should be visible
// to EVERY user — both new and existing accounts. Tries the service-role API
// first (bypasses RLS so even anonymous/new users can see them), then falls
// back to a direct query for environments where the endpoint is unavailable.
export async function fetchPublicAdvertisements() {
  try {
    const resp = await fetch('/api/get-advertisements');
    if (resp.ok) {
      const json = await resp.json();
      if (Array.isArray(json)) {
        return json as Advertisement[];
      }
    }
    console.warn('[fetchPublicAdvertisements] API failed, falling back to direct query:', resp.status);
  } catch (e) {
    console.warn('[fetchPublicAdvertisements] API network error, falling back to direct query:', e);
  }

  // Auto-expiry: only return adverts whose paid duration (expires_at) has not
  // elapsed. Adverts without an expiry (legacy rows) remain visible.
  const nowIso = new Date().toISOString();
  const { data, error } = await supabase
    .from('advertisements')
    .select('*')
    .eq('status', 'active')
    .or(`expires_at.is.null,expires_at.gte.${nowIso}`)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return (data || []) as Advertisement[];
}

export async function updateAdvertisement(
  id: string,
  updates: Partial<{
    business_name: string;
    title: string;
    description: string;
    category: string;
    package: string;
    is_featured: boolean;
    image_url?: string | null;
    website_url?: string | null;
    phone?: string | null;
    email?: string | null;
    status: string;
    starts_at?: string | null;
    expires_at?: string | null;
    amount_paid?: number | null;
  }>,
) {
  const { data, error } = await supabase
    .from('advertisements')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function deleteAdvertisement(id: string) {
  const { error } = await supabase.from('advertisements').delete().eq('id', id);
  if (error) throw error;
}

/**
 * Track an advert impression. Uses a SECURITY DEFINER RPC so views can be
 * counted even when the viewer is anonymous / a brand-new user (the direct
 * UPDATE path is blocked by RLS for non-owners).
 */
export async function incrementAdvertisementViews(id: string) {
  try {
    const { error } = await supabase.rpc('increment_advertisement_views', { ad_id: id });
    if (error) console.warn('[incrementAdvertisementViews] RPC failed:', error.message);
  } catch (e) {
    console.warn('[incrementAdvertisementViews] failed:', e);
  }
}

/**
 * Track an advert click (e.g. tapping "Call", "Visit website" or "Email").
 * Uses a SECURITY DEFINER RPC for the same RLS-bypass reason as views.
 */
export async function incrementAdvertisementClicks(id: string) {
  try {
    const { error } = await supabase.rpc('increment_advertisement_clicks', { ad_id: id });
    if (error) console.warn('[incrementAdvertisementClicks] RPC failed:', error.message);
  } catch (e) {
    console.warn('[incrementAdvertisementClicks] failed:', e);
  }
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

export async function createNotification(notification: {
  user_id: string;
  type: string;
  title: string;
  content: string;
  data?: Record<string, unknown>;
}) {
  try {
    const { data, error } = await supabase
      .from("notifications")
      .insert([
        {
          user_id: notification.user_id,
          type: notification.type,
          title: notification.title,
          content: notification.content,
          data: notification.data || {},
          is_read: false,
        }
      ])
      .select()
      .single();
    
    if (error) throw error;
    return data;
  } catch (error) {
    console.error('[createNotification] error:', error);
    throw error;
  }
}

export async function activateSubscription(userId: string, plan: string, credits: number, durationDays: number) {
  const now = new Date().toISOString();
  const expiresAt = new Date(Date.now() + durationDays * 24 * 60 * 60 * 1000).toISOString();
  const { error } = await supabase
    .from("profiles")
    .update({
      is_premium: true,
      subscription_tier: plan,
      subscription_expires_at: expiresAt,
      credits: credits,
      updated_at: now,
    })
    .eq("id", userId);
  if (error) {
    console.error("[activateSubscription] error:", error);
    throw error;
  }
}

export async function activateAiSubscription(userId: string, durationDays: number) {
  const now = new Date().toISOString();
  const expiresAt = new Date(Date.now() + durationDays * 24 * 60 * 60 * 1000).toISOString();
  const { error } = await supabase
    .from("profiles")
    .update({
      is_premium: true,
      subscription_tier: "ai_tools",
      subscription_expires_at: expiresAt,
      credits: 0,
      updated_at: now,
    })
    .eq("id", userId);
  if (error) {
    console.error("[activateAiSubscription] error:", error);
    throw error;
  }
}

export async function addCredits(userId: string, creditsToAdd: number) {
  const { data: profile, error: fetchError } = await supabase
    .from("profiles")
    .select("credits")
    .eq("id", userId)
    .maybeSingle();
  if (fetchError) throw fetchError;
  const currentCredits = profile?.credits || 0;
  const newCredits = currentCredits + creditsToAdd;
  const { error: updateError } = await supabase
    .from("profiles")
    .update({ credits: newCredits, updated_at: new Date().toISOString() })
    .eq("id", userId);
  if (updateError) throw updateError;
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

// ─── Reviews & Star Ratings ────────────────────────────────────────────────

export type NewReviewInput = {
  reviewerId: string;
  reviewerName: string;
  revieweeId: string;
  providerId?: string | null;
  targetType?: "provider" | "business" | "profile";
  rating: number;
  comment: string;
};

/** Fetch reviews, optionally filtered to a single target profile. */
export async function fetchReviews(revieweeId?: string): Promise<Review[]> {
  let query = supabase
    .from("reviews")
    .select(
      "*, reviewee:profiles!reviews_reviewee_id_fkey(id, full_name, avatar_url)",
    )
    .order("created_at", { ascending: false });

  if (revieweeId) {
    query = query.eq("reviewee_id", revieweeId);
  }

  const { data, error } = await query;
  if (error) {
    console.warn("[fetchReviews] error:", error);
    return [];
  }

  return (data || []).map((r: any) => ({
    id: r.id,
    reviewer_id: r.reviewer_id,
    reviewer_name: r.reviewer_name || "",
    reviewee_id: r.reviewee_id,
    provider_id: r.provider_id,
    target_type: r.target_type,
    rating: r.rating,
    comment: r.comment || "",
    created_at: r.created_at,
    updated_at: r.updated_at,
    reviewee_name: r.reviewee?.full_name || "",
    reviewee_avatar: r.reviewee?.avatar_url || "",
  }));
}

/** Check whether a user has already reviewed a target (for one-review limits). */
export async function fetchMyReviewForTarget(
  reviewerId: string,
  revieweeId: string,
): Promise<Review | null> {
  const { data, error } = await supabase
    .from("reviews")
    .select("*")
    .eq("reviewer_id", reviewerId)
    .eq("reviewee_id", revieweeId)
    .maybeSingle();

  if (error) {
    console.warn("[fetchMyReviewForTarget] error:", error);
    return null;
  }
  return (data as Review) || null;
}

/** Create a new review (star rating + comment). */
export async function createReview(input: NewReviewInput) {
  const { error } = await supabase.from("reviews").insert({
    reviewer_id: input.reviewerId,
    reviewer_name: input.reviewerName,
    reviewee_id: input.revieweeId,
    provider_id: input.providerId || null,
    target_type: input.targetType || "provider",
    rating: input.rating,
    comment: input.comment,
  });
  if (error) throw error;
}

/** Update an existing review's rating/comment. */
export async function updateReview(
  id: string,
  updates: { rating?: number; comment?: string },
) {
  const { error } = await supabase
    .from("reviews")
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw error;
}

/** Delete a review (the reviewer or an admin). */
export async function deleteReview(id: string) {
  const { error } = await supabase.from("reviews").delete().eq("id", id);
  if (error) throw error;
}
