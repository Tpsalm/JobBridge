import { useState, useCallback, useRef } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuth, UserRole } from "../contexts/AuthContext";
import {
  Wrench,
  ArrowRight,
  Check,
  Shield,
  Building,
  Eye,
  EyeOff,
  User,
  Lock,
  Mail,
  AlertCircle,
  Loader2,
  RefreshCw,
  CreditCard,
  Zap,
  CheckCircle2,
} from "lucide-react";
import JobBridgeLogo from "../components/JobBridgeLogo";
import { checkRateLimit } from "../lib/security";
import { PROVIDER_CATEGORIES } from "../lib/providerCategories";
import {
  activateServiceTrialForUser,
  detectCardBrand,
  formatCardNumber,
  formatCardExpiry,
  formatCardCvv,
  validateCardDetails,
  generateSecureCardToken,
  savePendingTrial,
} from "../lib/trial";

// ── Password strength helpers ──────────────────────────────────────────
function getPasswordStrength(pw: string): { score: number; label: string; color: string; bg: string } {
  if (!pw) return { score: 0, label: '', color: '', bg: '' };
  let score = 0;
  if (pw.length >= 8) score++;
  if (pw.length >= 12) score++;
  if (/[A-Z]/.test(pw)) score++;
  if (/[0-9]/.test(pw)) score++;
  if (/[^A-Za-z0-9]/.test(pw)) score++;

  if (score <= 1) return { score, label: 'Very Weak', color: 'text-red-600', bg: 'bg-red-500' };
  if (score === 2) return { score, label: 'Weak', color: 'text-orange-600', bg: 'bg-orange-500' };
  if (score === 3) return { score, label: 'Fair', color: 'text-yellow-600', bg: 'bg-yellow-500' };
  if (score === 4) return { score, label: 'Strong', color: 'text-blue-600', bg: 'bg-blue-500' };
  return { score, label: 'Very Strong', color: 'text-green-600', bg: 'bg-green-500' };
}

// ── Resend cooldown (seconds) ──────────────────────────────────────────
const RESEND_COOLDOWN = 60;

