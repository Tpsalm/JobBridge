import { useState, useEffect, useMemo, useRef } from "react";
import { useNavigate } from "react-router-dom";
import Header from "../components/Header";
import BottomNav from "../components/BottomNav";
import { useAuth } from "../contexts/AuthContext";
import { useToasts } from "../contexts/ToastContext";
import { updateProfile, fetchProfile } from "../lib/supabaseQueries";
import { supabase } from "../lib/supabase";
import {
  formatPhoneInput,
  sanitizeProfileText,
  validatePhoneNumber,
} from "../lib/profileValidation";
import FloatingDecorations from '../components/FloatingDecorations';
import {
  Camera,
  Check,
  Loader,
  User,
  Phone,
  Award,
  BookOpen,
  Hash,
  Globe,
  DollarSign,
  Clock,
  Briefcase,
  ShieldCheck,
  Sparkles,
  Users2,
} from "lucide-react";

const PROFILE_FIELDS = {
  full_name: { label: "Full Name", section: "personal", weight: 2, icon: User },
  phone: { label: "Phone Number", section: "personal", weight: 1, icon: Phone },
  location: { label: "Location", section: "personal", weight: 1, icon: Globe },
  professional_headline: { label: "Professional Headline", section: "professional", weight: 2, icon: Award },
  years_of_experience: { label: "Years of Experience", section: "professional", weight: 1, icon: Clock },
  bio: { label: "Bio / About", section: "professional", weight: 2, icon: BookOpen },
  specialty: { label: "Service Specialty (Providers)", section: "provider", weight: 2, icon: Hash },
  hourly_rate: { label: "Hourly Rate (NGN)", section: "provider", weight: 1, icon: DollarSign },
  skills: { label: "Skills (comma-separated)", section: "provider", weight: 1, icon: Hash },
};

const DEFAULT_AVATAR = `data:image/svg+xml;utf8,${encodeURIComponent(
  '<svg xmlns="http://www.w3.org/2000/svg" width="160" height="160" viewBox="0 0 160 160"><rect width="160" height="160" fill="#E3E2DF"/><circle cx="80" cy="62" r="28" fill="#C3C6D6"/><path d="M28 146c8-24 29-38 52-38s44 14 52 38" fill="#C3C6D6"/></svg>',
)}`;

