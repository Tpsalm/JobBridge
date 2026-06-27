import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

function createErrorClient(message: string) {
  const error = () => { throw new Error(message); };
  return {
    auth: {
      getSession: error,
      signUp: error,
      signInWithPassword: error,
      signOut: error,
      onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => {} } } }),
      verifyOtp: error,
    },
    from: () => ({ select: error, insert: error, update: error, delete: error, upsert: error }),
    storage: { from: () => ({ upload: error, getPublicUrl: error, download: error, list: error, remove: error }) },
  } as any;
}

export const supabase = supabaseUrl && supabaseAnonKey
  ? createClient(supabaseUrl, supabaseAnonKey)
  : createErrorClient('VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY must be set in your environment. Add them as GitHub Actions secrets or create a .env.production file.');

// All features now use Supabase directly. VITE_LOCAL_API_URL is no longer needed.

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
  cover_url?: string;
  location?: string;
  bio?: string;
  date_of_birth?: string;
  gender?: string;
  is_disabled?: string;
  is_displaced?: string;
  professional_headline?: string;
  years_of_experience?: string;
  function?: string;
  work_type?: string;
  highest_qualification?: string;
  availability?: string;
  salary_expectation?: string;
  specialty?: string;
  hourly_rate?: number;
  skills?: string[];
  is_verified?: boolean;
  is_featured?: boolean;
  reviews_count?: number;
  is_active?: boolean;
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
