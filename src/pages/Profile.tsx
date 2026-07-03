import {
  useState,
  useEffect,
  useMemo,
  useRef,
  type ComponentType,
} from "react";
import { useNavigate } from "react-router-dom";
import Header from "../components/Header";
import BottomNav from "../components/BottomNav";
import { useAuth } from "../contexts/AuthContext";
import { updateProfile, fetchProfile } from "../lib/supabaseQueries";
import { supabase } from "../lib/supabase";
import {
  Camera,
  Check,
  ChevronRight,
  Lock,
  Shield,
  Upload,
  Loader,
  Eye,
  EyeOff,
  RefreshCw,
  Eye as EyeIcon,
  Users,
  Briefcase,
  Settings,
  LogOut,
  HelpCircle,
  ArrowRight,
  ExternalLink,
  MessageCircle,
  TrendingUp,
  Star,
  MapPin,
  Calendar,
  Award,
  Zap,
  Target,
  BookOpen,
  FileText,
  Bell,
  User,
  Mail,
  Phone,
  Globe,
  Hash,
  DollarSign,
  Clock,
  Sparkles,
} from "lucide-react";

const PROFILE_FIELDS = {
  full_name: { label: "Full Name", section: "personal", weight: 2, icon: User },
  phone: { label: "Phone Number", section: "personal", weight: 1, icon: Phone },
  date_of_birth: {
    label: "Date of Birth",
    section: "personal",
    weight: 1,
    icon: Calendar,
  },
  gender: { label: "Gender", section: "personal", weight: 1, icon: Users },
  location: { label: "Location", section: "personal", weight: 1, icon: MapPin },
  professional_headline: {
    label: "Professional Headline",
    section: "professional",
    weight: 2,
    icon: Briefcase,
  },
  years_of_experience: {
    label: "Years of Experience",
    section: "professional",
    weight: 1,
    icon: Clock,
  },
  function: {
    label: "Function / Industry",
    section: "professional",
    weight: 1,
    icon: Globe,
  },
  work_type: {
    label: "Preferred Work Type",
    section: "professional",
    weight: 1,
    icon: Target,
  },
  highest_qualification: {
    label: "Highest Qualification",
    section: "professional",
    weight: 1,
    icon: Award,
  },
  availability: {
    label: "Availability",
    section: "professional",
    weight: 1,
    icon: Zap,
  },
  salary_expectation: {
    label: "Salary Expectation",
    section: "professional",
    weight: 1,
    icon: DollarSign,
  },
  bio: {
    label: "Bio / About",
    section: "professional",
    weight: 2,
    icon: BookOpen,
  },
  is_disabled: {
    label: "Disability Status",
    section: "inclusion",
    weight: 1,
    icon: Shield,
  },
  is_displaced: {
    label: "Displaced Person Status",
    section: "inclusion",
    weight: 1,
    icon: Shield,
  },
  specialty: {
    label: "Service Specialty (Providers)",
    section: "provider",
    weight: 2,
    icon: Star,
  },
  hourly_rate: {
    label: "Hourly Rate (NGN)",
    section: "provider",
    weight: 1,
    icon: DollarSign,
  },
  skills: {
    label: "Skills (comma-separated)",
    section: "provider",
    weight: 1,
    icon: Hash,
  },
};

const DEFAULT_AVATAR = `data:image/svg+xml;utf8,${encodeURIComponent(
  '<svg xmlns="http://www.w3.org/2000/svg" width="160" height="160" viewBox="0 0 160 160"><rect width="160" height="160" fill="#E3E2DF"/><circle cx="80" cy="62" r="28" fill="#C3C6D6"/><path d="M28 146c8-24 29-38 52-38s44 14 52 38" fill="#C3C6D6"/></svg>',
)}`;

const NAV_SECTIONS = [
  {
    title: "Job Seeking",
    items: [
      {
        label: "Hiring employers can find you",
        icon: EyeIcon,
        badge: "On",
        path: "/profile-visibility",
      },
      { label: "Resume & experience", icon: FileText, path: "/ai-resume" },
      { label: "Job preferences", icon: Target, path: "/job-preferences" },
      { label: "Job activity", icon: TrendingUp, path: "/my-jobs" },
    ],
  },
  {
    title: "Community",
    items: [
      { label: "Following", icon: Users, path: "/following" },
      { label: "Messages", icon: MessageCircle, path: "/messages" },
    ],
  },
  {
    title: "Contributions",
    items: [{ label: "Reviews & contributions", icon: Star, path: "/reviews" }],
  },
  {
    title: "Account",
    items: [
      { label: "Account settings", icon: Settings, path: "/profile" },
      { label: "Notifications", icon: Bell, path: "/notifications" },
    ],
  },
];

