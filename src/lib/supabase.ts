// For this project we use a local, free backend (Express) instead of Supabase.
// Export `supabase` as null so existing code paths use the local API fallbacks.
export const supabase = null;

// Local API base url
// Uses relative path so requests go through Vite proxy in dev (eliminates CORS issues).
// Override via VITE_LOCAL_API_URL env var for custom/production API URLs.
export const LOCAL_API_URL = import.meta.env.VITE_LOCAL_API_URL || '';

// Helper: safely parse JSON from a response, providing a clear error on empty/invalid body
async function safeJson(res: Response): Promise<any> {
  const text = await res.text();
  if (!text) throw new Error(`Empty response from server (${res.status} ${res.statusText}). Make sure the backend server is running on port 5050.`);
  try {
    return JSON.parse(text);
  } catch {
    throw new Error(`Invalid JSON response (${res.status}): ${text.slice(0, 200)}`);
  }
}

// Supabase URL from env (may be undefined when using local-only mode)
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';

// Request an OTP via Supabase Edge Function `send-otp`.
export async function requestOtp({ email, phone, user_id, channel }: { email?: string; phone?: string; user_id?: string; channel?: 'email' | 'sms' }) {
  try {
    if (!supabase) {
      // Skip Supabase entirely, go straight to local API
      const local = await fetch(`${LOCAL_API_URL}/otp/request`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, phone, user_id, channel }),
      });
      return local.ok;
    }
    const functionsUrl = import.meta.env.VITE_SUPABASE_FUNCTIONS_URL || `${supabaseUrl}/functions/v1`;
    const res = await fetch(`${functionsUrl}/send-otp`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: import.meta.env.VITE_SUPABASE_ANON_KEY || '',
      },
      body: JSON.stringify({ email, phone, user_id, channel }),
    });
    if (!res.ok) {
      const local = await fetch(`${LOCAL_API_URL}/otp/request`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, phone, user_id, channel }),
      });
      return local.ok;
    }
    return res.ok;
  } catch (err) {
    console.error('requestOtp error', err);
    if (!supabase) {
      try {
        const local = await fetch(`${LOCAL_API_URL}/otp/request`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, phone, user_id, channel }),
        });
        return local.ok;
      } catch (e) {
        console.error('local requestOtp error', e);
      }
    }
    return false;
  }
}

// Request a welcome email via Supabase Function `send-welcome`.
export async function requestWelcomeEmail({ email, name, role }: { email: string; name?: string; role?: string }) {
  try {
    if (!supabase) {
      const local = await fetch(`${LOCAL_API_URL}/welcome`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, name, role }),
      });
      return local.ok;
    }
    const functionsUrl = import.meta.env.VITE_SUPABASE_FUNCTIONS_URL || `${supabaseUrl}/functions/v1`;
    const res = await fetch(`${functionsUrl}/send-welcome`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', apikey: import.meta.env.VITE_SUPABASE_ANON_KEY || '' },
      body: JSON.stringify({ email, name, role }),
    });
    if (!res.ok) {
      const local = await fetch(`${LOCAL_API_URL}/welcome`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, name, role }),
      });
      return local.ok;
    }
    return res.ok;
  } catch (err) {
    console.error('requestWelcomeEmail error', err);
    if (!supabase) {
      try {
        const local = await fetch(`${LOCAL_API_URL}/welcome`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, name, role }),
        });
        return local.ok;
      } catch (e) { console.error('local requestWelcomeEmail error', e); }
    }
    return false;
  }
}

// Create profile via Supabase Function `create-profile` using service role key
export async function requestCreateProfile({ id, email, full_name, role, company, phone }: { id: string; email: string; full_name?: string; role?: string; company?: string; phone?: string }) {
  try {
    if (!supabase) {
      // Skip Supabase, go straight to local API
      const local = await fetch(`${LOCAL_API_URL}/profile`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, email, full_name, role, company, phone }),
      });
      return local.ok;
    }
    const functionsUrl = import.meta.env.VITE_SUPABASE_FUNCTIONS_URL || `${supabaseUrl}/functions/v1`;
    const res = await fetch(`${functionsUrl}/create-profile`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: import.meta.env.VITE_SUPABASE_ANON_KEY || '',
      },
      body: JSON.stringify({ id, email, full_name, role, company, phone }),
    });
    if (!res.ok) {
      const local = await fetch(`${LOCAL_API_URL}/profile`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, email, full_name, role, company, phone }),
      });
      return local.ok;
    }
    return res.ok;
  } catch (err) {
    console.error('requestCreateProfile error', err);
    if (!supabase) {
      try {
        const local = await fetch(`${LOCAL_API_URL}/profile`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id, email, full_name, role, company, phone }),
        });
        return local.ok;
      } catch (e) {
        console.error('local requestCreateProfile error', e);
      }
    }
    return false;
  }
}

  // Local signup fallback using local API when Supabase is not configured
  export async function localSignUp({ email, password, full_name, role, company }: { email: string; password: string; full_name?: string; role?: string; company?: string }) {
    try {
      const res = await fetch(`${LOCAL_API_URL}/signup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, full_name, role, company }),
      });
      const json = await safeJson(res);
      if (!res.ok) throw new Error(json.error || 'Local signup failed');
      return { ok: true, data: json };
    } catch (err) {
      console.error('localSignUp error', err);
      return { ok: false, error: err };
    }
  }

// Verify OTP via Supabase Function `verify-otp`.
export async function verifyOtp({ email, phone, code }: { email?: string; phone?: string; code: string }) {
  try {
    if (!supabase) {
      // Skip Supabase, go straight to local API
      const local = await fetch(`${LOCAL_API_URL}/otp/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, phone, code }),
      });
      const json = await safeJson(local);
      return { ok: local.ok, ...json };
    }
    const functionsUrl = import.meta.env.VITE_SUPABASE_FUNCTIONS_URL || `${supabaseUrl}/functions/v1`;
    const res = await fetch(`${functionsUrl}/verify-otp`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: import.meta.env.VITE_SUPABASE_ANON_KEY || '',
      },
      body: JSON.stringify({ email, phone, code }),
    });
    const json = await safeJson(res);
    return { ok: res.ok, ...json };
  } catch (err) {
    console.error('verifyOtp error', err);
    return { ok: false, error: (err as Error).message || 'Failed to verify OTP' };
  }
}

