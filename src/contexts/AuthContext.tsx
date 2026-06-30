import { createContext, useContext, useState, ReactNode, useEffect, useCallback, useRef } from 'react';
import { supabase, Profile, SubscriptionInfo, AiSubscriptionInfo } from '../lib/supabase';
import { fetchUserApplications } from '../lib/supabaseQueries';

const INACTIVITY_TIMEOUT_MS = 30 * 60 * 1000; // 30 minutes

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
    // Placeholder — subscription data can come from a Supabase table or Stripe webhook later
    setSubscription({ tier: null, status: 'inactive', expires_at: null, credits: 0 });
  }, []);

  const fetchAiSubscription = useCallback(async () => {
    setAiSubscription({ ai_tier: null, ai_status: 'inactive', ai_expires_at: null });
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

  // Build a Profile from either the profiles table or auth user_metadata
  const buildProfile = useCallback(async (authUser: any): Promise<Profile | null> => {
    if (!authUser) return null;

    // Try to fetch from profiles table first
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', authUser.id)
        .maybeSingle();

      if (data && !error) {
        return data as Profile;
      }
    } catch {
      // profiles table may not exist yet — fall through to metadata
    }

    // Fall back to user_metadata
    const meta = authUser.user_metadata || {};
    return {
      id: authUser.id,
      email: authUser.email || '',
      full_name: meta.full_name || '',
      role: meta.role || 'job_seeker',
      company: meta.company || undefined,
      created_at: authUser.created_at || new Date().toISOString(),
      updated_at: authUser.updated_at || new Date().toISOString(),
    } as Profile;
  }, []);

  // Create a profile record in the profiles table after signup
  const createProfileRecord = useCallback(async (authUser: any, fullName: string, role: string, company?: string) => {
    try {
      const { error } = await supabase
        .from('profiles')
        .upsert({
          id: authUser.id,
          email: authUser.email,
          full_name: fullName,
          role: role || 'job_seeker',
          company: company || null,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        }, { onConflict: 'id' });

      if (error) {
        // Table may not exist — that's ok, metadata is sufficient
      }
    } catch {
      // Silently handle — metadata fallback works
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    let initialised = false;

    const { data: { subscription: authSub } } = supabase.auth.onAuthStateChange((event, sess) => {
      if (cancelled) return;
      if (event === 'INITIAL_SESSION' || event === 'SIGNED_IN') {
        if (initialised && event === 'INITIAL_SESSION') return;
        initialised = true;
        setSession(sess);
        setUser(sess?.user ?? null);
        if (sess?.user) {
          buildProfile(sess.user).then(p => {
            if (!cancelled) { setProfile(p); setLoading(false); }
          });
          fetchUserApplications(sess.user.id).then(apps => {
            if (cancelled) return;
            const validIds = apps.map((a: any) => a.job_id).filter(Boolean);
            setAppliedJobs(prev => {
              const clean = prev.filter(id => validIds.includes(id));
              localStorage.setItem('jobbridge_applied_jobs', JSON.stringify(clean));
              return clean;
            });
          }).catch(() => {});
        } else {
          if (!cancelled) setLoading(false);
        }
      } else if (event === 'SIGNED_OUT' || event === 'USER_DELETED') {
        setSession(null);
        setUser(null);
        setProfile(null);
        setLoading(false);
      } else if (event === 'TOKEN_REFRESHED') {
        setSession(sess);
        setUser(sess?.user ?? null);
        if (sess?.user) {
          buildProfile(sess.user).then(p => { if (!cancelled) setProfile(p); });
        }
      }
    });

    return () => { cancelled = true; authSub.unsubscribe(); };
  }, [buildProfile]);

  // Inactivity auto-logout timer
  const inactivityTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const resetInactivityTimer = useCallback(() => {
    if (inactivityTimer.current) clearTimeout(inactivityTimer.current);
    inactivityTimer.current = setTimeout(() => {
      if (user) {
        signOut();
      }
    }, INACTIVITY_TIMEOUT_MS);
  }, [user]);

  useEffect(() => {
    if (!user) return;
    const events = ['mousedown', 'keydown', 'touchstart', 'scroll', 'mousemove'];
    resetInactivityTimer();
    events.forEach(e => window.addEventListener(e, resetInactivityTimer));
    return () => {
      events.forEach(e => window.removeEventListener(e, resetInactivityTimer));
      if (inactivityTimer.current) clearTimeout(inactivityTimer.current);
    };
  }, [user, resetInactivityTimer]);

  const signUp = async (
    email: string,
    password: string,
    fullName: string,
    role: UserRole,
    company?: string
  ) => {
    try {
      const { data, error } = await supabase.auth.signUp({
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

      if (error) {
        const fullMsg = error?.message || error?.error_description || JSON.stringify(error) || 'Signup failed';
        console.error('[AuthContext signUp] Supabase error:', error);
        return { error: new Error(fullMsg) };
      }

      const authUser = data?.user;
      if (authUser) {
        await createProfileRecord(authUser, fullName, role || 'job_seeker', company);
        // Fire welcome email (fire-and-forget)
        fetch(
          `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/send-welcome-email`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}` },
            body: JSON.stringify({ email, name: fullName }),
          },
        ).catch(() => {});
      }

      // If not auto-signed-in (email confirmation on), sign in manually
      if (!data?.session && authUser) {
        const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
        if (signInError) throw signInError;
      }

      return { error: null };
    } catch (error: any) {
      const msg = error?.message || error?.error_description || error?.toString() || 'Failed to create account. Please try again.';
      return { error: new Error(msg) };
    }
  };

  const signIn = async (email: string, password: string) => {
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
      return { error: null };
    } catch (error) {
      return { error: error as Error };
    }
  };

  const signOut = async () => {
    await supabase.auth.signOut();
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