// Circular progress ring component
function ProfileCompletionRing({ percentage }: { percentage: number }) {
  const radius = 38;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (percentage / 100) * circumference;
  const color =
    percentage >= 80 ? "#10b981" : percentage >= 50 ? "#f59e0b" : "#ef4444";

  return (
    <div className="relative w-24 h-24 mx-auto">
      <svg className="w-24 h-24 -rotate-90" viewBox="0 0 88 88">
        <circle
          cx="44"
          cy="44"
          r={radius}
          fill="none"
          stroke="#e5e7eb"
          strokeWidth="5"
        />
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
          style={{
            transition: "stroke-dashoffset 1.2s cubic-bezier(0.4, 0, 0.2, 1)",
          }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-lg font-bold text-gray-900" style={{ color }}>
          {percentage}%
        </span>
        <span className="text-[10px] text-gray-500 font-medium">Complete</span>
      </div>
    </div>
  );
}

export default function Profile() {
  const { user, profile: userProfile, signOut } = useAuth();
  const navigate = useNavigate();
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [form, setForm] = useState<Record<string, string>>({});
  const [passwordForm, setPasswordForm] = useState({
    current: "",
    newPass: "",
    confirm: "",
  });
  const [showPasswords, setShowPasswords] = useState(false);
  const [passwordMsg, setPasswordMsg] = useState("");
  const [activeSection, setActiveSection] = useState("personal");
  const [profileLoading, setProfileLoading] = useState(true);
  const [hoveredNav, setHoveredNav] = useState<string | null>(null);
  const [avatarHover, setAvatarHover] = useState(false);
  const [avatarLoadFailed, setAvatarLoadFailed] = useState(false);
  const avatarInputRef = useRef<HTMLInputElement>(null);
  const profRef = useRef<HTMLDivElement>(null);

  const getErrorMessage = (err: unknown, fallback: string) => {
    if (err instanceof Error && err.message) return err.message;
    return fallback;
  };

  const normalizeAvatarUrl = (raw?: string) => {
    const value = (raw || "").trim();
    if (!value || value === "null" || value === "undefined") return "";
    return value;
  };

  const openAvatarPicker = () => {
    if (avatarUploading) return;
    avatarInputRef.current?.click();
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
            } else {
              fields[key] = val == null ? "" : String(val);
            }
          });
          fields.avatar_url = String(freshRecord.avatar_url || "");
          fields.email = fresh.email || user?.email || "";
          setForm(fields);
        } else {
          setForm({
            full_name: user.user_metadata?.full_name || "",
            email: user.email || "",
            phone: "",
            date_of_birth: "",
            gender: "",
            location: "",
            professional_headline: "",
            years_of_experience: "",
            function: "",
            work_type: "",
            highest_qualification: "",
            availability: "",
            salary_expectation: "",
            bio: "",
            specialty: "",
            hourly_rate: "",
            skills: "",
            avatar_url: "",
          });
        }
      } catch (err: unknown) {
        if (!cancelled) {
          setSaveError(
            getErrorMessage(
              err,
              "Could not load profile. Please refresh the page.",
            ),
          );
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
      if (["specialty", "hourly_rate", "skills"].includes(key))
        return userProfile?.role === "provider";
      return true;
    });
  }, [userProfile?.role]);

  // Profile completion percentage
  const completionPct = useMemo(() => {
    const totalWeight = activeFields.reduce((s, [, v]) => s + v.weight, 0);
    const filled = activeFields.reduce(
      (s, [k, v]) => s + (form[k]?.trim() ? v.weight : 0),
      0,
    );
    return totalWeight > 0 ? Math.round((filled / totalWeight) * 100) : 0;
  }, [form, activeFields]);

  const updateField = (field: string, value: string) =>
    setForm((prev) => ({ ...prev, [field]: value }));

  const handleSave = async () => {
    if (!user) return;
    setSaveError("");
    setSaving(true);
    try {
      const updates: Record<string, unknown> = {
        updated_at: new Date().toISOString(),
      };
      activeFields.forEach(([key]) => {
        if (key === "skills") {
          updates[key] = (form[key] || "")
            .split(",")
            .map((s: string) => s.trim())
            .filter(Boolean);
        } else {
          updates[key] = form[key] || null;
        }
      });
      if ("avatar_url" in form && form.avatar_url) {
        updates.avatar_url = form.avatar_url;
      } else if ("avatar_url" in form && !form.avatar_url) {
        updates.avatar_url = null;
      }
      await updateProfile(user.id, updates);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
      setTimeout(
        () =>
          profRef.current?.scrollIntoView({
            behavior: "smooth",
            block: "start",
          }),
        300,
      );
    } catch (err: unknown) {
      console.error("Save error:", err);
      setSaveError(
        getErrorMessage(err, "Failed to save profile. Please try again."),
      );
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
      const { error: uploadError } = await supabase.storage
        .from("profile-images")
        .upload(path, file, { upsert: true });

      if (uploadError) throw uploadError;

      const { data } = supabase.storage
        .from("profile-images")
        .getPublicUrl(path);
      const publicUrl = data?.publicUrl || "";
      if (!publicUrl) throw new Error("Failed to generate image URL");

      updateField("avatar_url", publicUrl);
      await updateProfile(user.id, {
        avatar_url: publicUrl,
        updated_at: new Date().toISOString(),
      });
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 2500);
    } catch (err: unknown) {
      console.error("Avatar upload error:", err);
      setSaveError(getErrorMessage(err, "Could not upload profile image."));
    } finally {
      setAvatarUploading(false);
      if (avatarInputRef.current) avatarInputRef.current.value = "";
    }
  };

  const handlePasswordChange = async () => {
    setPasswordMsg("");
    if (!passwordForm.current || !passwordForm.newPass) {
      setPasswordMsg("Fill in all password fields");
      return;
    }
    if (passwordForm.newPass !== passwordForm.confirm) {
      setPasswordMsg("Passwords do not match");
      return;
    }
    if (passwordForm.newPass.length < 6) {
      setPasswordMsg("Password must be at least 6 characters");
      return;
    }

    try {
      const { error } = await supabase.auth.updateUser({
        password: passwordForm.newPass,
      });
      if (error) {
        setPasswordMsg(error.message);
      } else {
        setPasswordMsg("Password updated successfully");
        setPasswordForm({ current: "", newPass: "", confirm: "" });
      }
    } catch (err: unknown) {
      setPasswordMsg(getErrorMessage(err, "Could not update password"));
    }
  };

  // Group fields by section for the form
  const sectionGroups = useMemo(() => {
    const groups: Record<string, typeof activeFields> = {};
    activeFields.forEach(([key, val]) => {
      if (!groups[val.section]) groups[val.section] = [];
      groups[val.section].push([key, val]);
    });
    return groups;
  }, [activeFields]);

  const handleSidebarNav = (item: { path?: string }) => {
    if (item.path) {
      navigate(item.path);
    }
  };

  const sectionMeta: Record<
    string,
    {
      title: string;
      description: string;
      icon: ComponentType<{ className?: string }>;
      gradient: string;
    }
  > = {
    personal: {
      title: "Personal Information",
      description: "Basic details about you",
      icon: User,
      gradient: "from-primary to-primary-container",
    },
    professional: {
      title: "Professional Details",
      description: "Your career and expertise",
      icon: Briefcase,
      gradient: "from-primary to-secondary",
    },
    inclusion: {
      title: "Inclusion & Accessibility",
      description: "Help us serve you better",
      icon: Shield,
      gradient: "from-secondary to-primary",
    },
    provider: {
      title: "Service Provider",
      description: "Your service offering details",
      icon: Zap,
      gradient: "from-primary-container to-primary",
    },
  };

  const renderFormField = (
    key: string,
    field: (typeof PROFILE_FIELDS)[keyof typeof PROFILE_FIELDS],
  ) => {
    const Icon = field.icon;
    const selectFields: Record<string, string[]> = {
      gender: ["Male", "Female", "Non-binary", "Prefer not to say"],
      work_type: ["Remote", "On-site", "Hybrid", "Freelance"],
      highest_qualification: [
        "High School",
        "Associate Degree",
        "Bachelor's",
        "Master's",
        "PhD",
        "Other",
      ],
      availability: [
        "Immediately",
        "Within 2 weeks",
        "Within 1 month",
        "Within 3 months",
        "Not looking",
      ],
      function: [
        "Tech",
        "Finance",
        "Healthcare",
        "Education",
        "Marketing",
        "Engineering",
        "Design",
        "Other",
      ],
      is_disabled: ["No", "Yes", "Prefer not to say"],
      is_displaced: ["No", "Yes", "Prefer not to say"],
      specialty: [
        "Data Science",
        "Software Engineering",
        "UX Design",
        "Product Management",
        "DevOps",
        "Consulting",
        "Other",
      ],
    };

    const isSelect = key in selectFields;
    const isTextarea = key === "bio";

    return (
      <div key={key} className="group relative">
        <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-1.5">
          <Icon className="w-3.5 h-3.5 text-gray-400 group-focus-within:text-blue-500 transition-colors" />
          {field.label}
        </label>
        {isTextarea ? (
          <textarea
            value={form[key] || ""}
            onChange={(e) => updateField(key, e.target.value)}
            rows={3}
            placeholder={`Enter your ${field.label.toLowerCase()}...`}
            className="w-full px-4 py-2.5 border border-gray-200 rounded-xl bg-gray-50/50 focus:bg-white focus:border-blue-400 focus:ring-2 focus:ring-blue-100 focus:outline-none text-sm transition-all duration-200 resize-none"
          />
        ) : isSelect ? (
          <div className="relative">
            <select
              value={form[key] || ""}
              onChange={(e) => updateField(key, e.target.value)}
              className="w-full px-4 py-2.5 border border-gray-200 rounded-xl bg-gray-50/50 focus:bg-white focus:border-blue-400 focus:ring-2 focus:ring-blue-100 focus:outline-none text-sm transition-all duration-200 appearance-none cursor-pointer"
            >
              <option value="">Select...</option>
              {selectFields[key].map((o) => (
                <option key={o} value={o}>
                  {o}
                </option>
              ))}
            </select>
            <ChevronRight className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 rotate-90 pointer-events-none" />
          </div>
        ) : (
          <input
            type={
              key === "date_of_birth"
                ? "date"
                : key === "phone"
                  ? "tel"
                  : key === "salary_expectation" ||
                      key === "hourly_rate" ||
                      key === "years_of_experience"
                    ? "number"
                    : "text"
            }
            value={form[key] || ""}
            onChange={(e) => updateField(key, e.target.value)}
            placeholder={`Enter your ${field.label.toLowerCase()}...`}
            readOnly={key === "email"}
            className={`w-full px-4 py-2.5 border border-gray-200 rounded-xl bg-gray-50/50 focus:bg-white focus:border-blue-400 focus:ring-2 focus:ring-blue-100 focus:outline-none text-sm transition-all duration-200 ${key === "email" ? "text-gray-400 cursor-not-allowed" : ""}`}
          />
        )}
      </div>
    );
  };

  const missingFields = activeFields
    .filter(([key]) => !form[key]?.trim())
    .slice(0, 3);

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <input
        ref={avatarInputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        className="sr-only"
        onChange={(e) => handleAvatarUpload(e.target.files?.[0])}
      />

      {/* Cover Banner with Gradient */}
      <div className="relative h-44 sm:h-52 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-primary via-primary-container to-secondary" />
        <div className="absolute inset-0 opacity-20">
          <div className="absolute top-6 left-[10%] w-32 h-32 bg-white/10 rounded-full blur-2xl" />
          <div className="absolute bottom-4 right-[15%] w-48 h-48 bg-secondary-container rounded-full blur-3xl" />
          <div className="absolute top-10 right-[30%] w-20 h-20 bg-blue-300/20 rounded-full blur-xl" />
        </div>
        {/* Mesh pattern overlay */}
        <div
          className="absolute inset-0"
          style={{
            backgroundImage: `radial-gradient(circle at 1px 1px, rgba(255,255,255,0.07) 1px, transparent 0)`,
            backgroundSize: "24px 24px",
          }}
        />
      </div>

      <div className="max-w-7xl mx-auto px-4 -mt-20 relative z-10 pb-24">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* ─── Left Sidebar ─── */}
          <div className="lg:col-span-3">
            {/* Profile Card */}
            <div
              className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden mb-4"
              style={{
                animation:
                  "pop-in 0.5s cubic-bezier(0.34, 1.56, 0.64, 1) forwards",
              }}
            >
              {/* Mini gradient banner */}
              <div className="h-16 bg-gradient-to-r from-primary to-primary-container relative">
                <div className="absolute -bottom-8 left-1/2 -translate-x-1/2">
                  <button
                    type="button"
                    onClick={openAvatarPicker}
                    className="relative group cursor-pointer"
                    onMouseEnter={() => setAvatarHover(true)}
                    onMouseLeave={() => setAvatarHover(false)}
                    aria-label="Upload profile photo"
                  >
                    <img
                      src={avatarSrc}
                      alt="Profile"
                      onError={() => setAvatarLoadFailed(true)}
                      className="w-16 h-16 rounded-full object-cover border-[3px] border-white shadow-md transition-transform duration-300 group-hover:scale-105"
                    />
                    <div
                      className={`absolute inset-0 rounded-full bg-black/40 flex items-center justify-center transition-opacity duration-200 ${avatarHover ? "opacity-100" : "opacity-0"}`}
                    >
                      <Camera className="w-4 h-4 text-white" />
                    </div>
                    {/* Online indicator */}
                    <div className="absolute bottom-0 right-0 w-4 h-4 bg-emerald-400 rounded-full border-2 border-white" />
                  </button>
                </div>
              </div>

              <div className="pt-12 pb-4 px-4 text-center">
                <h3 className="font-bold text-gray-900 text-base">
                  {form.full_name || "Your Name"}
                </h3>
                <p className="text-xs text-gray-500 mt-0.5">
                  {form.professional_headline || "Add your headline"}
                </p>
                {form.location && (
                  <p className="text-xs text-gray-400 mt-0.5 flex items-center justify-center gap-1">
                    <MapPin className="w-3 h-3" /> {form.location}
                  </p>
                )}
                <p className="text-xs text-primary font-medium mt-1.5">
                  {form.email}
                </p>
              </div>

              {/* Profile Completion */}
              <div className="px-4 pb-4">
                <div className="bg-surface-container-low rounded-xl p-4 border border-outline-variant">
                  <ProfileCompletionRing percentage={completionPct} />
                  <p className="text-xs text-gray-600 text-center mt-2 font-medium">
                    Profile Strength
                  </p>
                  {completionPct < 100 && missingFields.length > 0 && (
                    <div className="mt-3 space-y-1.5">
                      {missingFields.map(([key, field]) => (
                        <button
                          key={key}
                          onClick={() => setActiveSection(field.section)}
                          className="w-full text-left text-xs text-primary hover:text-primary-container bg-surface rounded-lg px-2.5 py-1.5 flex items-center gap-2 hover:bg-surface-container-low transition-colors"
                        >
                          <div className="w-1.5 h-1.5 rounded-full bg-primary flex-shrink-0" />
                          Add {field.label}
                          <ArrowRight className="w-3 h-3 ml-auto opacity-50" />
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Navigation Card */}
            <div
              className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden"
              style={{
                animation:
                  "pop-in 0.6s cubic-bezier(0.34, 1.56, 0.64, 1) forwards",
              }}
            >
              <nav className="p-3">
                {NAV_SECTIONS.map((section, si) => (
                  <div
                    key={section.title}
                    className={
                      si > 0 ? "mt-3 pt-3 border-t border-gray-100" : ""
                    }
                  >
                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1.5 px-2">
                      {section.title}
                    </p>
                    {section.items.map((item) => {
                      const Icon = item.icon;
                      const isHovered = hoveredNav === item.label;
                      return (
                        <button
                          key={item.label}
                          type="button"
                          onClick={() => handleSidebarNav(item)}
                          onMouseEnter={() => setHoveredNav(item.label)}
                          onMouseLeave={() => setHoveredNav(null)}
                          className={`w-full text-left px-2.5 py-2 rounded-xl text-sm flex items-center gap-2.5 transition-all duration-200 ${
                            isHovered
                              ? "bg-secondary-container text-primary translate-x-0.5"
                              : "text-gray-600 hover:bg-gray-50"
                          }`}
                        >
                          <div
                            className={`w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 transition-colors duration-200 ${
                              isHovered
                                ? "bg-primary-fixed text-primary"
                                : "bg-gray-100 text-gray-500"
                            }`}
                          >
                            <Icon className="w-3.5 h-3.5" />
                          </div>
                          <span className="flex-1 text-[13px] font-medium">
                            {item.label}
                          </span>
                          {"badge" in item && item.badge && (
                            <span className="px-1.5 py-0.5 bg-primary-fixed text-primary text-[10px] font-bold rounded-md">
                              {item.badge}
                            </span>
                          )}
                          <ChevronRight
                            className={`w-3.5 h-3.5 text-gray-300 transition-all duration-200 ${isHovered ? "text-primary translate-x-0.5" : ""}`}
                          />
                        </button>
                      );
                    })}
                  </div>
                ))}

                {/* Sign Out */}
                <div className="mt-3 pt-3 border-t border-gray-100">
                  <button
                    onClick={async () => {
                      await signOut();
                      navigate("/");
                    }}
                    className="w-full text-left px-2.5 py-2 rounded-xl text-sm flex items-center gap-2.5 text-primary hover:bg-secondary-container transition-all duration-200"
                  >
                    <div className="w-7 h-7 rounded-lg flex items-center justify-center bg-primary-fixed text-primary flex-shrink-0">
                      <LogOut className="w-3.5 h-3.5" />
                    </div>
                    <span className="flex-1 text-[13px] font-medium">
                      Sign out
                    </span>
                    <ExternalLink className="w-3.5 h-3.5 text-primary" />
                  </button>
                </div>

                {/* Help Center */}
                <div className="mt-3 pt-3 border-t border-gray-100">
                  <button className="w-full py-2.5 border border-gray-200 rounded-xl text-sm font-semibold text-gray-700 hover:bg-gray-50 hover:border-gray-300 transition-all duration-200 flex items-center justify-center gap-2">
                    <HelpCircle className="w-4 h-4" />
                    Help Center
                  </button>
                </div>
              </nav>
            </div>
          </div>

          {/* ─── Middle: Profile Edit Form ─── */}
          <div className="lg:col-span-6" ref={profRef}>
            {/* Success Toast */}
            {saveSuccess && (
              <div
                className="mb-4 bg-emerald-50 border border-emerald-200 text-emerald-700 px-4 py-3 rounded-2xl flex items-center gap-3 shadow-sm"
                style={{
                  animation:
                    "pop-in 0.4s cubic-bezier(0.34, 1.56, 0.64, 1) forwards",
                }}
              >
                <div className="w-8 h-8 rounded-full bg-emerald-100 flex items-center justify-center flex-shrink-0">
                  <Check className="w-4 h-4 text-emerald-600" />
                </div>
                <div>
                  <p className="text-sm font-semibold">
                    Profile updated successfully!
                  </p>
                  <p className="text-xs text-emerald-600">
                    Your changes have been saved.
                  </p>
                </div>
              </div>
            )}

            {saveError && (
              <div className="mb-4 bg-error-container border border-outline-variant text-on-error-container px-4 py-3 rounded-2xl text-sm">
                {saveError}
              </div>
            )}

            {/* Section Tab Pills */}
            <div className="flex gap-2 mb-5 overflow-x-auto pb-1 hide-scrollbar">
              {Object.entries(sectionMeta).map(([key, meta]) => {
                const Icon = meta.icon;
                const isActive = activeSection === key;
                const hasFields = sectionGroups[key]?.length > 0;
                if (!hasFields) return null;
                return (
                  <button
                    key={key}
                    onClick={() => setActiveSection(key)}
                    className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium whitespace-nowrap transition-all duration-300 ${
                      isActive
                        ? "bg-white text-gray-900 shadow-md shadow-gray-200/60 border border-gray-100 scale-[1.02]"
                        : "bg-white/60 text-gray-500 hover:bg-white hover:text-gray-700 border border-transparent"
                    }`}
                  >
                    <div
                      className={`w-6 h-6 rounded-lg flex items-center justify-center transition-all ${
                        isActive
                          ? `bg-gradient-to-br ${meta.gradient} text-white shadow-sm`
                          : "bg-gray-100 text-gray-400"
                      }`}
                    >
                      <Icon className="w-3.5 h-3.5" />
                    </div>
                    {meta.title.split(" ")[0]}
                  </button>
                );
              })}
            </div>

            {/* Form Card */}
            <div
              className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden"
              style={{
                animation:
                  "pop-in 0.5s cubic-bezier(0.34, 1.56, 0.64, 1) forwards",
              }}
            >
              {/* Section Header */}
              {sectionMeta[activeSection] && (
                <div
                  className={`bg-gradient-to-r ${sectionMeta[activeSection].gradient} px-6 py-5`}
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center backdrop-blur-sm">
                      {(() => {
                        const Icon = sectionMeta[activeSection].icon;
                        return <Icon className="w-5 h-5 text-white" />;
                      })()}
                    </div>
                    <div>
                      <h2 className="text-lg font-bold text-white">
                        {sectionMeta[activeSection].title}
                      </h2>
                      <p className="text-sm text-white/70">
                        {sectionMeta[activeSection].description}
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Loading state */}
              {profileLoading ? (
                <div className="p-12 flex flex-col items-center justify-center gap-3">
                  <div className="w-10 h-10 rounded-full border-2 border-blue-200 border-t-blue-600 animate-spin" />
                  <p className="text-sm text-gray-500">
                    Loading your profile...
                  </p>
                </div>
              ) : (
                <div className="p-6">
                  {/* Avatar Section */}
                  <div className="flex items-center gap-5 mb-8 pb-6 border-b border-gray-100">
                    <button
                      type="button"
                      onClick={openAvatarPicker}
                      className="relative group cursor-pointer"
                      onMouseEnter={() => setAvatarHover(true)}
                      onMouseLeave={() => setAvatarHover(false)}
                      aria-label="Upload profile photo"
                    >
                      <img
                        src={avatarSrc}
                        alt="Profile"
                        onError={() => setAvatarLoadFailed(true)}
                        className="w-20 h-20 rounded-2xl object-cover border-2 border-gray-100 shadow-sm transition-all duration-300 group-hover:shadow-lg group-hover:scale-105"
                      />
                      <div className="absolute inset-0 rounded-2xl bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                        <Camera className="w-5 h-5 text-white" />
                      </div>
                    </button>
                    <div className="flex-1">
                      <h3 className="text-lg font-bold text-gray-900">
                        {form.full_name || "Your Name"}
                      </h3>
                      <p className="text-sm text-gray-500">{form.email}</p>
                      <div className="flex gap-2 mt-2">
                        <button
                          type="button"
                          onClick={openAvatarPicker}
                          disabled={avatarUploading}
                          className="px-3 py-1.5 bg-secondary-container text-primary rounded-lg text-xs font-semibold hover:bg-primary-fixed transition-colors flex items-center gap-1.5 disabled:opacity-60"
                        >
                          {avatarUploading ? (
                            <Loader className="w-3 h-3 animate-spin" />
                          ) : (
                            <Upload className="w-3 h-3" />
                          )}{" "}
                          Upload Photo
                        </button>
                        {form.avatar_url && (
                          <button
                            onClick={() => updateField("avatar_url", "")}
                            className="px-3 py-1.5 bg-surface-container-low text-on-surface rounded-lg text-xs font-semibold hover:bg-surface-container transition-colors"
                          >
                            Remove
                          </button>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Form Fields for active section */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-5 gap-y-4">
                    {(sectionGroups[activeSection] || []).map(
                      ([key, field]) => (
                        <div
                          key={key}
                          className={key === "bio" ? "sm:col-span-2" : ""}
                        >
                          {renderFormField(key, field)}
                        </div>
                      ),
                    )}
                  </div>

                  {/* Email (read-only) - only show in personal section */}
                  {activeSection === "personal" && (
                    <div className="mt-4">
                      <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-1.5">
                        <Mail className="w-3.5 h-3.5 text-gray-400" />
                        Email Address
                        <span className="text-[10px] bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded font-medium">
                          Read only
                        </span>
                      </label>
                      <input
                        type="email"
                        value={form.email || ""}
                        readOnly
                        className="w-full px-4 py-2.5 border border-gray-200 rounded-xl bg-gray-50 text-gray-400 cursor-not-allowed text-sm"
                      />
                    </div>
                  )}

                  {/* Save Button */}
                  <div className="mt-8 pt-6 border-t border-gray-100">
                    <div className="flex items-center justify-between gap-4">
                      <p className="text-xs text-gray-400 flex items-center gap-1.5">
                        <RefreshCw className="w-3 h-3" />
                        Auto-synced with your JobBridge profile
                      </p>
                      <button
                        onClick={handleSave}
                        disabled={saving}
                        className={`px-8 py-3 rounded-xl text-sm font-semibold transition-all duration-300 flex items-center justify-center gap-2 min-w-[140px] ${
                          saving
                            ? "bg-gray-200 text-gray-500 cursor-wait"
                            : saveSuccess
                              ? "bg-primary text-on-primary shadow-lg"
                              : "bg-gradient-to-r from-primary to-primary-container text-on-primary hover:shadow-lg hover:-translate-y-0.5 active:translate-y-0"
                        }`}
                      >
                        {saving ? (
                          <>
                            <Loader className="w-4 h-4 animate-spin" />{" "}
                            Saving...
                          </>
                        ) : saveSuccess ? (
                          <>
                            <Check className="w-4 h-4" /> Saved!
                          </>
                        ) : (
                          <>
                            <Sparkles className="w-4 h-4" /> Save Changes
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Password Section */}
            <div
              className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden mt-6"
              style={{
                animation:
                  "pop-in 0.7s cubic-bezier(0.34, 1.56, 0.64, 1) forwards",
              }}
            >
              <div className="px-6 py-5 border-b border-gray-100 flex items-center gap-3">
                <div className="w-10 h-10 bg-secondary-container rounded-xl flex items-center justify-center">
                  <Lock className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <h3 className="font-bold text-gray-900">
                    Security & Password
                  </h3>
                  <p className="text-xs text-gray-500">
                    Change your password to keep your account secure
                  </p>
                </div>
              </div>
              <div className="p-6">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div>
                    <label className="text-sm font-medium text-gray-700 mb-1.5 block">
                      Current Password
                    </label>
                    <div className="relative">
                      <input
                        type={showPasswords ? "text" : "password"}
                        value={passwordForm.current}
                        onChange={(e) =>
                          setPasswordForm((p) => ({
                            ...p,
                            current: e.target.value,
                          }))
                        }
                        className="w-full px-4 py-2.5 border border-gray-200 rounded-xl bg-gray-50/50 focus:bg-white focus:border-blue-400 focus:ring-2 focus:ring-blue-100 focus:outline-none text-sm transition-all duration-200 pr-10"
                        placeholder="••••••••"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-700 mb-1.5 block">
                      New Password
                    </label>
                    <input
                      type={showPasswords ? "text" : "password"}
                      value={passwordForm.newPass}
                      onChange={(e) =>
                        setPasswordForm((p) => ({
                          ...p,
                          newPass: e.target.value,
                        }))
                      }
                      className="w-full px-4 py-2.5 border border-gray-200 rounded-xl bg-gray-50/50 focus:bg-white focus:border-blue-400 focus:ring-2 focus:ring-blue-100 focus:outline-none text-sm transition-all duration-200"
                      placeholder="••••••••"
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-700 mb-1.5 block">
                      Confirm Password
                    </label>
                    <input
                      type={showPasswords ? "text" : "password"}
                      value={passwordForm.confirm}
                      onChange={(e) =>
                        setPasswordForm((p) => ({
                          ...p,
                          confirm: e.target.value,
                        }))
                      }
                      className="w-full px-4 py-2.5 border border-gray-200 rounded-xl bg-gray-50/50 focus:bg-white focus:border-blue-400 focus:ring-2 focus:ring-blue-100 focus:outline-none text-sm transition-all duration-200"
                      placeholder="••••••••"
                    />
                  </div>
                </div>
                <div className="flex items-center justify-between mt-4">
                  <button
                    onClick={() => setShowPasswords(!showPasswords)}
                    className="text-xs text-gray-500 hover:text-gray-700 flex items-center gap-1.5 transition-colors"
                  >
                    {showPasswords ? (
                      <EyeOff className="w-3.5 h-3.5" />
                    ) : (
                      <Eye className="w-3.5 h-3.5" />
                    )}
                    {showPasswords ? "Hide" : "Show"} passwords
                  </button>
                  <button
                    onClick={handlePasswordChange}
                    className="px-5 py-2 bg-primary text-on-primary rounded-xl text-sm font-semibold hover:bg-primary-container transition-all duration-200 hover:shadow-md"
                  >
                    Update Password
                  </button>
                </div>
                {passwordMsg && (
                  <p
                    className={`mt-3 text-sm font-medium px-3 py-2 rounded-lg ${
                      passwordMsg.includes("success")
                        ? "bg-emerald-50 text-emerald-600"
                        : "bg-red-50 text-red-600"
                    }`}
                  >
                    {passwordMsg}
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* ─── Right Sidebar ─── */}
          <div className="lg:col-span-3">
            {/* Quick Stats */}
            <div
              className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 mb-4"
              style={{
                animation:
                  "pop-in 0.6s cubic-bezier(0.34, 1.56, 0.64, 1) forwards",
              }}
            >
              <h3 className="font-bold text-gray-800 text-sm mb-4 flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-primary" />
                Your Activity
              </h3>
              <div className="grid grid-cols-2 gap-3">
                {[
                  {
                    label: "Profile Views",
                    value: "128",
                    icon: Eye,
                    color: "bg-secondary-container text-primary",
                    iconBg: "bg-primary-fixed",
                  },
                  {
                    label: "Applications",
                    value: "24",
                    icon: Briefcase,
                    color: "bg-surface-container-low text-primary",
                    iconBg: "bg-secondary-container",
                  },
                  {
                    label: "Saved Jobs",
                    value: "16",
                    icon: Star,
                    color: "bg-primary-fixed text-primary",
                    iconBg: "bg-secondary-fixed",
                  },
                  {
                    label: "Messages",
                    value: "8",
                    icon: MessageCircle,
                    color: "bg-surface-container-high text-primary",
                    iconBg: "bg-primary-fixed",
                  },
                ].map((stat) => {
                  const Icon = stat.icon;
                  return (
                    <div
                      key={stat.label}
                      className={`${stat.color} rounded-xl p-3 text-center transition-all duration-200 hover:scale-105 cursor-pointer`}
                    >
                      <div
                        className={`w-8 h-8 ${stat.iconBg} rounded-lg flex items-center justify-center mx-auto mb-1.5`}
                      >
                        <Icon className="w-4 h-4" />
                      </div>
                      <p className="text-xl font-bold">{stat.value}</p>
                      <p className="text-[10px] font-medium opacity-70">
                        {stat.label}
                      </p>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Skills / Tags */}
            {form.skills && (
              <div
                className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 mb-4"
                style={{
                  animation:
                    "pop-in 0.7s cubic-bezier(0.34, 1.56, 0.64, 1) forwards",
                }}
              >
                <h3 className="font-bold text-gray-800 text-sm mb-3 flex items-center gap-2">
                  <Zap className="w-4 h-4 text-primary" />
                  Your Skills
                </h3>
                <div className="flex flex-wrap gap-2">
                  {form.skills
                    .split(",")
                    .filter(Boolean)
                    .map((skill, i) => (
                      <span
                        key={i}
                        className="px-3 py-1.5 bg-surface-container-low text-primary text-xs font-semibold rounded-lg border border-outline-variant hover:shadow-sm transition-all duration-200 cursor-default"
                      >
                        {skill.trim()}
                      </span>
                    ))}
                </div>
              </div>
            )}

            {/* Tips Card */}
            <div
              className="bg-gradient-to-br from-primary to-secondary rounded-2xl shadow-sm p-5 text-on-primary relative overflow-hidden"
              style={{
                animation:
                  "pop-in 0.8s cubic-bezier(0.34, 1.56, 0.64, 1) forwards",
              }}
            >
              <div className="absolute top-0 right-0 w-24 h-24 bg-white/10 rounded-full -translate-y-8 translate-x-8 blur-xl" />
              <div className="relative z-10">
                <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center mb-3 backdrop-blur-sm">
                  <Sparkles className="w-5 h-5 text-white" />
                </div>
                <h3 className="font-bold text-sm mb-1">Pro Tip</h3>
                <p className="text-xs text-white/80 leading-relaxed">
                  Profiles with a professional photo and complete details get{" "}
                  <span className="font-bold text-white">
                    3x more visibility
                  </span>{" "}
                  from recruiters.
                </p>
                <button className="mt-3 px-4 py-2 bg-white/20 hover:bg-white/30 backdrop-blur-sm rounded-lg text-xs font-semibold transition-all duration-200 flex items-center gap-1.5">
                  Learn more <ArrowRight className="w-3 h-3" />
                </button>
              </div>
            </div>

            {/* Community Bowls */}
            <div
              className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 mt-4"
              style={{
                animation:
                  "pop-in 0.9s cubic-bezier(0.34, 1.56, 0.64, 1) forwards",
              }}
            >
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-bold text-gray-800 text-sm flex items-center gap-2">
                  <Users className="w-4 h-4 text-primary" />
                  Communities
                </h3>
                <a
                  href="#"
                  className="text-xs text-primary font-semibold flex items-center gap-1 hover:text-primary-container transition-colors"
                >
                  Explore <ArrowRight className="w-3 h-3" />
                </a>
              </div>
              <div className="space-y-3">
                {[
                  {
                    title: "Job Referrals!",
                    members: "1M",
                    color: "bg-primary-fixed text-primary",
                  },
                  {
                    title: "Career Advice",
                    members: "4M",
                    color: "bg-secondary-container text-primary",
                  },
                  {
                    title: "Tech Professionals",
                    members: "2.5M",
                    color: "bg-surface-container-high text-primary",
                  },
                ].map((bowl, i) => (
                  <div
                    key={i}
                    className="flex items-center gap-3 p-2.5 rounded-xl hover:bg-gray-50 transition-all duration-200 cursor-pointer group"
                  >
                    <div
                      className={`w-9 h-9 ${bowl.color} rounded-xl flex items-center justify-center flex-shrink-0 font-bold text-sm`}
                    >
                      {bowl.title[0]}
                    </div>
                    <div className="flex-1 min-w-0">
                      <h4 className="text-sm font-semibold text-gray-900 truncate">
                        {bowl.title}
                      </h4>
                      <p className="text-[10px] text-gray-500">
                        {bowl.members} members
                      </p>
                    </div>
                    <button className="px-3 py-1.5 border border-outline-variant rounded-lg text-[11px] font-semibold text-on-surface hover:bg-secondary-container hover:text-primary hover:border-primary-fixed transition-all duration-200 opacity-0 group-hover:opacity-100">
                      Join
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      <BottomNav />
    </div>
  );
}
