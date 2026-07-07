import { createContext, useContext, useState, ReactNode, useEffect, useCallback, useRef } from 'react';
import { supabase, Profile, SubscriptionInfo, AiSubscriptionInfo } from '../lib/supabase';
import { fetchUserApplications } from '../lib/supabaseQueries';
import { sendEmail } from '../lib/email';

const ADMIN_EMAIL = 'jobbridgesupport@gmail.com';

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
  signUp: (email: string, password: string, fullName: string, role: UserRole, company?: string) => Promise<{ error: Error | null; session: any | null }>;
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
  signUp: async () => ({ error: null, session: null }),
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

  // Stable ref to track current user without triggering effect re-runs
  const userRef = useRef(user);
  useEffect(() => { userRef.current = user; }, [user]);

  const fetchSubscription = useCallback(async (userId?: string) => {
    const uid = userId || userRef.current?.id;
    if (!uid) {
      setSubscription({ tier: null, status: 'inactive', expires_at: null, credits: 0 });
      return;
    }

    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('is_premium, subscription_tier, subscription_expires_at, credits')
        .eq('id', uid)
        .maybeSingle();

      if (error || !data) {
        setSubscription({ tier: null, status: 'inactive', expires_at: null, credits: 0 });
        return;
      }

      const now = new Date();
      const expiresAt = data.subscription_expires_at ? new Date(data.subscription_expires_at) : null;
      const isExpired = expiresAt ? expiresAt < now : false;

      let status: 'active' | 'inactive' | 'expired' = 'inactive';
      if (data.is_premium && !isExpired) {
        status = 'active';
      } else if (data.is_premium && isExpired) {
        status = 'expired';
      }

      setSubscription({
        tier: data.subscription_tier || null,
        status,
        expires_at: data.subscription_expires_at || null,
        credits: data.credits || 0,
      });
    } catch {
      setSubscription({ tier: null, status: 'inactive', expires_at: null, credits: 0 });
    }
  }, []);

  const fetchAiSubscription = useCallback(async (userId?: string) => {
    const uid = userId || userRef.current?.id;
    if (!uid) {
      setAiSubscription({ ai_tier: null, ai_status: 'inactive', ai_expires_at: null });
      return;
    }

    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('subscription_tier, subscription_expires_at')
        .eq('id', uid)
        .maybeSingle();

      if (error || !data) {
        setAiSubscription({ ai_tier: null, ai_status: 'inactive', ai_expires_at: null });
        return;
      }

      const now = new Date();
      const expiresAt = data.subscription_expires_at ? new Date(data.subscription_expires_at) : null;
      const isExpired = expiresAt ? expiresAt < now : false;

      let ai_status: 'active' | 'inactive' | 'expired' = 'inactive';
      // AI subscription is active if the user has an ai_tools tier that hasn't expired
      if (data.subscription_tier === 'ai_tools' && !isExpired) {
        ai_status = 'active';
      } else if (data.subscription_tier === 'ai_tools' && isExpired) {
        ai_status = 'expired';
      }

      setAiSubscription({
        ai_tier: data.subscription_tier === 'ai_tools' ? data.subscription_tier : null,
        ai_status,
        ai_expires_at: data.subscription_expires_at || null,
      });
    } catch {
      setAiSubscription({ ai_tier: null, ai_status: 'inactive', ai_expires_at: null });
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

  // Auth listener effect — only depends on stable buildProfile, never re-runs
  useEffect(() => {
    let cancelled = false;
    let initialised = false;

    const { data: { subscription: authSub } } = supabase.auth.onAuthStateChange((event: string, sess: any) => {
      if (cancelled) return;
      if (event === 'INITIAL_SESSION' || event === 'SIGNED_IN') {
        if (initialised && event === 'INITIAL_SESSION') return;
        initialised = true;
        setSession(sess);
        setUser(sess?.user ?? null);
        if (sess?.user) {
          // Use sess.user.id explicitly so the callback doesn't need to close over user
          (async () => {
            const p = await buildProfile(sess.user);
            if (!cancelled) { setProfile(p); setLoading(false); }
            await fetchSubscription(sess.user.id);
            await fetchAiSubscription(sess.user.id);
          })();
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
          fetchSubscription(sess.user.id);
          fetchAiSubscription(sess.user.id);
        }
      }
    });

    return () => {
      cancelled = true;
      authSub.unsubscribe();
    };
  }, [buildProfile]);

  // Separate effect for visibility/focus — re-runs when user changes
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && user?.id) {
        fetchSubscription(user.id);
        fetchAiSubscription(user.id);
      }
    };
    const handleFocus = () => {
      if (user?.id) {
        fetchSubscription(user.id);
        fetchAiSubscription(user.id);
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('focus', handleFocus);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('focus', handleFocus);
    };
  }, [user?.id, fetchSubscription, fetchAiSubscription]);

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
        // 🐛 DEBUG: Log the raw error shape to identify what's actually coming back
        console.log('[AuthContext signUp] RAW ERROR:', error);
        console.log('[AuthContext signUp] typeof error:', typeof error);
        console.log('[AuthContext signUp] error.constructor.name:', (error as any)?.constructor?.name);
        console.log('[AuthContext signUp] error keys:', Object.keys(error as object));
        console.log('[AuthContext signUp] error.message:', (error as any)?.message);
        console.log('[AuthContext signUp] error.message.length:', (error as any)?.message?.length);
        console.log('[AuthContext signUp] error.message type:', typeof (error as any)?.message);
        console.log('[AuthContext signUp] JSON.stringify:', JSON.stringify(error));
        console.log('[AuthContext signUp] error.name:', (error as any)?.name);
        console.log('[AuthContext signUp] error.status:', (error as any)?.status);
        console.log('[AuthContext signUp] error.code:', (error as any)?.code);
        console.log('[AuthContext signUp] error.__isAuthError:', (error as any)?.__isAuthError);

        // Extract a meaningful message — Supabase AuthApiError is a class instance,
        // JSON.stringify() returns '{}' on class instances. Always use .message first.
        let fullMsg = '';

        // Specific error types first
        const errorName = (error as any)?.name || (error as any)?.constructor?.name || '';
        const errorStatus = (error as any)?.status;

        if (errorName === 'AuthRetryableFetchError') {
          fullMsg = 'Network error. Please check your internet connection and try again.';
        } else if (error?.message !== undefined && error?.message !== null && typeof error.message === 'string' && error.message.trim()) {
          fullMsg = error.message.trim();
        } else if (error?.message !== undefined && error?.message !== null && typeof error.message === 'string' && !error.message.trim()) {
          // Message is an empty string — use the error name for context
          if (errorName && errorName !== 'Error') {
            fullMsg = 'Signup service unavailable. Please try again later.';
          } else {
            fullMsg = 'Signup failed. Please try again or use a different email.';
          }
        } else if ((error as any)?.error_description) {
          fullMsg = String((error as any).error_description);
        } else if ((error as any)?.msg) {
          fullMsg = String((error as any).msg);
        } else if (errorStatus !== undefined && errorStatus !== null) {
          fullMsg = `Signup failed (status ${errorStatus}). Please try again.`;
        } else if (typeof error === 'object' && error !== null) {
          // Last resort: try to stringify to debug unexpected error shapes
          try {
            const serialized = JSON.stringify(error);
            if (serialized && serialized !== '{}') {
              fullMsg = serialized;
            } else {
              fullMsg = 'Signup failed. Please try again or use a different email.';
            }
          } catch {
            fullMsg = 'Signup failed. Please try again or use a different email.';
          }
        } else {
          fullMsg = 'Signup failed. Please try again or use a different email.';
        }

        // Make common Supabase error codes human-readable
        const lowerMsg = fullMsg.toLowerCase();
        if (lowerMsg.includes('user already registered') || lowerMsg.includes('already been registered')) {
          fullMsg = 'An account with this email already exists. Please sign in instead.';
        } else if (lowerMsg.includes('invalid email')) {
          fullMsg = 'Please enter a valid email address.';
        } else if (lowerMsg.includes('password should be at least')) {
          fullMsg = 'Password must be at least 6 characters long.';
        } else if (lowerMsg.includes('signup is disabled') || lowerMsg.includes('signups not allowed')) {
          fullMsg = 'New account registration is temporarily disabled. Please contact support.';
        } else if (lowerMsg.includes('email rate limit') || lowerMsg.includes('too many requests')) {
          fullMsg = 'Too many signup attempts. Please wait a few minutes and try again.';
        }

        console.error('[AuthContext signUp] Supabase error:', error);
        return { error: new Error(fullMsg), session: null };
      }

      const authUser = data?.user;
      const newSession = data?.session || null;

      if (authUser) {
        await createProfileRecord(authUser, fullName, role || 'job_seeker', company);
        sendEmail({ type: 'welcome', email, name: fullName });
        // Notify admin when a recruiter signs up
        if (role === 'recruiter') {
          sendEmail({ type: 'new_recruiter', email: ADMIN_EMAIL, name: fullName });
        }
      }

      // If no session returned (email confirmation required), return success with null session
      if (!newSession) {
        if (authUser) {
          return { error: null, session: null };
        }
        return { error: new Error('Could not create account. Please try again.'), session: null };
      }

      return { error: null, session: newSession };
    } catch (error: any) {
      // Safely extract message from any error shape (class instance, plain object, string)
      let msg = '';
      if (error?.message && typeof error.message === 'string') {
        msg = error.message;
      } else if (typeof error === 'string') {
        msg = error;
      } else if (typeof error === 'object' && error !== null) {
        // Last resort: try to stringify the error object to see what it contains
        try {
          const serialized = JSON.stringify(error);
          if (serialized && serialized !== '{}') {
            msg = serialized;
          } else {
            msg = 'Failed to create account. Please try again.';
          }
        } catch {
          msg = 'Failed to create account. Please try again.';
        }
      } else {
        msg = 'Failed to create account. Please try again.';
      }
      return { error: new Error(msg), session: null };
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
