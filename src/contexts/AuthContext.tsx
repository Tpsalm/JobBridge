import { createContext, useContext, useState, ReactNode, useEffect, useCallback } from 'react';
import { supabase as _supabaseClient, localSignUp, localLogin, localGetProfile, Profile, SubscriptionInfo, AiSubscriptionInfo, requestCreateProfile } from '../lib/supabase';
import { requestWelcomeEmail } from '../lib/supabase';
import { LOCAL_API_URL } from '../lib/supabase';

// Cast supabase to any so that TypeScript doesn't narrow it to `never`
// (it's exported as `null` when using the local backend).
const supabase = _supabaseClient as any;

export type UserRole = 'recruiter' | 'provider' | 'job_seeker' | 'admin' | null;

interface AuthContextType {
  user: any | null;
  profile: Profile | null;
  session: any | null;
  isAuthenticated: boolean;
  loading: boolean;
  subscription: SubscriptionInfo;
  fetchSubscription: () => Promise<void>;
  aiSubscription: AiSubscriptionInfo;
  fetchAiSubscription: () => Promise<void>;
  savedJobs: string[];
  appliedJobs: string[];
  toggleSaveJob: (jobId: string) => void;
  markApplied: (jobId: string) => void;
  signUp: (email: string, password: string, fullName: string, role: UserRole, company?: string) => Promise<{ error: Error | null }>;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  profile: null,
  session: null,
  isAuthenticated: false,
  loading: true,
  subscription: { tier: null, status: 'inactive', expires_at: null, credits: 0 },
  fetchSubscription: async () => {},
  aiSubscription: { ai_tier: null, ai_status: 'inactive', ai_expires_at: null },
  fetchAiSubscription: async () => {},
  savedJobs: [],
  appliedJobs: [],
  toggleSaveJob: () => {},
  markApplied: () => {},
  signUp: async () => ({ error: null }),
  signIn: async () => ({ error: null }),
  signOut: async () => {},
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<any | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [session, setSession] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [subscription, setSubscription] = useState<SubscriptionInfo>({ tier: null, status: 'inactive', expires_at: null, credits: 0 });
  const [aiSubscription, setAiSubscription] = useState<AiSubscriptionInfo>({ ai_tier: null, ai_status: 'inactive', ai_expires_at: null });
  const [savedJobs, setSavedJobs] = useState<string[]>(() => {
    try { return JSON.parse(localStorage.getItem('jobbridge_saved_jobs') || '[]'); } catch { return []; }
  });
  const [appliedJobs, setAppliedJobs] = useState<string[]>(() => {
    try { return JSON.parse(localStorage.getItem('jobbridge_applied_jobs') || '[]'); } catch { return []; }
  });