export default function Signup() {
  const { signUp } = useAuth();
  const navigate = useNavigate();
  const [step, setStep] = useState<"role" | "form">("role");
  const [selectedRole, setSelectedRole] = useState<UserRole>(null);
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    password: "",
    company: "",
    serviceCategory: "",
    agreeToTerms: false,
  });

  // Service Provider debit card state
  const [cardData, setCardData] = useState({
    cardNumber: "",
    expiry: "",
    cvv: "",
    cardHolder: "",
  });
  const [cardErrors, setCardErrors] = useState<{
    cardNumber?: string;
    expiry?: string;
    cvv?: string;
    cardHolder?: string;
    general?: string;
  }>({});

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [nameError, setNameError] = useState("");
  const [emailError, setEmailError] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [emailSent, setEmailSent] = useState(false);
  const [emailStatusMessage, setEmailStatusMessage] = useState<string | null>(null);
  const isProvider = selectedRole === "provider";

  // Resend state
  const [resending, setResending] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);
  const [resendMessage, setResendMessage] = useState("");

  const handleRoleSelect = (role: UserRole) => {
    setSelectedRole(role);
    setStep("form");
  };

  const strength = getPasswordStrength(formData.password);
  const cardBrand = detectCardBrand(cardData.cardNumber);

  // Start resend cooldown timer
  const startCooldown = useCallback(() => {
    setResendCooldown(RESEND_COOLDOWN);
    const interval = setInterval(() => {
      setResendCooldown((prev) => {
        if (prev <= 1) { clearInterval(interval); return 0; }
        return prev - 1;
      });
    }, 1000);
  }, []);

  const handleResendEmail = async () => {
    if (resendCooldown > 0) return;
    setResending(true);
    setResendMessage("");

    // Re-trigger signup with same data (Supabase resends confirmation if user exists)
    const { error: signupErr } = await signUp(
      formData.email,
      formData.password,
      formData.name,
      selectedRole,
      formData.company,
      selectedRole === "provider" ? formData.serviceCategory : undefined,
    );

    setResending(false);

    if (signupErr) {
      // "User already registered" means our resend worked — Supabase resent the email
      if (
        signupErr.message.toLowerCase().includes("already") ||
        signupErr.message.toLowerCase().includes("registered")
      ) {
        setResendMessage("Confirmation email resent! Check your inbox.");
        startCooldown();
      } else {
        setResendMessage(`Could not resend: ${signupErr.message}`);
      }
    } else {
      setResendMessage("Confirmation email resent! Check your inbox.");
      startCooldown();
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedRole) return;

    // Clear previous errors
    setError(null);
    setNameError("");
    setEmailError("");
    setCardErrors({});

    if (!checkRateLimit("signup", 5, 60000)) {
      setError("Too many attempts. Try again later.");
      return;
    }

    // Validate name
    if (formData.name.trim().length < 2) {
      setNameError("Full name must be at least 2 characters.");
      return;
    }

    // Validate email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(formData.email)) {
      setEmailError("Please enter a valid email address.");
      return;
    }

    // Validate password
    if (formData.password.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }

    if (selectedRole === "provider" && !formData.serviceCategory) {
      setError("Please select a service category.");
      return;
    }

    // Service Providers must include their debit card information before
    // account creation so the 30-day free trial starts automatically.
    let cardToken = "";
    if (selectedRole === "provider") {
      const activeCardHolder = cardData.cardHolder.trim() || formData.name.trim();
      const cardToValidate = { ...cardData, cardHolder: activeCardHolder };
      const cardValidation = validateCardDetails(cardToValidate);

      if (!cardValidation.valid) {
        if (cardValidation.field) {
          setCardErrors({ [cardValidation.field]: cardValidation.error });
        } else {
          setCardErrors({ general: cardValidation.error || "Please check your debit card details." });
        }
        return;
      }

      cardToken = generateSecureCardToken(cardToValidate);
    }

    setLoading(true);
    try {
      const { error: signupErr, session: newSession, emailWarning } = await signUp(
        formData.email,
        formData.password,
        formData.name,
        selectedRole,
        formData.company,
        selectedRole === "provider" ? formData.serviceCategory : undefined,
      );

      if (signupErr) {
        let msg = "Failed to create account. Please try again.";
        const errObj: any = signupErr;
        if (typeof errObj?.message === "string" && errObj.message.trim()) {
          msg = errObj.message.trim();
        }
        console.error("[Signup Error]", signupErr);
        setError(msg);
        window.dispatchEvent(
          new CustomEvent("jobbridge:toast", {
            detail: { message: msg, type: "error" },
          }),
        );
        setLoading(false);
        return;
      }

      if (emailWarning) {
        setEmailStatusMessage(emailWarning);
      } else {
        setEmailStatusMessage(null);
      }

      if (newSession) {
        setLoading(false);
        if (selectedRole === "provider") {
          // Immediately activate the 30-day free trial with saved card token
          void activateServiceTrialForUser(
            newSession.user.id,
            "service_monthly",
            cardToken,
          );
          navigate("/profile?trial=started");
          window.dispatchEvent(
            new CustomEvent("jobbridge:toast", {
              detail: {
                message: "🎉 Welcome! Your 30-day free trial has been activated.",
                type: "success",
              },
            }),
          );
        } else {
          navigate("/profile");
          window.dispatchEvent(
            new CustomEvent("jobbridge:toast", {
              detail: {
                message: "Account created! Complete your profile to get started.",
                type: "success",
              },
            }),
          );
        }
      } else {
        // Email confirmation required flow
        if (selectedRole === "provider" && cardToken) {
          savePendingTrial(cardToken, formData.email);
        }
        setEmailSent(true);
        setLoading(false);
        startCooldown();
        window.dispatchEvent(
          new CustomEvent("jobbridge:toast", {
            detail: {
              message: isProvider
                ? "Account created! Check your email to confirm and activate your 30-day free trial."
                : "Account created! Check your email for the confirmation link.",
              type: "success",
            },
          }),
        );
      }
    } catch (e: any) {
      console.error("[Signup Exception]", e);
      const errorMessage =
        typeof e?.message === "string" && e.message.trim()
          ? e.message.trim()
          : "An unexpected error occurred. Please try again.";
      setError(errorMessage);
      setLoading(false);
    }
  };

  const handleBack = () => {
    setStep("role");
    setSelectedRole(null);
    setError(null);
    setNameError("");
    setEmailError("");
    setCardErrors({});
    setEmailStatusMessage(null);
  };

  // ── Shared background ──
  const bg = (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      <div className="absolute top-20 left-20 w-96 h-96 bg-blue-500/20 rounded-full blur-3xl animate-pulse" />
      <div className="absolute bottom-20 right-20 w-72 h-72 bg-indigo-400/20 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1s' }} />
      <img
        src="https://images.pexels.com/photos/3194519/pexels-photo-3194519.jpeg?auto=compress&cs=tinysrgb&w=1920&h=1080&dpr=2"
        alt=""
        className="absolute inset-0 w-full h-full object-cover opacity-5"
      />
    </div>
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-900 via-blue-800 to-indigo-900 flex items-center justify-center p-4 relative">
      {bg}

      <div className="relative w-full max-w-2xl">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-white mb-4 shadow-lg ring-4 ring-white/20">
            <JobBridgeLogo variant="icon" iconSize={40} />
          </div>
          <h1 className="text-3xl font-bold text-white">Welcome to JobBridge</h1>
          <p className="text-blue-200 mt-2">
            Connect. Hire. Grow. Nigeria's #1 Professional Network
          </p>
        </div>

        {step === "role" ? (
          /* ── Role Selection ── */
          <div className="bg-white rounded-3xl shadow-2xl p-8 sm:p-10">
            <h2 className="text-2xl font-bold text-gray-900 text-center mb-2">
              Choose how you want to join
            </h2>
            <p className="text-gray-500 text-center mb-8">
              Select your role to get started
            </p>

            <div className="flex flex-col gap-4">
              {/* Job Seeker */}
              <button
                onClick={() => handleRoleSelect("job_seeker")}
                className="group relative p-6 bg-gradient-to-br from-purple-50 to-purple-100 border-2 border-purple-200 rounded-2xl hover:border-purple-500 hover:shadow-lg transition-all text-left"
              >
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 rounded-xl bg-purple-600 flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform">
                    <User className="w-6 h-6 text-white" />
                  </div>
                  <div className="flex-1">
                    <h3 className="font-bold text-gray-900 text-lg">
                      Sign up as a Job Seeker
                    </h3>
                    <p className="text-sm text-gray-600 mt-1">
                      Browse jobs, apply with AI-optimized resumes, and land your dream role
                    </p>
                  </div>
                  <ArrowRight className="w-5 h-5 text-purple-600 group-hover:translate-x-1 transition-transform" />
                </div>
                <div className="mt-4 pt-4 border-t border-purple-200">
                  <ul className="space-y-2">
                    {["Search thousands of jobs", "AI resume builder", "Cover letter generator", "Track applications"].map((feature) => (
                      <li key={feature} className="flex items-center gap-2 text-sm text-gray-600">
                        <Check className="w-4 h-4 text-purple-600" />
                        {feature}
                      </li>
                    ))}
                  </ul>
                </div>
              </button>

              <div className="grid sm:grid-cols-2 gap-4">
                {/* Recruiter */}
                <button
                  onClick={() => handleRoleSelect("recruiter")}
                  className="group relative p-6 bg-gradient-to-br from-blue-50 to-blue-100 border-2 border-blue-200 rounded-2xl hover:border-blue-500 hover:shadow-lg transition-all text-left"
                >
                  <div className="flex items-start gap-4">
                    <div className="w-12 h-12 rounded-xl bg-blue-600 flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform">
                      <Building className="w-6 h-6 text-white" />
                    </div>
                    <div className="flex-1">
                      <h3 className="font-bold text-gray-900 text-lg">Sign up as Recruiter</h3>
                      <p className="text-sm text-gray-600 mt-1">Post jobs, find talent, and hire top candidates</p>
                    </div>
                    <ArrowRight className="w-5 h-5 text-blue-600 group-hover:translate-x-1 transition-transform" />
                  </div>
                  <div className="mt-4 pt-4 border-t border-blue-200">
                    <ul className="space-y-2">
                      {["Post unlimited jobs", "Access talent database", "AI-powered matching", "Schedule interviews"].map((feature) => (
                        <li key={feature} className="flex items-center gap-2 text-sm text-gray-600">
                          <Check className="w-4 h-4 text-blue-600" />
                          {feature}
                        </li>
                      ))}
                    </ul>
                  </div>
                </button>

                {/* Service Provider */}
                <button
                  onClick={() => handleRoleSelect("provider")}
                  className="group relative p-6 bg-gradient-to-br from-emerald-50 to-emerald-100 border-2 border-emerald-200 rounded-2xl hover:border-emerald-500 hover:shadow-lg transition-all text-left"
                >
                  <div className="flex items-start gap-4">
                    <div className="w-12 h-12 rounded-xl bg-emerald-600 flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform">
                      <Wrench className="w-6 h-6 text-white" />
                    </div>
                    <div className="flex-1">
                      <h3 className="font-bold text-gray-900 text-lg">Sign up as Service Provider</h3>
                      <p className="text-sm text-gray-600 mt-1">Offer services, get clients, grow your business</p>
                    </div>
                    <ArrowRight className="w-5 h-5 text-emerald-600 group-hover:translate-x-1 transition-transform" />
                  </div>
                  <div className="mt-4 pt-4 border-t border-emerald-200">
                    <ul className="space-y-2">
                      {["30-day free trial — ₦0 charged today", "Verified professional listing", "Direct client inquiries & job leads", "Card saved for seamless post-trial auto-billing"].map((feature) => (
                        <li key={feature} className="flex items-center gap-2 text-sm text-gray-600">
                          <Check className="w-4 h-4 text-emerald-600" />
                          {feature}
                        </li>
                      ))}
                    </ul>
                  </div>
                </button>
              </div>
            </div>

            <div className="mt-8 pt-6 border-t border-gray-100 text-center">
              <p className="text-sm text-gray-500">
                Already have an account?{" "}
                <Link to="/login" className="font-semibold text-blue-700 hover:text-blue-800 transition-colors">
                  Sign in
                </Link>
              </p>
              <p className="mt-3 text-xs text-gray-400 flex items-center justify-center gap-1 mx-auto">
                <Lock className="w-3 h-3" /> Admin accounts are provisioned internally
              </p>
            </div>
          </div>
        ) : emailSent ? (
          /* ── Email Confirmation View ── */
          <div className="bg-white rounded-3xl shadow-2xl p-8 sm:p-10 text-center">
            <div className="w-20 h-20 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-6">
              <Mail className="w-10 h-10 text-blue-600" />
            </div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">Check Your Email</h2>
            <p className="text-gray-500 mb-2">We sent a confirmation link to</p>
            <p className="font-semibold text-gray-900 mb-6">{formData.email}</p>
            {emailStatusMessage ? (
              <div className="bg-amber-50 border border-amber-100 rounded-xl p-4 mb-6 text-left text-amber-800">
                <p className="font-semibold">Email delivery issue</p>
                <p className="text-sm mt-1">{emailStatusMessage}</p>
              </div>
            ) : null}

            <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 mb-6 text-left">
              <h3 className="font-semibold text-sm text-blue-800 mb-2">What happens next?</h3>
              <ol className="space-y-2 text-sm text-blue-700">
                <li className="flex items-start gap-2">
                  <span className="font-bold">1.</span>
                  <span>Open the email we just sent you</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="font-bold">2.</span>
                  <span>Click the <strong>Confirm your email</strong> button in the email</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="font-bold">3.</span>
                  <span>
                    {isProvider
                      ? "Your account and 30-day free trial will start immediately!"
                      : "Return here and sign in to get started"}
                  </span>
                </li>
              </ol>
            </div>

            {/* Resend email */}
            <div className="mb-6">
              {resendMessage && (
                <p className={`text-sm mb-3 font-medium ${resendMessage.startsWith('Could') ? 'text-red-600' : 'text-green-600'}`}>
                  {resendMessage}
                </p>
              )}
              <button
                onClick={handleResendEmail}
                disabled={resending || resendCooldown > 0}
                className="flex items-center justify-center gap-2 mx-auto text-sm font-medium text-blue-700 hover:text-blue-900 transition-colors disabled:text-gray-400 disabled:cursor-not-allowed"
              >
                {resending ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Resending...
                  </>
                ) : resendCooldown > 0 ? (
                  `Resend available in ${resendCooldown}s`
                ) : (
                  <>
                    <RefreshCw className="w-4 h-4" />
                    Resend confirmation email
                  </>
                )}
              </button>
            </div>

            <p className="text-xs text-gray-400 mb-6">
              Didn't receive the email? Check your spam folder or click resend above.
            </p>

            <button
              onClick={() => navigate("/login")}
              className="w-full bg-blue-700 text-white py-3 rounded-xl font-semibold hover:bg-blue-800 active:scale-[0.98] transition-all mb-3"
            >
              Go to Sign In
            </button>
            <button
              onClick={() => {
                setEmailSent(false);
                setStep("form");
                setResendMessage("");
                setResendCooldown(0);
              }}
              className="w-full text-sm text-gray-500 hover:text-gray-700 transition-colors"
            >
              Use a different email
            </button>
          </div>
        ) : (
          /* ── Signup Form ── */
          <div className="bg-white rounded-3xl shadow-2xl p-8 sm:p-10">
            <button
              onClick={handleBack}
              className="text-sm text-gray-500 hover:text-gray-700 mb-4 flex items-center gap-1 transition-colors"
            >
              ← Back to role selection
            </button>

            <div className="flex items-center gap-3 mb-6">
              <div
                className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                  selectedRole === "recruiter"
                    ? "bg-blue-600"
                    : selectedRole === "provider"
                      ? "bg-emerald-600"
                      : selectedRole === "admin"
                        ? "bg-gray-900"
                        : "bg-purple-600"
                }`}
              >
                {selectedRole === "recruiter" ? (
                  <Building className="w-5 h-5 text-white" />
                ) : selectedRole === "provider" ? (
                  <Wrench className="w-5 h-5 text-white" />
                ) : selectedRole === "admin" ? (
                  <Shield className="w-5 h-5 text-white" />
                ) : (
                  <User className="w-5 h-5 text-white" />
                )}
              </div>
              <div>
                <h2 className="text-xl font-bold text-gray-900">
                  {selectedRole === "recruiter"
                    ? "Create Recruiter Account"
                    : selectedRole === "provider"
                      ? "Create Service Provider Account"
                      : selectedRole === "admin"
                        ? "Create Admin Account"
                        : "Create Job Seeker Account"}
                </h2>
                <p className="text-sm text-gray-500">
                  {selectedRole === "provider"
                    ? "Include your details and debit card to start your 30-day free trial"
                    : "Fill in your details to get started"}
                </p>
              </div>
            </div>

            <form onSubmit={handleSubmit} className="space-y-5" noValidate>
              {/* Full Name */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  Full Name *
                </label>
                <input
                  type="text"
                  required
                  minLength={2}
                  value={formData.name}
                  onChange={(e) => {
                    const nextName = e.target.value;
                    setFormData({ ...formData, name: nextName });
                    if (nextName.trim().length >= 2) setNameError("");
                    if (!cardData.cardHolder || cardData.cardHolder === formData.name) {
                      setCardData((prev) => ({ ...prev, cardHolder: nextName }));
                    }
                  }}
                  className={`w-full px-4 py-3 border rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition ${
                    nameError ? "border-red-400 bg-red-50" : "border-gray-300"
                  }`}
                  placeholder="Enter your full name"
                />
                {nameError && (
                  <p className="mt-1.5 text-xs text-red-600 flex items-center gap-1">
                    <AlertCircle className="w-3 h-3 shrink-0" />
                    {nameError}
                  </p>
                )}
              </div>

              {/* Email */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  Email Address *
                </label>
                <input
                  type="email"
                  required
                  value={formData.email}
                  onChange={(e) => {
                    setFormData({ ...formData, email: e.target.value });
                    if (emailError) setEmailError("");
                  }}
                  className={`w-full px-4 py-3 border rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition ${
                    emailError ? "border-red-400 bg-red-50" : "border-gray-300"
                  }`}
                  placeholder="you@example.com"
                />
                {emailError && (
                  <p className="mt-1.5 text-xs text-red-600 flex items-center gap-1">
                    <AlertCircle className="w-3 h-3 shrink-0" />
                    {emailError}
                  </p>
                )}
              </div>

              {/* Password + strength */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  Password *
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? "text" : "password"}
                    required
                    minLength={6}
                    value={formData.password}
                    onChange={(e) =>
                      setFormData({ ...formData, password: e.target.value })
                    }
                    className="w-full px-4 py-3 pr-12 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition"
                    placeholder="Minimum 6 characters"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                    aria-label={showPassword ? "Hide password" : "Show password"}
                  >
                    {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>

                {/* Password strength bar */}
                {formData.password.length > 0 && (
                  <div className="mt-2">
                    <div className="flex gap-1 mb-1">
                      {[1, 2, 3, 4, 5].map((i) => (
                        <div
                          key={i}
                          className={`h-1.5 flex-1 rounded-full transition-all duration-300 ${
                            i <= strength.score ? strength.bg : "bg-gray-200"
                          }`}
                        />
                      ))}
                    </div>
                    <p className={`text-xs font-medium ${strength.color}`}>
                      {strength.label}
                      {strength.score < 3 && " — try adding numbers, symbols, or uppercase letters"}
                    </p>
                  </div>
                )}

                {formData.password.length > 0 && formData.password.length < 6 && (
                  <p className="text-xs text-red-500 mt-1">
                    Password must be at least 6 characters
                  </p>
                )}
              </div>

              {/* Company (Recruiter only) */}
              {selectedRole === "recruiter" && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">
                    Company Name (Optional)
                  </label>
                  <input
                    type="text"
                    value={formData.company}
                    onChange={(e) =>
                      setFormData({ ...formData, company: e.target.value })
                    }
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition"
                    placeholder="Your company name"
                  />
                </div>
              )}

              {/* Service Category (Provider only) */}
              {selectedRole === "provider" && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">
                    Service Category *
                  </label>
                  <select
                    required
                    value={formData.serviceCategory}
                    onChange={(e) =>
                      setFormData({ ...formData, serviceCategory: e.target.value })
                    }
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition bg-white"
                  >
                    <option value="">Select your service category</option>
                    {PROVIDER_CATEGORIES.map((category) => (
                      <option key={category} value={category}>
                        {category}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* ── Debit Card Details (Service Provider 30-Day Free Trial) ── */}
              {isProvider && (
                <div className="mt-6 pt-5 border-t border-emerald-100 rounded-2xl bg-gradient-to-br from-emerald-50/60 via-slate-50 to-blue-50/40 p-5 border border-emerald-200/80 shadow-sm">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-lg bg-emerald-600 flex items-center justify-center text-white shadow-sm">
                        <CreditCard className="w-4 h-4" />
                      </div>
                      <div>
                        <h3 className="text-sm font-bold text-gray-900 flex items-center gap-1.5">
                          Debit Card Details
                          <span className="text-[11px] font-semibold bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full">
                            30-Day Free Trial
                          </span>
                        </h3>
                        <p className="text-xs text-gray-500">
                          ₦0 charged today • Auto-bills after 30 days
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <span className="text-xs font-bold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-lg border border-emerald-200">
                        Due Today: ₦0
                      </span>
                    </div>
                  </div>

                  {/* Highlights */}
                  <div className="grid grid-cols-2 gap-2 mb-4">
                    <div className="flex items-center gap-1.5 text-xs text-emerald-800 bg-emerald-100/60 px-2.5 py-1.5 rounded-lg">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                      <span>Free for 30 full days</span>
                    </div>
                    <div className="flex items-center gap-1.5 text-xs text-blue-800 bg-blue-100/60 px-2.5 py-1.5 rounded-lg">
                      <Zap className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                      <span>Cancel anytime in 1 click</span>
                    </div>
                  </div>

                  {cardErrors.general && (
                    <div className="mb-3 p-2.5 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700 flex items-center gap-1.5">
                      <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                      <span>{cardErrors.general}</span>
                    </div>
                  )}

                  <div className="space-y-3.5">
                    {/* Cardholder Name */}
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">
                        Cardholder Name *
                      </label>
                      <input
                        type="text"
                        required
                        value={cardData.cardHolder || formData.name}
                        onChange={(e) => {
                          setCardData({ ...cardData, cardHolder: e.target.value });
                          if (cardErrors.cardHolder) setCardErrors((prev) => ({ ...prev, cardHolder: undefined }));
                        }}
                        className={`w-full px-3.5 py-2.5 bg-white text-sm border rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition ${
                          cardErrors.cardHolder ? "border-red-400 bg-red-50/50" : "border-gray-300"
                        }`}
                        placeholder="Name on card"
                      />
                      {cardErrors.cardHolder && (
                        <p className="mt-1 text-xs text-red-600">{cardErrors.cardHolder}</p>
                      )}
                    </div>

                    {/* Card Number */}
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label className="block text-xs font-medium text-gray-700">
                          Debit Card Number *
                        </label>
                        <span className="text-[11px] font-semibold uppercase tracking-wider text-gray-500">
                          {cardBrand !== "generic" ? (
                            <span className="text-emerald-700 font-bold">{cardBrand}</span>
                          ) : (
                            "Visa / Mastercard / Verve"
                          )}
                        </span>
                      </div>
                      <div className="relative">
                        <input
                          type="text"
                          inputMode="numeric"
                          required
                          value={cardData.cardNumber}
                          onChange={(e) => {
                            const formatted = formatCardNumber(e.target.value);
                            setCardData({ ...cardData, cardNumber: formatted });
                            if (cardErrors.cardNumber) setCardErrors((prev) => ({ ...prev, cardNumber: undefined }));
                          }}
                          maxLength={23}
                          className={`w-full px-3.5 py-2.5 bg-white text-sm font-mono tracking-wider border rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition ${
                            cardErrors.cardNumber ? "border-red-400 bg-red-50/50" : "border-gray-300"
                          }`}
                          placeholder="0000 0000 0000 0000"
                        />
                        <div className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none">
                          <CreditCard className="w-4 h-4" />
                        </div>
                      </div>
                      {cardErrors.cardNumber && (
                        <p className="mt-1 text-xs text-red-600">{cardErrors.cardNumber}</p>
                      )}
                    </div>

                    {/* Expiry and CVV */}
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">
                          Expiry Date (MM/YY) *
                        </label>
                        <input
                          type="text"
                          inputMode="numeric"
                          required
                          value={cardData.expiry}
                          onChange={(e) => {
                            const formatted = formatCardExpiry(e.target.value);
                            setCardData({ ...cardData, expiry: formatted });
                            if (cardErrors.expiry) setCardErrors((prev) => ({ ...prev, expiry: undefined }));
                          }}
                          maxLength={5}
                          className={`w-full px-3.5 py-2.5 bg-white text-sm font-mono tracking-wider border rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition ${
                            cardErrors.expiry ? "border-red-400 bg-red-50/50" : "border-gray-300"
                          }`}
                          placeholder="MM/YY"
                        />
                        {cardErrors.expiry && (
                          <p className="mt-1 text-xs text-red-600">{cardErrors.expiry}</p>
                        )}
                      </div>

                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <label className="block text-xs font-medium text-gray-700">
                            CVV / CVC *
                          </label>
                          <span className="text-[10px] text-gray-400">3-4 digits</span>
                        </div>
                        <input
                          type="password"
                          inputMode="numeric"
                          required
                          value={cardData.cvv}
                          onChange={(e) => {
                            const formatted = formatCardCvv(e.target.value);
                            setCardData({ ...cardData, cvv: formatted });
                            if (cardErrors.cvv) setCardErrors((prev) => ({ ...prev, cvv: undefined }));
                          }}
                          maxLength={4}
                          className={`w-full px-3.5 py-2.5 bg-white text-sm font-mono tracking-wider border rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition ${
                            cardErrors.cvv ? "border-red-400 bg-red-50/50" : "border-gray-300"
                          }`}
                          placeholder="123"
                        />
                        {cardErrors.cvv && (
                          <p className="mt-1 text-xs text-red-600">{cardErrors.cvv}</p>
                        )}
                      </div>
                    </div>
                  </div>

                  <p className="mt-3.5 text-[11px] text-gray-500 leading-relaxed flex items-start gap-1.5">
                    <Shield className="w-3.5 h-3.5 text-emerald-600 shrink-0 mt-0.5" />
                    <span>
                      256-bit bank grade encryption powered by KoraPay PCI-DSS Level 1 compliant infrastructure. Your card will only be billed ₦1,500/month after your 30-day trial expires.
                    </span>
                  </p>
                </div>
              )}

              {/* Terms */}
              <div className="flex items-start gap-3">
                <input
                  type="checkbox"
                  id="terms"
                  checked={formData.agreeToTerms}
                  onChange={(e) =>
                    setFormData({ ...formData, agreeToTerms: e.target.checked })
                  }
                  className="w-5 h-5 mt-0.5 rounded border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                />
                <label htmlFor="terms" className="text-sm text-gray-600">
                  I agree to the{" "}
                  <Link
                    to="/privacy"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-700 hover:underline font-medium"
                  >
                    Terms of Service
                  </Link>{" "}
                  and{" "}
                  <Link
                    to="/privacy"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-700 hover:underline font-medium"
                  >
                    Privacy Policy
                  </Link>
                </label>
              </div>

              {/* Error banner */}
              {error !== null && (
                <div className="flex items-start gap-3 p-3.5 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>{typeof error === "string" ? error : "An error occurred. Please try again."}</span>
                </div>
              )}

              {/* Submit */}
              <button
                type="submit"
                id="signup-submit"
                disabled={
                  !formData.agreeToTerms ||
                  loading ||
                  formData.password.length < 6
                }
                className={`w-full py-3.5 rounded-xl font-semibold text-white transition-all active:scale-[0.98] flex items-center justify-center gap-2 shadow-lg ${
                  formData.agreeToTerms && formData.password.length >= 6 && !loading
                    ? selectedRole === "recruiter"
                      ? "bg-blue-700 hover:bg-blue-800 shadow-blue-700/20"
                      : selectedRole === "provider"
                        ? "bg-emerald-700 hover:bg-emerald-800 shadow-emerald-700/20"
                        : selectedRole === "admin"
                          ? "bg-gray-900 hover:bg-gray-800 shadow-gray-900/20"
                          : "bg-purple-700 hover:bg-purple-800 shadow-purple-700/20"
                    : "bg-gray-300 cursor-not-allowed shadow-none"
                }`}
              >
                {loading ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    {selectedRole === "provider"
                      ? "Starting Your 30-Day Free Trial..."
                      : "Creating Account..."}
                  </>
                ) : (
                  <>
                    {selectedRole === "provider"
                      ? "Start 30-Day Free Trial (₦0 Today)"
                      : "Create Account"}
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>

              <div className="flex items-center gap-3 text-sm text-gray-500">
                <Shield className="w-5 h-5 text-gray-400 shrink-0" />
                <span>
                  {isProvider
                    ? "Your debit card information is encrypted and stored securely for post-trial renewal. ₦0 charged today."
                    : "Your information is secure and encrypted"}
                </span>
              </div>
            </form>

            <p className="text-center text-sm text-gray-500 mt-6">
              Already have an account?{" "}
              <Link to="/login" className="font-semibold text-blue-700 hover:text-blue-800 transition-colors">
                Sign in
              </Link>
            </p>
          </div>
        )}

        <p className="text-center text-blue-300 text-xs mt-6">
          By continuing, you agree to JobBridge's{" "}
          <Link to="/privacy" className="underline hover:text-blue-200 transition-colors">
            Terms of Service
          </Link>{" "}
          and acknowledge our{" "}
          <Link to="/privacy" className="underline hover:text-blue-200 transition-colors">
            Privacy Policy
          </Link>.
        </p>
      </div>
    </div>
  );
}