function ProfileCompletionRing({ percentage }: { percentage: number }) {
  const radius = 38;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (percentage / 100) * circumference;
  const color = percentage >= 80 ? "#0b6df4" : percentage >= 50 ? "#3b82f6" : "#2563eb";

  return (
    <div className="relative w-24 h-24 mx-auto">
      <svg className="w-24 h-24 -rotate-90" viewBox="0 0 88 88">
        <circle cx="44" cy="44" r={radius} fill="none" stroke="#e2e8f0" strokeWidth="5" />
        <circle
          cx="44"
          cy="44"
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth="5"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          style={{ transition: "stroke-dashoffset 0.8s ease" }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-lg font-semibold text-slate-900">{percentage}%</span>
        <span className="text-[10px] text-slate-500 font-medium">Complete</span>
      </div>
    </div>
  );
}

export default function Profile() {
  const { user, profile: userProfile, updatePassword } = useAuth();
  const { push } = useToasts();
  const navigate = useNavigate();
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [savedBadgeVisible, setSavedBadgeVisible] = useState(false);
  const [savedBadgeMounted, setSavedBadgeMounted] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [passwordSaving, setPasswordSaving] = useState(false);
  const [form, setForm] = useState<Record<string, string>>({});
  const [profileLoading, setProfileLoading] = useState(true);
  const [avatarLoadFailed, setAvatarLoadFailed] = useState(false);
  const avatarInputRef = useRef<HTMLInputElement>(null);
  const initialFormRef = useRef<Record<string, string> | null>(null);
  const editorRef = useRef<HTMLDivElement | null>(null);
  const securityRef = useRef<HTMLDivElement | null>(null);
  const activityRef = useRef<HTMLDivElement | null>(null);

  const normalizeAvatarUrl = (raw?: string) => {
    const value = (raw || "").trim();
    if (!value || value === "null" || value === "undefined") return "";
    return value;
  };

  const avatarSrc = avatarLoadFailed
    ? DEFAULT_AVATAR
    : normalizeAvatarUrl(form.avatar_url) || DEFAULT_AVATAR;

  useEffect(() => {
    setAvatarLoadFailed(false);
  }, [form.avatar_url]);

  useEffect(() => {
    let cancelled = false;

    async function loadProfile() {
      if (!user) {
        if (!cancelled) setProfileLoading(false);
        return;
      }

      if (!cancelled) {
        setProfileLoading(true);
        setSaveError("");
      }

      try {
        const fresh = await fetchProfile(user.id);
        if (cancelled) return;

        if (fresh) {
          const fields: Record<string, string> = {};
          const freshRecord = fresh as Record<string, unknown>;
          Object.keys(PROFILE_FIELDS).forEach((key) => {
            const val = freshRecord[key];
            if (key === "skills" && Array.isArray(val)) {
              fields[key] = val.join(", ");
            } else if (key === "phone") {
              fields[key] = val == null ? "" : formatPhoneInput(String(val));
            } else {
              fields[key] = val == null ? "" : String(val);
            }
          });
          fields.avatar_url = String(freshRecord.avatar_url || "");
          fields.email = fresh.email || user?.email || "";
          setForm(fields);
          initialFormRef.current = fields;
        } else {
          const fallbackFields = {
            full_name: user.user_metadata?.full_name || "",
            email: user.email || "",
            phone: "",
            location: "",
            professional_headline: "",
            years_of_experience: "",
            bio: "",
            specialty: "",
            hourly_rate: "",
            skills: "",
            avatar_url: "",
          };
          setForm(fallbackFields);
          initialFormRef.current = fallbackFields;
        }
      } catch (err: unknown) {
        if (!cancelled) {
          const message = err instanceof Error && err.message ? err.message : "Could not load profile. Please refresh the page.";
          setSaveError(message);
        }
      } finally {
        if (!cancelled) setProfileLoading(false);
      }
    }

    loadProfile();
    return () => {
      cancelled = true;
    };
  }, [user]);

  const activeFields = useMemo(() => {
    return Object.entries(PROFILE_FIELDS).filter(([key]) => {
      if (["specialty", "hourly_rate", "skills"].includes(key)) {
        return userProfile?.role === "provider";
      }
      return true;
    });
  }, [userProfile?.role]);

  const completionPct = useMemo(() => {
    const totalWeight = activeFields.reduce((sum, [, field]) => sum + field.weight, 0);
    const filled = activeFields.reduce(
      (sum, [key, field]) => sum + (form[key]?.trim() ? field.weight : 0),
      0,
    );
    return totalWeight > 0 ? Math.round((filled / totalWeight) * 100) : 0;
  }, [form, activeFields]);

  const profileStatus = useMemo(() => {
    if (completionPct >= 85) return "Excellent";
    if (completionPct >= 60) return "Strong";
    if (completionPct >= 35) return "Fair";
    return "Needs improvement";
  }, [completionPct]);

  const roleLabel = useMemo(() => {
    if (userProfile?.role === "provider") return "Service Provider";
    if (userProfile?.role === "recruiter") return "Recruiter";
    return "Job Seeker";
  }, [userProfile?.role]);

  const filledFieldsCount = useMemo(
    () => activeFields.filter(([key]) => !!form[key]?.trim()).length,
    [activeFields, form],
  );

  const topSkills = useMemo(() => {
    if (!form.skills) return [];
    return form.skills
      .split(",")
      .map((skill) => skill.trim())
      .filter(Boolean)
      .slice(0, 4);
  }, [form.skills]);

  const primaryLocation = form.location?.trim() || "Not set";

  const profileHeadline = form.professional_headline || "Add a strong headline so employers notice you.";

  const sectionGroups = useMemo(() => {
    const groups: Record<string, typeof activeFields> = {};
    activeFields.forEach(([key, field]) => {
      if (!groups[field.section]) groups[field.section] = [];
      groups[field.section].push([key, field]);
    });
    return groups;
  }, [activeFields]);

  const updateField = (field: string, value: string) => {
    let nextValue = value;
    if (field === "phone") {
      nextValue = formatPhoneInput(value);
    } else if (field !== "email") {
      nextValue = sanitizeProfileText(value);
    }
    setForm((prev) => ({ ...prev, [field]: nextValue }));
  };

  useEffect(() => {
    if (!savedBadgeVisible) return;
    setSavedBadgeMounted(true);
    const hideTimer = window.setTimeout(() => setSavedBadgeVisible(false), 3200);
    return () => window.clearTimeout(hideTimer);
  }, [savedBadgeVisible]);

  useEffect(() => {
    if (!savedBadgeMounted || savedBadgeVisible) return;
    const cleanupTimer = window.setTimeout(() => setSavedBadgeMounted(false), 300);
    return () => window.clearTimeout(cleanupTimer);
  }, [savedBadgeMounted, savedBadgeVisible]);

  const saveButtonClass = `inline-flex items-center justify-center rounded-full px-5 py-2.5 text-sm font-semibold transition-all duration-200 ${
    saving
      ? 'bg-blue-200 text-blue-800 cursor-wait'
      : saveSuccess || savedBadgeVisible
      ? 'bg-emerald-600 text-white shadow-xl shadow-emerald-500/20 transform scale-105 animate-pulse'
      : 'bg-blue-600 text-white hover:bg-blue-700'
  }`;

  const handleConnect = () => {
    navigate('/providers');
    push({ message: 'Browse providers and connect with service professionals.', type: 'success' });
  };

  const handleMessage = () => {
    navigate('/support');
    push({ message: 'Message support or explore help options.', type: 'info' });
  };

  const handleMore = () => {
    navigate('/about');
    push({ message: 'Explore more JobBridge resources and tools.', type: 'info' });
  };

  const handleViewJobs = () => {
    navigate('/jobs');
    push({ message: 'Opening the latest opportunities for you.', type: 'success' });
  };

  const handleExploreProviders = () => {
    navigate('/providers');
    push({ message: 'Opening trusted service providers and specialists.', type: 'info' });
  };

  const openAvatarPicker = () => {
    avatarInputRef.current?.click();
  };

  const scrollToSection = (target: "editor" | "security" | "activity") => {
    const section = target === "editor" ? editorRef.current : target === "security" ? securityRef.current : activityRef.current;
    section?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const handlePasswordChange = async () => {
    if (!user) return;
    setPasswordError("");
    if (!newPassword.trim() || !confirmPassword.trim()) {
      setPasswordError('Please enter and confirm your new password.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordError('Passwords do not match.');
      return;
    }
    if (newPassword.length < 8) {
      setPasswordError('Password must be at least 8 characters long.');
      return;
    }

    setPasswordSaving(true);
    try {
      const { error } = await updatePassword(newPassword.trim());
      if (error) throw error;
      push({ message: 'Password updated successfully.', type: 'success' });
      setNewPassword("");
      setConfirmPassword("");
    } catch (err: unknown) {
      const message = err instanceof Error && err.message ? err.message : 'Failed to update password. Please try again.';
      setPasswordError(message);
      push({ message, type: 'error' });
    } finally {
      setPasswordSaving(false);
    }
  };

  const handleReset = () => {
    if (initialFormRef.current) {
      setForm({ ...initialFormRef.current });
      setSaveError("");
      setSaveSuccess(false);
    }
  };

  const handleSave = async () => {
    if (!user) return;
    setSaveError("");
    setSaving(true);

    try {
      const phoneValue = form.phone || "";
      const phoneCheck = phoneValue ? validatePhoneNumber(phoneValue) : { ok: true, normalized: "" };
      if (!phoneCheck.ok) throw new Error(phoneCheck.message);

      const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
      activeFields.forEach(([key]) => {
        if (key === "skills") {
          updates[key] = (form[key] || "")
            .split(",")
            .map((skill: string) => sanitizeProfileText(skill))
            .filter(Boolean);
          return;
        }
        if (key === "phone") {
          updates[key] = phoneCheck.normalized || null;
          return;
        }
        const raw = form[key] || "";
        updates[key] = raw ? sanitizeProfileText(raw) : null;
      });

      if (form.avatar_url) updates.avatar_url = form.avatar_url;
      else updates.avatar_url = null;

      await updateProfile(user.id, updates);
      const normalizedPhone = phoneCheck.normalized ? formatPhoneInput(phoneCheck.normalized) : "";
      const updatedForm = {
        ...form,
        phone: normalizedPhone,
      };
      setForm(updatedForm);
      initialFormRef.current = updatedForm;
      setSaveSuccess(true);
      setSavedBadgeVisible(true);
      push({ message: "Editing saved — your profile is updated.", type: "success" });
      window.setTimeout(() => setSaveSuccess(false), 5000);
    } catch (err: unknown) {
      const message = err instanceof Error && err.message ? err.message : "Failed to save profile. Please try again.";
      setSaveError(message);
      push({ message, type: "error" });
    } finally {
      setSaving(false);
    }
  };

  const handleAvatarUpload = async (file?: File) => {
    if (!user || !file) return;

    const allowedTypes = ["image/png", "image/jpeg", "image/webp"];
    const maxSize = 2 * 1024 * 1024;
    if (!allowedTypes.includes(file.type)) {
      setSaveError("Please upload a PNG, JPG, or WEBP image.");
      return;
    }
    if (file.size > maxSize) {
      setSaveError("Profile image must be 2MB or smaller.");
      return;
    }

    setSaveError("");
    setAvatarUploading(true);

    try {
      const ext = file.name.split(".").pop() || "jpg";
      const path = `${user.id}/${Date.now()}.${ext}`;
      const { error: uploadError } = await supabase.storage.from("profile-images").upload(path, file, { upsert: true });
      if (uploadError) throw uploadError;

      const { data } = supabase.storage.from("profile-images").getPublicUrl(path);
      const publicUrl = data?.publicUrl || "";
      if (!publicUrl) throw new Error("Failed to generate image URL");

      setForm((prev) => ({ ...prev, avatar_url: publicUrl }));
      await updateProfile(user.id, { avatar_url: publicUrl, updated_at: new Date().toISOString() });
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 2500);
    } catch (err: unknown) {
      const message = err instanceof Error && err.message ? err.message : "Could not upload profile image.";
      setSaveError(message);
    } finally {
      setAvatarUploading(false);
      if (avatarInputRef.current) avatarInputRef.current.value = "";
    }
  };

  const renderFormField = (
    key: string,
    field: (typeof PROFILE_FIELDS)[keyof typeof PROFILE_FIELDS],
  ) => {
    const Icon = field.icon;
    const selectOptions: Record<string, Array<{ value: string; label: string }>> = {
      specialty: ["Data Science", "Software Engineering", "UX Design", "Product Management", "DevOps", "Consulting", "Other"].map((value) => ({ value, label: value })),
    };

    const isSelect = key in selectOptions;
    const isTextarea = key === "bio";

    return (
      <div key={key} className="space-y-2">
        <label className="flex items-center gap-2 text-sm font-medium text-slate-700">
          <Icon className="w-4 h-4 text-blue-500" />
          {field.label}
        </label>
        {isTextarea ? (
          <textarea
            value={form[key] || ""}
            onChange={(e) => updateField(key, e.target.value)}
            rows={4}
            placeholder={`Enter your ${field.label.toLowerCase()}...`}
            className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 focus:border-blue-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-100"
          />
        ) : isSelect ? (
          <select
            value={form[key] || ""}
            onChange={(e) => updateField(key, e.target.value)}
            className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 focus:border-blue-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-100"
          >
            <option value="">Select...</option>
            {selectOptions[key].map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        ) : (
          <input
            type={
              key === "phone"
                ? "tel"
                : ["salary_expectation", "hourly_rate", "years_of_experience"].includes(key)
                ? "number"
                : "text"
            }
            value={form[key] || ""}
            onChange={(e) => updateField(key, e.target.value)}
            placeholder={`Enter your ${field.label.toLowerCase()}...`}
            readOnly={key === "email"}
            className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 focus:border-blue-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-100"
          />
        )}
      </div>
    );
  };

  const missingFields = activeFields
    .filter(([key]) => !form[key]?.trim() && key !== "phone")
    .slice(0, 3);

  return (
    <div className="relative min-h-screen overflow-hidden bg-[radial-gradient(circle_at_top_left,_rgba(59,130,246,0.18),_transparent_35%),linear-gradient(135deg,_#f8fbff_0%,_#eef5ff_45%,_#f8fbff_100%)] text-slate-900">
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -left-20 top-24 h-64 w-64 rounded-full bg-blue-400/20 blur-3xl" />
        <div className="absolute right-0 top-40 h-72 w-72 rounded-full bg-sky-300/25 blur-3xl" />
        <div className="absolute bottom-0 left-1/3 h-56 w-56 rounded-full bg-indigo-400/15 blur-3xl" />
      </div>
      <Header />
      <FloatingDecorations className="opacity-55" />
      <input
        ref={avatarInputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        className="sr-only"
        onChange={(e) => handleAvatarUpload(e.target.files?.[0])}
      />

      <main className="relative mx-auto max-w-7xl px-4 py-10">
        <div className="grid gap-6 lg:grid-cols-[360px_minmax(0,1fr)]">
          <aside className="space-y-6">
            <div className="overflow-hidden rounded-[2rem] border border-slate-200/80 bg-white/90 shadow-[0_25px_70px_-25px_rgba(15,23,42,0.35)] backdrop-blur">
              <div className="relative h-32 bg-[linear-gradient(135deg,_#0f4cfd_0%,_#2563eb_45%,_#38bdf8_100%)]">
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,_rgba(255,255,255,0.22),_transparent_42%)]" />
              </div>
              <div className="px-6 pb-6 pt-0">
                <div className="-mt-16 flex flex-col items-center gap-4 text-center sm:flex-row sm:items-end sm:text-left">
                  <button
                    type="button"
                    onClick={openAvatarPicker}
                    className="group relative h-32 w-32 overflow-hidden rounded-full border-4 border-white bg-slate-100 shadow-[0_20px_45px_-18px_rgba(15,23,42,0.55)]"
                  >
                    <img
                      src={avatarSrc}
                      alt="Profile"
                      onError={() => setAvatarLoadFailed(true)}
                      className="h-full w-full object-cover transition duration-300 group-hover:scale-105"
                    />
                    <div className="absolute inset-0 flex items-center justify-center bg-slate-950/45 opacity-0 transition group-hover:opacity-100">
                      <div className="rounded-full bg-white/90 p-2 text-blue-600">
                        <Camera className="h-5 w-5" />
                      </div>
                    </div>
                    {avatarUploading && (
                      <div className="absolute inset-0 flex items-center justify-center bg-slate-950/55 text-white">
                        <Loader className="h-6 w-6 animate-spin" />
                      </div>
                    )}
                  </button>
                  <div className="sm:flex-1">
                    <div className="inline-flex items-center gap-2 rounded-full bg-blue-50 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.24em] text-blue-700">
                      <Sparkles className="h-3.5 w-3.5" />
                      Professional profile
                    </div>
                    <h1 className="mt-3 text-3xl font-bold text-slate-900">{form.full_name || 'Your name'}</h1>
                    <p className="mt-1 text-sm text-slate-600">{profileHeadline}</p>
                    <p className="mt-4 flex flex-wrap items-center justify-center gap-2 text-sm text-slate-500 sm:justify-start">
                      <span className="rounded-full bg-slate-100 px-3 py-1">{roleLabel}</span>
                      <span className="text-slate-400">•</span>
                      <span>{primaryLocation}</span>
                    </p>
                  </div>
                </div>

                <div className="mt-6 grid gap-3 sm:grid-cols-2">
                  <div className="rounded-3xl border border-slate-200 bg-slate-50 p-4 text-sm shadow-sm">
                    <p className="text-xs uppercase tracking-[0.24em] text-slate-500">Connections</p>
                    <p className="mt-2 text-lg font-semibold text-slate-900">3,245</p>
                  </div>
                  <div className="rounded-3xl border border-slate-200 bg-slate-50 p-4 text-sm shadow-sm">
                    <p className="text-xs uppercase tracking-[0.24em] text-slate-500">Profile strength</p>
                    <p className="mt-2 text-lg font-semibold text-slate-900">{profileStatus}</p>
                  </div>
                </div>

                <div className="mt-6 grid gap-3 md:grid-cols-2">
                  <button
                    type="button"
                    onClick={handleViewJobs}
                    className="inline-flex items-center justify-center gap-2 rounded-2xl bg-blue-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-blue-700 active:scale-[0.98]"
                  >
                    <Briefcase className="h-4 w-4" /> View jobs
                  </button>
                  <button
                    type="button"
                    onClick={handleExploreProviders}
                    className="inline-flex items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-100 active:scale-[0.98]"
                  >
                    <Users2 className="h-4 w-4" /> Explore providers
                  </button>
                  <button
                    type="button"
                    onClick={() => scrollToSection("editor")}
                    className="inline-flex items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-100 active:scale-[0.98]"
                  >
                    <Sparkles className="h-4 w-4" /> Edit profile
                  </button>
                  <button
                    type="button"
                    onClick={() => scrollToSection("security")}
                    className="inline-flex items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-100 active:scale-[0.98]"
                  >
                    <ShieldCheck className="h-4 w-4" /> Security
                  </button>
                </div>
              </div>
            </div>

            <div ref={activityRef} className="rounded-[2rem] border border-slate-200/80 bg-white/90 p-6 shadow-[0_20px_60px_-24px_rgba(15,23,42,0.3)] backdrop-blur">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-sm font-semibold text-slate-900">Activity</p>
                  <p className="mt-2 text-sm text-slate-600">Recent profile activity and insights that help recruiters connect with you faster.</p>
                </div>
                <span className="rounded-full bg-blue-100 px-3 py-1 text-xs font-semibold text-blue-700">Active</span>
              </div>
              <div className="mt-6 space-y-4 text-sm text-slate-600">
                <div className="rounded-3xl bg-slate-50 p-4">
                  <p className="font-semibold text-slate-900">Profile views</p>
                  <p className="mt-1">Your profile was viewed 128 times in the last 14 days.</p>
                </div>
                <div className="rounded-3xl bg-slate-50 p-4">
                  <p className="font-semibold text-slate-900">Top match</p>
                  <p className="mt-1">You are in the top 10% for recruiters searching for your skill set.</p>
                </div>
              </div>
            </div>

            <div className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm">
              <p className="text-sm font-semibold text-slate-900">Experience</p>
              <div className="mt-5 space-y-5 text-sm text-slate-600">
                <div className="flex items-start gap-4">
                  <div className="mt-1 h-3 w-3 rounded-full bg-blue-600" />
                  <div>
                    <p className="font-semibold text-slate-900">{profileHeadline || 'Creative Director'}</p>
                    <p className="mt-1">{form.years_of_experience ? `${form.years_of_experience} years experience` : '3 years experience'}</p>
                    <p className="mt-2 text-slate-500">The Company Media Office · Full Time</p>
                  </div>
                </div>
                <div className="flex items-start gap-4">
                  <div className="mt-1 h-3 w-3 rounded-full bg-slate-300" />
                  <div>
                    <p className="font-semibold text-slate-900">SEO Specialist</p>
                    <p className="mt-1 text-slate-500">The Company Media Office · Freelance</p>
                  </div>
                </div>
              </div>
            </div>
          </aside>

          <section className="space-y-6">
            <div ref={editorRef} className="rounded-[2rem] border border-slate-200/80 bg-white/90 p-6 shadow-[0_25px_70px_-25px_rgba(15,23,42,0.32)] backdrop-blur">
              <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <div>
                  <p className="text-sm uppercase tracking-[0.24em] text-blue-500">Profile editor</p>
                  <h2 className="mt-2 text-3xl font-bold text-slate-900">Keep your profile polished</h2>
                  <p className="mt-2 text-sm text-slate-600">Update your details to improve visibility with recruiters and clients.</p>
                </div>
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-end">
                  <div className="rounded-full bg-slate-100 px-4 py-2 text-sm font-medium text-slate-700">
                    {filledFieldsCount}/{activeFields.length} fields • {completionPct}% complete
                  </div>
                  <ProfileCompletionRing percentage={completionPct} />
                </div>
              </div>
              <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex flex-wrap items-center gap-3">
                  <div className="rounded-3xl bg-slate-50 px-4 py-3 text-sm text-slate-600">
                    Edit your profile directly in the fields below and save when ready.
                  </div>
                  {savedBadgeMounted && (
                    <span
                      className={`inline-flex items-center gap-2 rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700 ring-1 ring-blue-100 transition-all duration-300 ${
                        savedBadgeVisible ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-1'
                      }`}
                    >
                      <Check className="h-3.5 w-3.5" /> Saved
                    </span>
                  )}
                </div>
                <div className="flex flex-wrap gap-3">
                  <button
                    onClick={handleReset}
                    disabled={saving}
                    className="inline-flex items-center justify-center rounded-full border border-slate-200 bg-white px-5 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    Reset
                  </button>
                  <button
                    onClick={handleSave}
                    disabled={saving}
                    className={saveButtonClass}
                  >
                    {saving ? (
                      <>
                        <Loader className="w-4 h-4 animate-spin" /> Saving...
                      </>
                    ) : saveSuccess ? (
                      <>
                        <Check className="w-4 h-4" /> Saved
                      </>
                    ) : (
                      'Save changes'
                    )}
                  </button>
                </div>
              </div>
            </div>

            <div className="rounded-[2rem] border border-slate-200/80 bg-white/90 p-6 shadow-[0_20px_60px_-24px_rgba(15,23,42,0.3)] backdrop-blur">
              {saveSuccess && (
                <div className="rounded-2xl border border-blue-200 bg-blue-50 px-4 py-3 text-blue-700">
                  Profile updated successfully.
                </div>
              )}
              {saveError && (
                <div className="rounded-2xl border border-error-container bg-error-container/20 px-4 py-3 text-on-error-container">
                  {saveError}
                </div>
              )}

              {profileLoading ? (
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-10 text-center">
                  <div className="mx-auto mb-4 h-10 w-10 rounded-full border-2 border-blue-200 border-t-blue-600 animate-spin" />
                  <p className="text-sm text-slate-500">Loading your profile...</p>
                </div>
              ) : (
                <div className="space-y-6">
                  {Object.entries(sectionGroups).map(([section, fields]) => (
                    <div key={section} className="space-y-4">
                      <div className="flex items-center justify-between gap-4">
                        <h3 className="text-base font-semibold text-slate-900">
                          {section === 'personal'
                            ? 'Personal details'
                            : section === 'professional'
                            ? 'Professional details'
                            : section === 'provider'
                            ? 'Provider details'
                            : section}
                        </h3>
                        <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                          {section === 'personal'
                            ? 'Core'
                            : section === 'professional'
                            ? 'Career'
                            : section === 'provider'
                            ? 'Service'
                            : section}
                        </span>
                      </div>
                      <div className="grid gap-4 md:grid-cols-2">
                        {fields.map(([key, field]) => (
                          <div key={key} className={key === 'bio' ? 'md:col-span-2' : ''}>
                            {renderFormField(key, field)}
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}

                  <div className="rounded-3xl border border-slate-200 bg-blue-50 p-5 text-sm text-slate-600">
                    Your email is read-only because it is linked to your account.
                  </div>

                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="text-sm text-slate-500">Save your profile to make it visible to recruiters and providers.</div>
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                      <button
                        onClick={handleReset}
                        disabled={saving}
                        className="inline-flex items-center justify-center rounded-2xl border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        Reset changes
                      </button>
                      <button
                        onClick={handleSave}
                        disabled={saving}
                        className={saveButtonClass}
                      >
                        {saving ? (
                          <>
                            <Loader className="w-4 h-4 animate-spin" /> Saving...
                          </>
                        ) : saveSuccess ? (
                          <>
                            <Check className="w-4 h-4" /> Saved
                          </>
                        ) : (
                          'Save profile'
                        )}
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div ref={securityRef} className="rounded-[2rem] border border-slate-200/80 bg-white/90 p-6 shadow-[0_20px_60px_-24px_rgba(15,23,42,0.3)] backdrop-blur">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h3 className="text-base font-semibold text-slate-900">Change password</h3>
                  <p className="mt-1 text-sm text-slate-600">Update your account password securely from this page.</p>
                </div>
                <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-blue-700">
                  Secure
                </span>
              </div>

              <div className="mt-6 space-y-4">
                {passwordError && (
                  <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                    {passwordError}
                  </div>
                )}
                <div className="grid gap-4 md:grid-cols-2">
                  <div>
                    <label className="block text-sm font-medium text-slate-700">New password</label>
                    <input
                      type="password"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="Enter new password"
                      className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 focus:border-blue-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-100"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700">Confirm password</label>
                    <input
                      type="password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="Confirm new password"
                      className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 focus:border-blue-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-100"
                    />
                  </div>
                </div>
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <p className="text-sm text-slate-500">Use a strong password of at least 8 characters.</p>
                  <button
                    type="button"
                    onClick={handlePasswordChange}
                    disabled={passwordSaving}
                    className={`inline-flex items-center justify-center rounded-2xl px-6 py-3 text-sm font-semibold transition ${
                      passwordSaving ? 'bg-blue-200 text-blue-800 cursor-wait' : 'bg-blue-600 text-white hover:bg-blue-700'
                    }`}
                  >
                    {passwordSaving ? (
                      <>
                        <Loader className="w-4 h-4 animate-spin" /> Updating...
                      </>
                    ) : (
                      'Change password'
                    )}
                  </button>
                </div>
              </div>
            </div>

            <div className="grid gap-6 xl:grid-cols-2">
              <div className="rounded-[2rem] border border-slate-200/80 bg-white/90 p-6 shadow-[0_20px_60px_-24px_rgba(15,23,42,0.3)] backdrop-blur">
                <h3 className="text-base font-semibold text-slate-900">Education</h3>
                <div className="mt-4 space-y-4 text-sm text-slate-600">
                  <div className="rounded-3xl bg-slate-50 p-4">
                    <p className="font-semibold text-slate-900">Lorem University</p>
                    <p className="mt-1 text-slate-500">Master of Art</p>
                    <p className="mt-2">2017-2019 · Master of Art</p>
                  </div>
                </div>
              </div>

              <div className="rounded-[2rem] border border-slate-200/80 bg-white/90 p-6 shadow-[0_20px_60px_-24px_rgba(15,23,42,0.3)] backdrop-blur">
                <h3 className="text-base font-semibold text-slate-900">Skills</h3>
                <div className="mt-4 space-y-3">
                  {(topSkills.length ? topSkills : ['Creative Strategy', 'Advertising']).map((skill) => (
                    <div key={skill} className="rounded-3xl border border-slate-200 bg-slate-50 p-4">
                      <div className="flex items-center justify-between gap-3">
                        <p className="font-semibold text-slate-900">{skill}</p>
                        <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">Endorse</span>
                      </div>
                      <p className="mt-2 text-sm text-slate-500">Brief skill description for recruiters and clients.</p>
                    </div>
                  ))}
                </div>
              </div>

              <div className="rounded-[2rem] border border-slate-200/80 bg-white/90 p-6 shadow-[0_20px_60px_-24px_rgba(15,23,42,0.3)] backdrop-blur">
                <h3 className="text-base font-semibold text-slate-900">Honors & awards</h3>
                <div className="mt-4 space-y-4 text-sm text-slate-600">
                  <div className="rounded-3xl bg-slate-50 p-4">
                    <p className="font-semibold text-slate-900">Gold Winner</p>
                    <p className="mt-1 text-slate-500">January 2018</p>
                    <p className="mt-2">Outstanding performance award for project leadership.</p>
                  </div>
                </div>
              </div>

              <div className="rounded-[2rem] border border-slate-200/80 bg-white/90 p-6 shadow-[0_20px_60px_-24px_rgba(15,23,42,0.3)] backdrop-blur">
                <h3 className="text-base font-semibold text-slate-900">Languages</h3>
                <div className="mt-4 space-y-3 text-sm text-slate-600">
                  <div className="rounded-3xl bg-slate-50 p-4">
                    <p className="font-semibold text-slate-900">English</p>
                    <p className="mt-1 text-slate-500">Full professional proficiency</p>
                  </div>
                </div>
              </div>
            </div>
          </section>
        </div>
      </main>
      <BottomNav />
    </div>
  );
}