  const fetchSubscription = useCallback(async () => {
    const token = localStorage.getItem('jobbridge_token');
    if (!token) {
      setSubscription({ tier: null, status: 'inactive', expires_at: null, credits: 0 });
      return;
    }
    try {
      const res = await fetch(`${LOCAL_API_URL}/user/subscription`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const json = await res.json();
      if (json.success && json.subscription) {
        setSubscription(json.subscription);
      }
    } catch (err) {
      console.error('fetchSubscription error', err);
    }
  }, []);

  const fetchAiSubscription = useCallback(async () => {
    const token = localStorage.getItem('jobbridge_token');
    if (!token) {
      setAiSubscription({ ai_tier: null, ai_status: 'inactive', ai_expires_at: null });
      return;
    }
    try {
      const res = await fetch(`${LOCAL_API_URL}/user/ai-subscription`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const json = await res.json();
      if (json.success && json.ai_subscription) {
        setAiSubscription(json.ai_subscription);
      }
    } catch (err) {
      console.error('fetchAiSubscription error', err);
    }
  }, []);

  const toggleSaveJob = (jobId: string) => {
    setSavedJobs(prev => {
      const next = prev.includes(jobId) ? prev.filter(id => id !== jobId) : [...prev, jobId];
      localStorage.setItem('jobbridge_saved_jobs', JSON.stringify(next));
      return next;
    });
  };

  const markApplied = (jobId: string) => {
    setAppliedJobs(prev => {
      if (prev.includes(jobId)) return prev;
      const next = [...prev, jobId];
      localStorage.setItem('jobbridge_applied_jobs', JSON.stringify(next));
      return next;
    });
  };

  useEffect(() => {
    // If supabase client is available, use it for sessions; otherwise mark loading false
    if (supabase) {
      // Get initial session
      (supabase as any).auth.getSession().then(({ data }: any) => {
        const sess = data?.session;
        setSession(sess);
        setUser(sess?.user ?? null);
        if (sess?.user) {
          fetchProfile(sess.user.id);
        } else {
          setLoading(false);
        }
      });

      // Listen for auth changes
      const { data: { subscription } } = (supabase as any).auth.onAuthStateChange((_event: any, sess: any) => {
        setSession(sess);
        setUser(sess?.user ?? null);
        if (sess?.user) {
          fetchProfile(sess.user.id);
        } else {
          setProfile(null);
          setLoading(false);
        }
      });

      return () => subscription.unsubscribe();
    } else {
      // No Supabase — check localStorage token for persisted login
      const token = localStorage.getItem('jobbridge_token');
      const storedUser = localStorage.getItem('jobbridge_user');
      if (token && storedUser) {
        try {
          const u = JSON.parse(storedUser);
          setUser(u);
          setProfile(u);
          fetchSubscription();
          fetchAiSubscription();
        } catch { /* ignore */ }
      }
      setLoading(false);
    }
    fetchAiSubscription();
  }, []);

  const fetchProfile = async (userId: string) => {
    if (supabase) {
      const { data, error } = await (supabase as any)
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .maybeSingle();

      if (error) {
        console.error('Error fetching profile:', error);
      } else {
        setProfile(data);
      }
    } else {
      const r = await localGetProfile(userId);
      if (r.ok) {
        setProfile(r.data.profile);
      } else {
        console.error('Error fetching local profile', r.error);
      }
    }
    setLoading(false);
  };

  const signUp = async (
    email: string,
    password: string,
    fullName: string,
    role: UserRole,
    company?: string
  ) => {
    try {
      if (supabase) {
        const { data, error } = await (supabase as any).auth.signUp({
          email,
          password,
          options: {
            data: {
              full_name: fullName,
              role: role || 'job_seeker',
              company: company || null,
            },
          },
        });
        if (error) throw error;

        // If the signup returned a user id, proactively create the profile via service-role function
        const userId = (data as any)?.user?.id;
        if (userId) {
          try {
            await requestCreateProfile({ id: userId, email, full_name: fullName, role: role || undefined, company });
          } catch (err) {
            console.error('Failed to create profile via function', err);
          }
        }
      } else {
        // Use local fallback API
        const r = await localSignUp({ email, password, full_name: fullName, role: role || undefined, company });
        if (!r.ok) {
          const errMsg = (r.error && ((r.error as any).message || String(r.error))) || 'Local signup failed';
          if (errMsg.includes('Failed to fetch') || errMsg.includes('fetch') || errMsg.includes('Empty response') || errMsg.includes('Unexpected end')) {
            throw new Error('Cannot connect to server. Please make sure the backend server is running (cd server && node index.js).');
          }
          throw new Error(errMsg);
        }
      }

      // Send welcome email for recruiters/providers (non-blocking)
      if (role === 'recruiter' || role === 'provider') {
        requestWelcomeEmail({ email, name: fullName, role: role || undefined }).catch(() => {});
      }
      return { error: null };
    } catch (error) {
      return { error: error as Error };
    }
  };

  const signIn = async (email: string, password: string) => {
    try {
      if (supabase) {
        const { error } = await (supabase as any).auth.signInWithPassword({ email, password });
        if (error) throw error;
        return { error: null };
      } else {
        const r = await localLogin({ email, password });
        if (!r.ok) throw new Error(((r.error as any)?.message) || 'Local login failed');
        const userObj = (r.data && r.data.user) || null;
        if (userObj) {
          setUser(userObj as any);
          setProfile(userObj as any);
          localStorage.setItem('jobbridge_user', JSON.stringify(userObj));
          fetchSubscription();
        }
        // store token
        if (r.data && r.data.token) {
          try { localStorage.setItem('jobbridge_token', r.data.token); } catch { /* noop */ }
        }
        return { error: null };
      }
    } catch (error) {
      return { error: error as Error };
    }
  };

  const signOut = async () => {
    if (supabase) await (supabase as any).auth.signOut();
    setUser(null);
    setProfile(null);
    setSession(null);
    localStorage.removeItem('jobbridge_token');
    localStorage.removeItem('jobbridge_user');
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        profile,
        session,
        isAuthenticated: !!user,
        loading,
        subscription,
        fetchSubscription,
        aiSubscription,
        fetchAiSubscription,
        savedJobs,
        appliedJobs,
        toggleSaveJob,
        markApplied,
        signUp,
        signIn,
        signOut,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
