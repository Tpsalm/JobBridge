import {
  createContext,
  useContext,
  useState,
  ReactNode,
  useEffect,
  useCallback,
  useRef,
} from "react";
import {
  supabase,
  Profile,
  SubscriptionInfo,
  AiSubscriptionInfo,
} from "../lib/supabase";
import { fetchUserApplications, updateProfile } from "../lib/supabaseQueries";
import { sendEmail } from "../lib/email";
import { normalizeAuthError } from "../lib/authErrors";

const ADMIN_EMAIL = "jobbridgesupport@gmail.com";
const PROFILE_REMINDER_THRESHOLD = 0.8; // 80% completion
const PROFILE_REMINDER_DELAY_DAYS = 7;
const PROFILE_REMINDER_WINDOW_MS = PROFILE_REMINDER_DELAY_DAYS * 24 * 60 * 60 * 1000;
const PROFILE_REMINDER_STORAGE_PREFIX = "jb_profile_reminder_last_sent_";

const INACTIVITY_TIMEOUT_MS = 30 * 60 * 1000; // 30 minutes

export type UserRole = "recruiter" | "provider" | "job_seeker" | "admin" | null;

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
  subscriptionLoaded: boolean;
  aiSubscriptionLoaded: boolean;
  savedJobs: string[];
  appliedJobs: string[];
  toggleSaveJob: (jobId: string) => void;
  markApplied: (jobId: string) => void;
  signUp: (
    email: string,
    password: string,
    fullName: string,
    role: UserRole,
    company?: string,
    serviceCategory?: string,
  ) => Promise<{ error: Error | null; session: any | null; emailWarning?: string | null }>;
  signIn: (
    email: string,
    password: string,
    rememberMe?: boolean,
  ) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
  resetPassword: (email: string) => Promise<{ error: Error | null }>;
  updatePassword: (newPassword: string) => Promise<{ error: Error | null }>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  profile: null,
  session: null,
  isAuthenticated: false,
  loading: true,
  subscription: {
    tier: null,
    status: "inactive",
    expires_at: null,
    credits: 0,
  },
  fetchSubscription: async () => {},
  aiSubscription: { ai_tier: null, ai_status: "inactive", ai_expires_at: null },
  fetchAiSubscription: async () => {},
  subscriptionLoaded: false,
  aiSubscriptionLoaded: false,
  savedJobs: [],
  appliedJobs: [],
  toggleSaveJob: () => {},
  markApplied: () => {},
  signUp: async () => ({ error: null, session: null, emailWarning: null }),
  signIn: async () => ({ error: null }),
  signOut: async () => {},
  resetPassword: async () => ({ error: null }),
  updatePassword: async () => ({ error: null }),
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<any | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [session, setSession] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [subscription, setSubscription] = useState<SubscriptionInfo>({
    tier: null,
    status: "inactive",
    expires_at: null,
    credits: 0,
  });
  const [aiSubscription, setAiSubscription] = useState<AiSubscriptionInfo>({
    ai_tier: null,
    ai_status: "inactive",
    ai_expires_at: null,
  });
  const [subscriptionLoaded, setSubscriptionLoaded] = useState(false);
  const [aiSubscriptionLoaded, setAiSubscriptionLoaded] = useState(false);
  const [savedJobs, setSavedJobs] = useState<string[]>(() => {
    try {
      return JSON.parse(localStorage.getItem("jobbridge_saved_jobs") || "[]");
    } catch {
      return [];
    }
  });
  const [appliedJobs, setAppliedJobs] = useState<string[]>(() => {
    try {
      return JSON.parse(localStorage.getItem("jobbridge_applied_jobs") || "[]");
    } catch {
      return [];
    }
  });

  // Stable ref to track current user without triggering effect re-runs
  const userRef = useRef(user);
  useEffect(() => {
    userRef.current = user;
  }, [user]);

  const fetchSubscription = useCallback(async (userId?: string) => {
    setSubscriptionLoaded(false);
    const uid = userId || userRef.current?.id;
    if (!uid) {
      setSubscription({
        tier: null,
        status: "inactive",
        expires_at: null,
        credits: 0,
      });
      setSubscriptionLoaded(true);
      return;
    }

    try {
      const { data, error } = await supabase
        .from("profiles")
        .select(
          "is_premium, subscription_tier, subscription_expires_at, credits",
        )
        .eq("id", uid)
        .maybeSingle();

      if (error || !data) {
        setSubscription({
          tier: null,
          status: "inactive",
          expires_at: null,
          credits: 0,
        });
        return;
      }

      const now = new Date();
      const expiresAt = data.subscription_expires_at
        ? new Date(data.subscription_expires_at)
        : null;
      const isExpired = expiresAt ? expiresAt < now : false;

      let status: "active" | "inactive" | "expired" = "inactive";
      if (data.is_premium && !isExpired) {
        status = "active";
      } else if (data.is_premium && isExpired) {
        status = "expired";
      }

      setSubscription({
        tier: data.subscription_tier || null,
        status,
        expires_at: data.subscription_expires_at || null,
        credits: data.credits || 0,
      });
    } catch {
      setSubscription({
        tier: null,
        status: "inactive",
        expires_at: null,
        credits: 0,
      });
    } finally {
      setSubscriptionLoaded(true);
    }
  }, []);

  const fetchAiSubscription = useCallback(async (userId?: string) => {
    setAiSubscriptionLoaded(false);
    const uid = userId || userRef.current?.id;
    if (!uid) {
      setAiSubscription({
        ai_tier: null,
        ai_status: "inactive",
        ai_expires_at: null,
      });
      setAiSubscriptionLoaded(true);
      return;
    }

    try {
      const { data, error } = await supabase
        .from("profiles")
        .select("subscription_tier, subscription_expires_at")
        .eq("id", uid)
        .maybeSingle();

      if (error || !data) {
        setAiSubscription({
          ai_tier: null,
          ai_status: "inactive",
          ai_expires_at: null,
        });
        return;
      }

      const now = new Date();
      const expiresAt = data.subscription_expires_at
        ? new Date(data.subscription_expires_at)
        : null;
      const isExpired = expiresAt ? expiresAt < now : false;

      let ai_status: "active" | "inactive" | "expired" = "inactive";
      if (data.subscription_tier === "ai_tools" && !isExpired) {
        ai_status = "active";
      } else if (data.subscription_tier === "ai_tools" && isExpired) {
        ai_status = "expired";
      }

      setAiSubscription({
        ai_tier:
          data.subscription_tier === "ai_tools" ? data.subscription_tier : null,
        ai_status,
        ai_expires_at: data.subscription_expires_at || null,
      });
    } catch {
      setAiSubscription({
        ai_tier: null,
        ai_status: "inactive",
        ai_expires_at: null,
      });
    } finally {
      setAiSubscriptionLoaded(true);
    }
  }, []);

  const toggleSaveJob = (jobId: string) => {
    setSavedJobs((prev) => {
      const next = prev.includes(jobId)
        ? prev.filter((id) => id !== jobId)
        : [...prev, jobId];
      localStorage.setItem("jobbridge_saved_jobs", JSON.stringify(next));
      return next;
    });
  };

  const markApplied = (jobId: string) => {
    setAppliedJobs((prev) => {
      if (prev.includes(jobId)) return prev;
      const next = [...prev, jobId];
      localStorage.setItem("jobbridge_applied_jobs", JSON.stringify(next));
      return next;
    });
  };

  const createProfileRecord = useCallback(
    async (
      authUser: any,
      fullName?: string,
      role?: string,
      company?: string,
      serviceCategory?: string,
    ) => {
      const meta = authUser?.user_metadata || {};
      const payload: Record<string, any> = {
        id: authUser.id,
        email: authUser.email || null,
        full_name: fullName || meta.full_name || "",
        role: role || meta.role || "job_seeker",
        company: company ?? meta.company ?? null,
        created_at: authUser.created_at || new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      // Store service_category if provided
      const svcCat = serviceCategory || meta.service_category;
      if (svcCat) {
        payload.service_category = svcCat;
      }

      try {
        const { error } = await supabase.from("profiles").upsert(payload, {
          onConflict: "id",
        });

        if (error) {
          console.error(
            "[AuthContext createProfileRecord] upsert failed:",
            error,
          );
          return { error };
        }

        return { error: null };
      } catch (error) {
        console.error(
          "[AuthContext createProfileRecord] unexpected exception:",
          error,
        );
        return { error: error as Error };
      }
    },
    [],
  );

  // Build a Profile from either the profiles table or auth user_metadata.
  // If the row is missing (for example: email confirmation flow with no session
  // at signup time), try to create/heal it once the user becomes authenticated.
  const buildProfile = useCallback(
    async (authUser: any): Promise<Profile | null> => {
      if (!authUser) return null;

      const meta = authUser.user_metadata || {};
      const fallbackProfile = {
        id: authUser.id,
        email: authUser.email || "",
        full_name: meta.full_name || "",
        role: meta.role || "job_seeker",
        company: meta.company || undefined,
        service_category: meta.service_category || undefined,
        created_at: authUser.created_at || new Date().toISOString(),
        updated_at: authUser.updated_at || new Date().toISOString(),
      } as Profile;

      try {
        const { data, error } = await supabase
          .from("profiles")
          .select("*")
          .eq("id", authUser.id)
          .maybeSingle();

        if (data && !error) {
          return data as Profile;
        }

        if (error) {
          console.error(
            "[AuthContext buildProfile] initial fetch failed:",
            error,
          );
        }

        const { error: createError } = await createProfileRecord(
          authUser,
          meta.full_name,
          meta.role,
          meta.company,
        );

        if (!createError) {
          const { data: repairedProfile, error: refetchError } = await supabase
            .from("profiles")
            .select("*")
            .eq("id", authUser.id)
            .maybeSingle();

          if (repairedProfile && !refetchError) {
            return repairedProfile as Profile;
          }

          if (refetchError) {
            console.error(
              "[AuthContext buildProfile] refetch after repair failed:",
              refetchError,
            );
          }
        }
      } catch (error) {
        console.error("[AuthContext buildProfile] exception:", error);
      }

      return fallbackProfile;
    },
    [createProfileRecord],
  );

  // Auth listener effect — only depends on stable buildProfile, never re-runs
  useEffect(() => {
    let cancelled = false;
    let initialised = false;

    const {
      data: { subscription: authSub },
    } = supabase.auth.onAuthStateChange((event: string, sess: any) => {
      if (cancelled) return;
      if (event === "INITIAL_SESSION" || event === "SIGNED_IN") {
        if (initialised && event === "INITIAL_SESSION") return;
        initialised = true;
        setSession(sess);
        setUser(sess?.user ?? null);
        if (sess?.user) {
          // Use sess.user.id explicitly so the callback doesn't need to close over user
          (async () => {
            const p = await buildProfile(sess.user);
            if (!cancelled) {
              setProfile(p);
              setLoading(false);
            }
            await fetchSubscription(sess.user.id);
            await fetchAiSubscription(sess.user.id);
          })();
          fetchUserApplications(sess.user.id)
            .then((apps) => {
              if (cancelled) return;
              const validIds = apps.map((a: any) => a.job_id).filter(Boolean);
              setAppliedJobs((prev) => {
                const clean = prev.filter((id) => validIds.includes(id));
                localStorage.setItem(
                  "jobbridge_applied_jobs",
                  JSON.stringify(clean),
                );
                return clean;
              });
            })
            .catch(() => {});
        } else {
          if (!cancelled) setLoading(false);
        }
      } else if (event === "SIGNED_OUT" || event === "USER_DELETED") {
        setSession(null);
        setUser(null);
        setProfile(null);
        setLoading(false);
      } else if (event === "TOKEN_REFRESHED") {
        setSession(sess);
        setUser(sess?.user ?? null);
        if (sess?.user) {
          buildProfile(sess.user).then((p) => {
            if (!cancelled) setProfile(p);
          });
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

  // Re-hydrate profile + subscription state whenever the authenticated user changes.
  // This closes the gap where a user signs in, lands on a gated route, and the UI
  // still renders the paywall until an unrelated auth event triggers another refresh.
  useEffect(() => {
    if (!user?.id) return;

    let cancelled = false;

    (async () => {
      const p = await buildProfile(user);
      if (!cancelled) {
        setProfile(p);
      }

      await fetchSubscription(user.id);
      await fetchAiSubscription(user.id);
    })();

    return () => {
      cancelled = true;
    };
  }, [user?.id, buildProfile, fetchSubscription, fetchAiSubscription]);

  // Separate effect for visibility/focus — re-runs when user changes
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible" && user?.id) {
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
    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("focus", handleFocus);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("focus", handleFocus);
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
    const events = [
      "mousedown",
      "keydown",
      "touchstart",
      "scroll",
      "mousemove",
    ];
    resetInactivityTimer();
    events.forEach((e) => window.addEventListener(e, resetInactivityTimer));
    return () => {
      events.forEach((e) =>
        window.removeEventListener(e, resetInactivityTimer),
      );
      if (inactivityTimer.current) clearTimeout(inactivityTimer.current);
    };
  }, [user, resetInactivityTimer]);

  const signUp = async (
    email: string,
    password: string,
    fullName: string,
    role: UserRole,
    company?: string,
    serviceCategory?: string,
  ) => {
    try {
      if (role === "admin") {
        return {
          error: new Error(
            "Admin accounts cannot be created from the public signup flow.",
          ),
          session: null,
        };
      }
      const redirectTo = `${window.location.origin}/auth/callback`;
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: redirectTo,
          data: {
            full_name: fullName,
            role: role || "job_seeker",
            company: company || null,
            service_category: serviceCategory || null,
          },
        },
      });

      if (error) {
        const fullMsg = normalizeAuthError(error, "signup");
        console.error("[AuthContext signUp] Supabase error:", error);
        return { error: new Error(fullMsg), session: null };
      }

      const authUser = data?.user;
      const newSession = data?.session || null;

      if (authUser) {
        const { error: profileWriteError } = await createProfileRecord(
          authUser,
          fullName,
          role || "job_seeker",
          company,
          serviceCategory,
        );

        if (profileWriteError) {
          console.error(
            "[AuthContext signUp] profile write failed after auth signup:",
            profileWriteError,
          );
        }

        let emailWarning: string | null = null;

        const welcomeSent = await sendEmail({ type: "welcome", email, name: fullName });
        if (!welcomeSent) {
          emailWarning =
            "Account created, but we could not send the welcome email. Please check your inbox or contact support.";
          console.warn("[AuthContext signUp] welcome email send failed");
        }

        const profileReminderSent = await sendEmail({
          type: "profile_reminder",
          email,
          name: fullName,
        });
        if (!profileReminderSent) {
          emailWarning = emailWarning
            ? "Account created, but some onboarding emails could not be delivered. Please check your inbox or contact support."
            : "Account created, but we could not send the profile reminder email. Please check your inbox or contact support.";
          console.warn("[AuthContext signUp] profile reminder email send failed");
        }

        try {
          await updateProfile(authUser.id, {
            profile_reminder_sent_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          });
        } catch (updateError) {
          if (isMissingSchemaColumnError(updateError, "profile_reminder_sent_at")) {
            console.warn(
              "[AuthContext signUp] profile_reminder_sent_at not available yet; skipping timestamp write",
            );
            await updateProfile(authUser.id, {
              updated_at: new Date().toISOString(),
            });
          } else {
            console.error("[AuthContext signUp] failed to update reminder timestamp:", updateError);
          }
        }

        if (role === "recruiter") {
          const recruiterNoticeSent = await sendEmail({
            type: "new_recruiter",
            email: ADMIN_EMAIL,
            name: fullName,
          });
          if (!recruiterNoticeSent) {
            console.warn("[AuthContext signUp] recruiter notification email send failed");
          }
        }

        return { error: null, session: newSession, emailWarning };
      }

      // If no session returned (email confirmation required), return success with null session
      if (!newSession) {
        if (authUser) {
          return { error: null, session: null, emailWarning: null };
        }
        return {
          error: new Error("Could not create account. Please try again."),
          session: null,
          emailWarning: null,
        };
      }

      return { error: null, session: newSession, emailWarning: null };
    } catch (error: any) {
      // Safely extract message from any error shape (class instance, plain object, string)
      let msg = "";
      if (error?.message && typeof error.message === "string") {
        msg = error.message;
      } else if (typeof error === "string") {
        msg = error;
      } else if (typeof error === "object" && error !== null) {
        // Last resort: try to stringify the error object to see what it contains
        try {
          const serialized = JSON.stringify(error);
          if (serialized && serialized !== "{}") {
            msg = serialized;
          } else {
            msg = "Failed to create account. Please try again.";
          }
        } catch {
          msg = "Failed to create account. Please try again.";
        }
      } else {
        msg = "Failed to create account. Please try again.";
      }
      return { error: new Error(msg), session: null };
    }
  };

  const signIn = async (
    email: string,
    password: string,
    rememberMe = true,
  ) => {
    try {
      // Supabase JS v2 always persists session by default.
      // To NOT persist (session-only), we sign in normally but then
      // remove the storage key after sign-in when rememberMe is false.
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      if (error) throw error;

      const signedInUserEmail = data?.user?.email || email;
      const signedInUserName =
        data?.user?.user_metadata?.full_name ||
        data?.user?.email ||
        email;

      // If user does NOT want to be remembered, store preference so we can
      // sign out when the tab closes (best-effort via sessionStorage flag).
      if (!rememberMe && data?.session) {
        sessionStorage.setItem("jb_session_only", "1");
      } else {
        sessionStorage.removeItem("jb_session_only");
      }

      if (signedInUserEmail) {
        void sendEmail({
          type: "sign_in",
          email: signedInUserEmail,
          name: signedInUserName,
        });
      }

      if (data?.user?.id && signedInUserEmail) {
        void (async () => {
          try {
            let profileData: any = null;
            let hasReminderColumn = true;

            try {
              const { data: result, error: profileError } = await supabase
                .from("profiles")
                .select(
                  "role,full_name,phone,location,professional_headline,years_of_experience,bio,specialty,hourly_rate,skills,profile_reminder_sent_at",
                )
                .eq("id", data.user.id)
                .maybeSingle();

              if (profileError) throw profileError;
              profileData = result;
            } catch (fetchError) {
              if (isMissingSchemaColumnError(fetchError, "profile_reminder_sent_at")) {
                hasReminderColumn = false;
                const { data: result, error: profileError } = await supabase
                  .from("profiles")
                  .select(
                    "role,full_name,phone,location,professional_headline,years_of_experience,bio,specialty,hourly_rate,skills",
                  )
                  .eq("id", data.user.id)
                  .maybeSingle();

                if (profileError) throw profileError;
                profileData = result;
              } else {
                return;
              }
            }

            if (!profileData) return;

            const fields = [
              profileData.full_name,
              profileData.phone,
              profileData.location,
              profileData.professional_headline,
              profileData.years_of_experience,
              profileData.bio,
            ];

            if (profileData.role === "provider") {
              fields.push(
                profileData.specialty,
                profileData.hourly_rate,
                Array.isArray(profileData.skills) ? profileData.skills.join(",") : profileData.skills,
              );
            }

            const totalFields = fields.length;
            const completedFields = fields.filter((value) => Boolean(value && String(value).trim())).length;
            const isComplete = totalFields > 0 && completedFields / totalFields >= PROFILE_REMINDER_THRESHOLD;

            const lastSentAt = hasReminderColumn && profileData.profile_reminder_sent_at
              ? new Date(profileData.profile_reminder_sent_at).getTime()
              : 0;
            const now = Date.now();
            const reminderExpired = hasReminderColumn && (!lastSentAt || now - lastSentAt >= PROFILE_REMINDER_WINDOW_MS);

            if (!isComplete && reminderExpired) {
              await sendEmail({
                type: "profile_reminder",
                email: signedInUserEmail,
                name: signedInUserName,
              });
              try {
                await updateProfile(data.user.id, {
                  profile_reminder_sent_at: new Date().toISOString(),
                  updated_at: new Date().toISOString(),
                });
              } catch (updateError) {
                if (isMissingSchemaColumnError(updateError, "profile_reminder_sent_at")) {
                  console.warn(
                    "[AuthContext signIn] profile_reminder_sent_at column missing; skipping timestamp write",
                  );
                  await updateProfile(data.user.id, {
                    updated_at: new Date().toISOString(),
                  });
                } else {
                  console.error("[AuthContext signIn] failed to update reminder timestamp:", updateError);
                }
              }
            }
          } catch {
            // ignore reminder failures
          }
        })();
      }

      return { error: null };
    } catch (error: any) {
      const fullMsg = normalizeAuthError(error, "signin");
      return { error: new Error(fullMsg) };
    }
  };

  const signOut = async () => {
    const currentEmail = user?.email || profile?.email || null;
    const currentName = profile?.full_name || user?.user_metadata?.full_name || currentEmail || "there";

    sessionStorage.removeItem("jb_session_only");
    await supabase.auth.signOut();

    if (currentEmail) {
      void sendEmail({
        type: "sign_out",
        email: currentEmail,
        name: currentName,
      });
    }
  };

  const isMissingSchemaColumnError = (error: any, columnName: string) => {
    if (!error) return false;
    const msg = String(error?.message || error?.details || error?.hint || error?.code || "");
    return (
      msg.includes(columnName) ||
      msg.includes("schema cache") ||
      msg.includes("could not find the") ||
      msg.includes("unknown column")
    );
  };

  /**
   * Send a password-reset email via Supabase.
   * On success, Supabase sends a link that redirects to /auth/callback
   * with a recovery token which Supabase client auto-handles.
   */
  const resetPassword = async (email: string) => {
    try {
      const redirectTo = `${window.location.origin}/auth/callback`;
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo,
      });
      if (error) throw error;
      return { error: null };
    } catch (error: any) {
      const msg =
        error?.message ||
        "Failed to send reset email. Please check the address and try again.";
      return { error: new Error(msg) };
    }
  };

  /**
   * Update the current user's password (called after clicking the reset link).
   * Must be called while the user has an active recovery session.
   */
  const updatePassword = async (newPassword: string) => {
    try {
      const { error } = await supabase.auth.updateUser({
        password: newPassword,
      });
      if (error) throw error;
      return { error: null };
    } catch (error: any) {
      const msg =
        error?.message || "Failed to update password. Please try again.";
      return { error: new Error(msg) };
    }
  };

  // Handle session-only mode: sign out when tab/window closes
  useEffect(() => {
    const handleBeforeUnload = () => {
      if (sessionStorage.getItem("jb_session_only") === "1") {
        // Fire-and-forget sign out — best effort on tab close
        supabase.auth.signOut();
      }
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, []);

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
        subscriptionLoaded,
        aiSubscriptionLoaded,
        savedJobs,
        appliedJobs,
        toggleSaveJob,
        markApplied,
        signUp,
        signIn,
        signOut,
        resetPassword,
        updatePassword,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