export async function localLogin({ email, password }: { email: string; password: string }) {
  try {
    const res = await fetch(`${LOCAL_API_URL}/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    const json = await safeJson(res);
    if (!res.ok) throw new Error(json.error || 'Local login failed');
    return { ok: true, data: json };
  } catch (err) {
    console.error('localLogin error', err);
    return { ok: false, error: err };
  }
}

export async function localGetProfile(id: string) {
  try {
    const token = localStorage.getItem('jobbridge_token');
    const headers: Record<string, string> = {};
    if (token) headers['Authorization'] = `Bearer ${token}`;
    const res = await fetch(`${LOCAL_API_URL}/profile/${encodeURIComponent(id)}`, { headers });
    const json = await safeJson(res);
    if (!res.ok) throw new Error(json.error || 'Local profile fetch failed');
    return { ok: true, data: json };
  } catch (err) {
    console.error('localGetProfile error', err);
    return { ok: false, error: err };
  }
}

// Database types
export type SubscriptionInfo = {
  tier: string | null;
  status: 'active' | 'inactive' | 'expired';
  expires_at: string | null;
  credits: number;
};

export type AiSubscriptionInfo = {
  ai_tier: string | null;
  ai_status: 'active' | 'inactive' | 'expired';
  ai_expires_at: string | null;
};

export type Profile = {
  id: string;
  email: string;
  full_name: string;
  role: 'recruiter' | 'provider' | 'job_seeker';
  company?: string;
  phone?: string;
  avatar_url?: string;
  location?: string;
  bio?: string;
  subscription?: SubscriptionInfo;
  created_at: string;
  updated_at: string;
};

export type Job = {
  id: string;
  recruiter_id: string;
  title: string;
  company: string;
  description: string;
  location: string;
  type: 'Full-time' | 'Part-time' | 'Contract' | 'Freelance' | 'Internship';
  salary_range?: string;
  category: string;
  requirements: string[];
  benefits: string[];
  is_featured: boolean;
  is_active: boolean;
  expires_at: string;
  views: number;
  applications_count: number;
  created_at: string;
  updated_at: string;
};

export type JobApplication = {
  id: string;
  job_id: string;
  applicant_id: string;
  cover_letter?: string;
  resume_url?: string;
  status: 'pending' | 'reviewed' | 'shortlisted' | 'rejected' | 'hired' | 'withdrawn';
  recruiter_notes?: string;
  created_at: string;
  updated_at: string;
};

export type ServiceProvider = {
  id: string;
  profile_id: string;
  business_name: string;
  specialty: string;
  description?: string;
  skills: string[];
  hourly_rate?: number;
  location?: string;
  phone?: string;
  email?: string;
  website?: string;
  tier: 'basic' | 'verified' | 'featured';
  is_verified: boolean;
  is_active: boolean;
  rating: number;
  reviews_count: number;
  views: number;
  inquiries_count: number;
  subscription_expires_at?: string;
  created_at: string;
  updated_at: string;
};

export type Conversation = {
  id: string;
  participant1_id: string;
  participant2_id: string;
  job_id?: string;
  provider_id?: string;
  last_message_at: string;
  created_at: string;
};

export type Message = {
  id: string;
  conversation_id: string;
  sender_id: string;
  content: string;
  is_read: boolean;
  read_at?: string;
  created_at: string;
};

export type Advertisement = {
  id: string;
  owner_id: string;
  business_name: string;
  title: string;
  description: string;
  category: string;
  image_url?: string;
  website_url?: string;
  phone?: string;
  email?: string;
  location?: string;
  package: 'weekly' | 'monthly' | 'featured';
  is_featured: boolean;
  status: 'pending' | 'active' | 'paused' | 'expired' | 'rejected';
  views: number;
  clicks: number;
  starts_at?: string;
  expires_at?: string;
  payment_status: 'pending' | 'paid' | 'refunded';
  amount_paid: number;
  admin_notes?: string;
  created_at: string;
  updated_at: string;
};

export type Notification = {
  id: string;
  user_id: string;
  type: 'job_application' | 'message' | 'interview' | 'review' | 'system' | 'payment' | 'advert';
  title: string;
  content?: string;
  data: Record<string, unknown>;
  is_read: boolean;
  read_at?: string;
  created_at: string;
};
