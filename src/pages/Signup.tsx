import { useState, useCallback, useMemo } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuth, UserRole } from "../contexts/AuthContext";
import {
  Wrench,
  ArrowRight,
  ArrowLeft,
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
  Star,
  Sparkles,
  TrendingUp,
  Award,
  Calendar,
  Layers,
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
  getTrialBillingStartDate,
  SERVICE_PROVIDER_PLANS,
  type ServiceProviderPlanConfig,
} from "../lib/trial";

// ── Password strength helpers ──────────────────────────────────────────
function getPasswordStrength(pw: string): { score: number; label: string; color: string; bg: string } {
  if (!pw) return { score: 0, label: "", color: "", bg: "" };
  let score = 0;
  if (pw.length >= 8) score++;
  if (pw.length >= 12) score++;
  if (/[A-Z]/.test(pw)) score++;
  if (/[0-9]/.test(pw)) score++;
  if (/[^A-Za-z0-9]/.test(pw)) score++;

  if (score <= 1) return { score, label: "Very Weak", color: "text-red-600", bg: "bg-red-500" };
  if (score === 2) return { score, label: "Weak", color: "text-orange-600", bg: "bg-orange-500" };
  if (score === 3) return { score, label: "Fair", color: "text-yellow-600", bg: "bg-yellow-500" };
  if (score === 4) return { score, label: "Strong", color: "text-blue-600", bg: "bg-blue-500" };
  return { score, label: "Very Strong", color: "text-green-600", bg: "bg-green-500" };
}

// ── Resend cooldown (seconds) ──────────────────────────────────────────
const RESEND_COOLDOWN = 60;

export default function Signup() {
  const { signUp } = useAuth();
  const navigate = useNavigate();
  const [step, setStep] = useState<"role" | "form">("role");
  const [selectedRole, setSelectedRole] = useState<UserRole>(null);

  // Provider 3-step wizard (1 = Profile details, 2 = Plans & benefits, 3 = Spotify Billing checkout)
  const [providerStep, setProviderStep] = useState<1 | 2 | 3>(1);

  const [formData, setFormData] = useState({
    name: "",
    email: "",
    password: "",
    company: "",
    serviceCategory: "",
    skill: "", // Skill or Talent (e.g. Photographer, Electrician)
    phone: "",
    location: "",
    selectedPlan: "service_verified" as "service_monthly" | "service_verified" | "service_featured",
    agreeToTerms: false,
  });

  // Service Provider debit card state
  const [cardData, setCardData] = useState({
    cardNumber: "",
    expiry: "",
    cvv: "",
    cardHolder: "",
    saveCard: true,
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
  const [skillError, setSkillError] = useState("");
  const [categoryError, setCategoryError] = useState("");
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
    setProviderStep(1);
  };

  const strength = getPasswordStrength(formData.password);
  const cardBrand = detectCardBrand(cardData.cardNumber);
  const trialBillingInfo = useMemo(() => getTrialBillingStartDate(30), []);
  const currentPlan: ServiceProviderPlanConfig =
    SERVICE_PROVIDER_PLANS[formData.selectedPlan] || SERVICE_PROVIDER_PLANS.service_verified;

  // Start resend cooldown timer
  const startCooldown = useCallback(() => {
    setResendCooldown(RESEND_COOLDOWN);
    const interval = setInterval(() => {
      setResendCooldown((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  }, []);

  const handleResendEmail = async () => {
    if (resendCooldown > 0) return;
    setResending(true);
    setResendMessage("");

    const { error: signupErr } = await signUp(
      formData.email,
      formData.password,
      formData.name,
      selectedRole,
      formData.company,
      selectedRole === "provider" ? formData.serviceCategory : undefined,
      selectedRole === "provider"
        ? {
            specialty: formData.skill,
            phone: formData.phone,
            location: formData.location,
            trialPlan: formData.selectedPlan,
          }
        : undefined,
    );

    setResending(false);

    if (signupErr) {
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

  // ── Step 1 Validation for Provider ──
  const handleProviderStep1Next = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setNameError("");
    setEmailError("");
    setSkillError("");
    setCategoryError("");

    let hasErr = false;

    if (formData.name.trim().length < 2) {
      setNameError("Full name must be at least 2 characters.");
      hasErr = true;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(formData.email)) {
      setEmailError("Please enter a valid email address.");
      hasErr = true;
    }

    if (formData.password.length < 6) {
      setError("Password must be at least 6 characters.");
      hasErr = true;
    }

    if (!formData.skill.trim()) {
      setSkillError("Please specify your skill or talent (e.g., Photographer, Electrician).");
      hasErr = true;
    }

    if (!formData.serviceCategory) {
      setCategoryError("Please select a service category.");
      hasErr = true;
    }

    if (!formData.agreeToTerms) {
      setError("Please agree to the Terms of Service and Privacy Policy to continue.");
      hasErr = true;
    }

    if (hasErr) return;

    // Advance to Step 2 (Listing Plans & Benefits)
    setProviderStep(2);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  // ── Final Signup Submit (Step 3 for Provider, Form for others) ──
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedRole) return;

    setError(null);
    setNameError("");
    setEmailError("");
    setCardErrors({});

    if (!checkRateLimit("signup", 5, 60000)) {
      setError("Too many attempts. Try again later.");
      return;
    }

    // Validate general info
    if (formData.name.trim().length < 2) {
      setNameError("Full name must be at least 2 characters.");
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(formData.email)) {
      setEmailError("Please enter a valid email address.");
      return;
    }

    if (formData.password.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }

    // Service Providers MUST provide debit card details before starting their 30-day free trial
    let cardToken = "";
    if (isProvider) {
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
        isProvider ? formData.serviceCategory : undefined,
        isProvider
          ? {
              specialty: formData.skill,
              phone: formData.phone,
              location: formData.location,
              trialPlan: formData.selectedPlan,
              cardToken,
            }
          : undefined,
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
        if (isProvider) {
          // Immediately activate the 30-day free trial with the selected plan and card token
          void activateServiceTrialForUser(
            newSession.user.id,
            formData.selectedPlan,
            cardToken,
          );
          navigate("/profile?trial=started");
          window.dispatchEvent(
            new CustomEvent("jobbridge:toast", {
              detail: {
                message: `🎉 Welcome! Your 30-day free trial for ${currentPlan.name} is active.`,
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
        if (isProvider && cardToken) {
          savePendingTrial(cardToken, formData.email, formData.selectedPlan, {
            specialty: formData.skill,
            serviceCategory: formData.serviceCategory,
          });
        }
        setEmailSent(true);
        setLoading(false);
        startCooldown();
        window.dispatchEvent(
          new CustomEvent("jobbridge:toast", {
            detail: {
              message: isProvider
                ? `Account created! Check your email to confirm and activate your 30-day free trial (${currentPlan.name}).`
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
    if (isProvider && providerStep === 3) {
      setProviderStep(2);
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }
    if (isProvider && providerStep === 2) {
      setProviderStep(1);
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }
    setStep("role");
    setSelectedRole(null);
    setProviderStep(1);
    setError(null);
    setNameError("");
    setEmailError("");
    setSkillError("");
    setCategoryError("");
    setCardErrors({});
    setEmailStatusMessage(null);
  };

  // ── Shared background ──
  const bg = (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      <div className="absolute top-20 left-20 w-96 h-96 bg-blue-500/20 rounded-full blur-3xl animate-pulse" />
      <div
        className="absolute bottom-20 right-20 w-72 h-72 bg-indigo-400/20 rounded-full blur-3xl animate-pulse"
        style={{ animationDelay: "1s" }}
      />
      <img
        src="https://images.pexels.com/photos/3194519/pexels-photo-3194519.jpeg?auto=compress&cs=tinysrgb&w=1920&h=1080&dpr=2"
        alt=""
        className="absolute inset-0 w-full h-full object-cover opacity-5"
      />
    </div>
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-900 via-blue-800 to-indigo-900 flex items-center justify-center p-4 sm:p-6 relative">
      {bg}

      <div
        className={`relative w-full ${
          isProvider && providerStep === 2 ? "max-w-4xl" : "max-w-2xl"
        } transition-all duration-300`}
      >
        {/* Logo */}
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-white mb-3 shadow-lg ring-4 ring-white/20">
            <JobBridgeLogo variant="icon" iconSize={40} />
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold text-white">Welcome to JobBridge</h1>
          <p className="text-blue-200 text-sm mt-1">
            Connect. Hire. Grow. Nigeria's #1 Professional Network
          </p>
        </div>

        {step === "role" ? (
          /* ── Role Selection ── */
          <div className="bg-white rounded-3xl shadow-2xl p-6 sm:p-10">
            <h2 className="text-2xl font-bold text-gray-900 text-center mb-2">
              Choose how you want to join
            </h2>
            <p className="text-gray-500 text-center mb-8">
              Select your role to get started
            </p>

            <div className="flex flex-col gap-4">
              {/* Job Seeker */}
              <button
                type="button"
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
                    {["Search thousands of jobs", "AI resume builder", "Cover letter generator", "Track applications"].map(
                      (feature) => (
                        <li key={feature} className="flex items-center gap-2 text-sm text-gray-600">
                          <Check className="w-4 h-4 text-purple-600" />
                          {feature}
                        </li>
                      ),
                    )}
                  </ul>
                </div>
              </button>

              <div className="grid sm:grid-cols-2 gap-4">
                {/* Recruiter */}
                <button
                  type="button"
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
                      {["Post unlimited jobs", "Access talent database", "AI-powered matching", "Schedule interviews"].map(
                        (feature) => (
                          <li key={feature} className="flex items-center gap-2 text-sm text-gray-600">
                            <Check className="w-4 h-4 text-blue-600" />
                            {feature}
                          </li>
                        ),
                      )}
                    </ul>
                  </div>
                </button>

                {/* Service Provider */}
                <button
                  type="button"
                  onClick={() => handleRoleSelect("provider")}
                  className="group relative p-6 bg-gradient-to-br from-emerald-50 to-emerald-100 border-2 border-emerald-300 rounded-2xl hover:border-emerald-600 hover:shadow-lg transition-all text-left ring-2 ring-emerald-500/20"
                >
                  <div className="flex items-start gap-4">
                    <div className="w-12 h-12 rounded-xl bg-emerald-600 flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform">
                      <Wrench className="w-6 h-6 text-white" />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <h3 className="font-bold text-gray-900 text-lg">Service Provider</h3>
                        <span className="text-[11px] font-bold bg-emerald-200 text-emerald-900 px-2 py-0.5 rounded-full">
                          30-Day Free Trial
                        </span>
                      </div>
                      <p className="text-sm text-gray-600 mt-1">Offer services, get clients, grow your business</p>
                    </div>
                    <ArrowRight className="w-5 h-5 text-emerald-600 group-hover:translate-x-1 transition-transform" />
                  </div>
                  <div className="mt-4 pt-4 border-t border-emerald-200">
                    <ul className="space-y-2">
                      {[
                        "30-day free trial — ₦0 charged today",
                        "Showcase skill & talent (Photographer, etc.)",
                        "Verified professional badge & listing",
                        "Direct client inquiries & job leads",
                      ].map((feature) => (
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
                  <span>Open the email we just sent to your Gmail / inbox</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="font-bold">2.</span>
                  <span>Click the <strong>Confirm your email</strong> button</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="font-bold">3.</span>
                  <span>
                    {isProvider
                      ? `Your 30-day free trial (${currentPlan.name}) starts instantly, and your card is safely saved for post-trial renewal!`
                      : "Return here and sign in to get started"}
                  </span>
                </li>
              </ol>
            </div>

            {/* Resend email */}
            <div className="mb-6">
              {resendMessage && (
                <p
                  className={`text-sm mb-3 font-medium ${
                    resendMessage.startsWith("Could") ? "text-red-600" : "text-green-600"
                  }`}
                >
                  {resendMessage}
                </p>
              )}
              <button
                type="button"
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
              type="button"
              onClick={() => navigate("/login")}
              className="w-full bg-blue-700 text-white py-3 rounded-xl font-semibold hover:bg-blue-800 active:scale-[0.98] transition-all mb-3"
            >
              Go to Sign In
            </button>
            <button
              type="button"
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
          /* ── Main Signup Card (3-step wizard for Provider) ── */
          <div className="bg-white rounded-3xl shadow-2xl p-6 sm:p-10">
            {/* Back button */}
            <button
              type="button"
              onClick={handleBack}
              className="text-sm text-gray-500 hover:text-gray-700 mb-4 flex items-center gap-1 transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              {isProvider && providerStep === 3
                ? "Back to plan selection"
                : isProvider && providerStep === 2
                  ? "Back to profile details"
                  : "Back to role selection"}
            </button>

            {/* Header with Role Title & Step Progress Bar */}
            <div className="mb-6">
              <div className="flex items-center gap-3 mb-4">
                <div
                  className={`w-11 h-11 rounded-xl flex items-center justify-center ${
                    selectedRole === "recruiter"
                      ? "bg-blue-600"
                      : selectedRole === "provider"
                        ? "bg-emerald-600"
                        : "bg-purple-600"
                  }`}
                >
                  {selectedRole === "recruiter" ? (
                    <Building className="w-5 h-5 text-white" />
                  ) : selectedRole === "provider" ? (
                    <Wrench className="w-5 h-5 text-white" />
                  ) : (
                    <User className="w-5 h-5 text-white" />
                  )}
                </div>
                <div>
                  <h2 className="text-xl font-bold text-gray-900">
                    {selectedRole === "recruiter"
                      ? "Create Recruiter Account"
                      : selectedRole === "provider"
                        ? providerStep === 1
                          ? "Service Provider Profile"
                          : providerStep === 2
                            ? "Service Provider Listing Plans"
                            : "Billing & Free Trial Confirmation"
                        : "Create Job Seeker Account"}
                  </h2>
                  <p className="text-xs sm:text-sm text-gray-500">
                    {selectedRole === "provider"
                      ? providerStep === 1
                        ? "Step 1 of 3: Fill in your profile and skills"
                        : providerStep === 2
                          ? "Step 2 of 3: Choose your subscription listing plan"
                          : "Step 3 of 3: Add your debit card to start 30-day free trial"
                      : "Fill in your details to get started"}
                  </p>
                </div>
              </div>

              {/* Service Provider Step Indicators */}
              {isProvider && (
                <div className="flex items-center justify-between gap-2 mt-4 pt-3 border-t border-gray-100">
                  <div
                    className={`flex-1 flex items-center gap-2 pb-2 border-b-2 transition-all ${
                      providerStep >= 1 ? "border-emerald-600 text-emerald-700" : "border-gray-200 text-gray-400"
                    }`}
                  >
                    <span
                      className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                        providerStep > 1
                          ? "bg-emerald-600 text-white"
                          : providerStep === 1
                            ? "bg-emerald-100 text-emerald-800 ring-2 ring-emerald-600"
                            : "bg-gray-100 text-gray-400"
                      }`}
                    >
                      {providerStep > 1 ? <Check className="w-3.5 h-3.5" /> : "1"}
                    </span>
                    <span className="text-xs font-semibold hidden sm:inline">1. Profile Details</span>
                  </div>

                  <div
                    className={`flex-1 flex items-center gap-2 pb-2 border-b-2 transition-all ${
                      providerStep >= 2 ? "border-emerald-600 text-emerald-700" : "border-gray-200 text-gray-400"
                    }`}
                  >
                    <span
                      className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                        providerStep > 2
                          ? "bg-emerald-600 text-white"
                          : providerStep === 2
                            ? "bg-emerald-100 text-emerald-800 ring-2 ring-emerald-600"
                            : "bg-gray-100 text-gray-400"
                      }`}
                    >
                      {providerStep > 2 ? <Check className="w-3.5 h-3.5" /> : "2"}
                    </span>
                    <span className="text-xs font-semibold hidden sm:inline">2. Listing Plans</span>
                  </div>

                  <div
                    className={`flex-1 flex items-center gap-2 pb-2 border-b-2 transition-all ${
                      providerStep === 3 ? "border-emerald-600 text-emerald-700" : "border-gray-200 text-gray-400"
                    }`}
                  >
                    <span
                      className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                        providerStep === 3
                          ? "bg-emerald-100 text-emerald-800 ring-2 ring-emerald-600"
                          : "bg-gray-100 text-gray-400"
                      }`}
                    >
                      3
                    </span>
                    <span className="text-xs font-semibold hidden sm:inline">3. Billing & Trial</span>
                  </div>
                </div>
              )}
            </div>

            {/* ══════════════════════════════════════════════════════════════
                SERVICE PROVIDER: PAGE 1 (PROFILE DETAILS & SKILLS)
                OR STANDARD FORM FOR RECRUITER / JOB SEEKER
               ══════════════════════════════════════════════════════════════ */}
            {(!isProvider || providerStep === 1) && (
              <form
                onSubmit={isProvider ? handleProviderStep1Next : handleSubmit}
                className="space-y-4 sm:space-y-5"
                noValidate
              >
                {/* Full Name */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
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
                    className={`w-full px-4 py-3 border rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition ${
                      nameError ? "border-red-400 bg-red-50" : "border-gray-300"
                    }`}
                    placeholder="e.g. Samuel Owoyemi"
                  />
                  {nameError && (
                    <p className="mt-1 text-xs text-red-600 flex items-center gap-1">
                      <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                      {nameError}
                    </p>
                  )}
                </div>

                {/* Email Address */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
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
                    className={`w-full px-4 py-3 border rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition ${
                      emailError ? "border-red-400 bg-red-50" : "border-gray-300"
                    }`}
                    placeholder="you@example.com"
                  />
                  {emailError && (
                    <p className="mt-1 text-xs text-red-600 flex items-center gap-1">
                      <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                      {emailError}
                    </p>
                  )}
                </div>

                {/* Password + strength indicator */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Password *
                  </label>
                  <div className="relative">
                    <input
                      type={showPassword ? "text" : "password"}
                      required
                      minLength={6}
                      value={formData.password}
                      onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                      className="w-full px-4 py-3 pr-12 border border-gray-300 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition"
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
                </div>

                {/* Service Provider Specific: Skill / Talent & Service Category */}
                {isProvider && (
                  <>
                    {/* Skill or Talent */}
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label className="block text-sm font-medium text-gray-700">
                          Skill or Talent *
                        </label>
                        <span className="text-xs text-gray-400">e.g. Photographer, Electrician</span>
                      </div>
                      <div className="relative">
                        <input
                          type="text"
                          required
                          value={formData.skill}
                          onChange={(e) => {
                            setFormData({ ...formData, skill: e.target.value });
                            if (skillError) setSkillError("");
                          }}
                          className={`w-full px-4 py-3 border rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition ${
                            skillError ? "border-red-400 bg-red-50" : "border-gray-300"
                          }`}
                          placeholder="e.g. Photographer, Graphic Designer, Plumber, Tailor..."
                        />
                        <div className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none">
                          <Sparkles className="w-4 h-4 text-emerald-600" />
                        </div>
                      </div>
                      {skillError && (
                        <p className="mt-1 text-xs text-red-600 flex items-center gap-1">
                          <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                          {skillError}
                        </p>
                      )}
                    </div>

                    {/* Service Category */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Service Category *
                      </label>
                      <select
                        required
                        value={formData.serviceCategory}
                        onChange={(e) => {
                          setFormData({ ...formData, serviceCategory: e.target.value });
                          if (categoryError) setCategoryError("");
                        }}
                        className={`w-full px-4 py-3 border rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition bg-white ${
                          categoryError ? "border-red-400 bg-red-50" : "border-gray-300"
                        }`}
                      >
                        <option value="">Select your service category</option>
                        {PROVIDER_CATEGORIES.map((category) => (
                          <option key={category} value={category}>
                            {category}
                          </option>
                        ))}
                      </select>
                      {categoryError && (
                        <p className="mt-1 text-xs text-red-600 flex items-center gap-1">
                          <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                          {categoryError}
                        </p>
                      )}
                    </div>

                    {/* Optional Phone & Location */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">
                          Phone Number (Optional)
                        </label>
                        <input
                          type="tel"
                          value={formData.phone}
                          onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                          className="w-full px-3.5 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none transition text-sm"
                          placeholder="e.g. 08012345678"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">
                          Location / City (Optional)
                        </label>
                        <input
                          type="text"
                          value={formData.location}
                          onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                          className="w-full px-3.5 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none transition text-sm"
                          placeholder="e.g. Ikeja, Lagos"
                        />
                      </div>
                    </div>
                  </>
                )}

                {/* Company Name (Recruiter only) */}
                {selectedRole === "recruiter" && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Company Name (Optional)
                    </label>
                    <input
                      type="text"
                      value={formData.company}
                      onChange={(e) => setFormData({ ...formData, company: e.target.value })}
                      className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition"
                      placeholder="Your company name"
                    />
                  </div>
                )}

                {/* Terms Agreement */}
                <div className="flex items-start gap-3 pt-1">
                  <input
                    type="checkbox"
                    id="terms"
                    checked={formData.agreeToTerms}
                    onChange={(e) => setFormData({ ...formData, agreeToTerms: e.target.checked })}
                    className="w-5 h-5 mt-0.5 rounded border-gray-300 text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                  />
                  <label htmlFor="terms" className="text-sm text-gray-600 cursor-pointer">
                    I agree to the{" "}
                    <Link to="/privacy" target="_blank" rel="noopener noreferrer" className="text-blue-700 hover:underline font-medium">
                      Terms of Service
                    </Link>{" "}
                    and{" "}
                    <Link to="/privacy" target="_blank" rel="noopener noreferrer" className="text-blue-700 hover:underline font-medium">
                      Privacy Policy
                    </Link>
                  </label>
                </div>

                {/* Error Banner */}
                {error && (
                  <div className="flex items-start gap-3 p-3.5 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">
                    <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                    <span>{error}</span>
                  </div>
                )}

                {/* Step 1 Next / Submit Button */}
                <button
                  type="submit"
                  disabled={!formData.agreeToTerms || loading || formData.password.length < 6}
                  className={`w-full py-3.5 rounded-xl font-semibold text-white transition-all active:scale-[0.98] flex items-center justify-center gap-2 shadow-lg ${
                    formData.agreeToTerms && formData.password.length >= 6 && !loading
                      ? isProvider
                        ? "bg-emerald-700 hover:bg-emerald-800 shadow-emerald-700/25"
                        : selectedRole === "recruiter"
                          ? "bg-blue-700 hover:bg-blue-800 shadow-blue-700/25"
                          : "bg-purple-700 hover:bg-purple-800 shadow-purple-700/25"
                      : "bg-gray-300 cursor-not-allowed shadow-none"
                  }`}
                >
                  {loading ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      Creating Account...
                    </>
                  ) : isProvider ? (
                    <>
                      <span>Continue to Listing Plans</span>
                      <ArrowRight className="w-4 h-4" />
                    </>
                  ) : (
                    <>
                      <span>Create Account</span>
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              </form>
            )}

            {/* ══════════════════════════════════════════════════════════════
                SERVICE PROVIDER: PAGE 2 (LISTING PLANS & BENEFITS)
               ══════════════════════════════════════════════════════════════ */}
            {isProvider && providerStep === 2 && (
              <div className="space-y-6">
                <div className="text-center max-w-xl mx-auto mb-2">
                  <h3 className="text-xl sm:text-2xl font-bold text-gray-900">
                    Service Provider Listing Plans
                  </h3>
                  <p className="text-sm text-gray-600 mt-1">
                    Select the right subscription plan for your business. Start free with ₦0 charged today!
                  </p>
                </div>

                {/* 3 Plans Grid */}
                <div className="grid sm:grid-cols-3 gap-4">
                  {/* Plan 1: Monthly Listing (₦1,500) */}
                  <div
                    onClick={() => {
                      setFormData({ ...formData, selectedPlan: "service_monthly" });
                      setProviderStep(3);
                      window.scrollTo({ top: 0, behavior: "smooth" });
                    }}
                    className={`cursor-pointer rounded-2xl p-5 border-2 transition-all duration-200 hover:shadow-xl relative flex flex-col justify-between ${
                      formData.selectedPlan === "service_monthly"
                        ? "border-emerald-600 bg-emerald-50/40 ring-2 ring-emerald-500/20"
                        : "border-gray-200 bg-white hover:border-emerald-400"
                    }`}
                  >
                    <div>
                      <div className="inline-block bg-amber-500 text-white text-[11px] font-bold px-2.5 py-0.5 rounded-full mb-3">
                        Get Started
                      </div>
                      <h4 className="font-bold text-gray-900 text-lg">Monthly Listing</h4>
                      <div className="mt-2 mb-1">
                        <div className="flex items-baseline gap-1">
                          <span className="text-2xl sm:text-3xl font-extrabold text-gray-900">₦1,500</span>
                          <span className="text-xs text-gray-500">/month</span>
                        </div>
                        <span className="inline-block text-[11px] font-semibold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full mt-1">
                          30-Day Free Trial
                        </span>
                      </div>

                      <ul className="space-y-2 mt-4 text-xs sm:text-sm text-gray-600">
                        <li className="flex items-start gap-2">
                          <Check className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                          <span>Profile on JobBridge</span>
                        </li>
                        <li className="flex items-start gap-2">
                          <Check className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                          <span>Name and contact info</span>
                        </li>
                        <li className="flex items-start gap-2">
                          <Check className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                          <span>Description of services</span>
                        </li>
                        <li className="flex items-start gap-2">
                          <Check className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                          <span>Location & receive inquiries</span>
                        </li>
                      </ul>
                    </div>

                    <button
                      type="button"
                      className="w-full mt-5 py-2.5 px-3 rounded-xl font-semibold text-xs sm:text-sm bg-blue-700 hover:bg-blue-800 text-white transition-all"
                    >
                      Select Starter Plan
                    </button>
                  </div>

                  {/* Plan 2: Verified Professional (₦3,000 - Best Value) */}
                  <div
                    onClick={() => {
                      setFormData({ ...formData, selectedPlan: "service_verified" });
                      setProviderStep(3);
                      window.scrollTo({ top: 0, behavior: "smooth" });
                    }}
                    className={`cursor-pointer rounded-2xl p-5 border-2 transition-all duration-200 hover:shadow-xl relative flex flex-col justify-between ${
                      formData.selectedPlan === "service_verified"
                        ? "border-blue-600 bg-blue-50/50 ring-4 ring-blue-500/20"
                        : "border-blue-300 bg-white hover:border-blue-500"
                    }`}
                  >
                    <div>
                      <div className="inline-block bg-blue-700 text-white text-[11px] font-bold px-2.5 py-0.5 rounded-full mb-3">
                        Best Value
                      </div>
                      <h4 className="font-bold text-gray-900 text-lg">Verified Professional</h4>
                      <div className="mt-2 mb-1">
                        <div className="flex items-baseline gap-1">
                          <span className="text-2xl sm:text-3xl font-extrabold text-gray-900">₦3,000</span>
                          <span className="text-xs text-gray-500">/month</span>
                        </div>
                        <span className="inline-block text-[11px] font-semibold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full mt-1">
                          30-Day Free Trial
                        </span>
                      </div>

                      <ul className="space-y-2 mt-4 text-xs sm:text-sm text-gray-600">
                        <li className="flex items-start gap-2">
                          <Check className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                          <span className="font-medium text-gray-900">Everything in Monthly Listing</span>
                        </li>
                        <li className="flex items-start gap-2">
                          <Check className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                          <span>Verified badge ✓ on profile</span>
                        </li>
                        <li className="flex items-start gap-2">
                          <Check className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                          <span>ID & phone verification</span>
                        </li>
                        <li className="flex items-start gap-2">
                          <Check className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                          <span>Increased trust & more clients</span>
                        </li>
                      </ul>
                    </div>

                    <button
                      type="button"
                      className="w-full mt-5 py-2.5 px-3 rounded-xl font-semibold text-xs sm:text-sm bg-blue-700 hover:bg-blue-800 text-white transition-all shadow-md shadow-blue-700/20"
                    >
                      Select Verified Plan
                    </button>
                  </div>

                  {/* Plan 3: Featured Professional (₦5,000 - Top Visibility) */}
                  <div
                    onClick={() => {
                      setFormData({ ...formData, selectedPlan: "service_featured" });
                      setProviderStep(3);
                      window.scrollTo({ top: 0, behavior: "smooth" });
                    }}
                    className={`cursor-pointer rounded-2xl p-5 border-2 transition-all duration-200 hover:shadow-xl relative flex flex-col justify-between ${
                      formData.selectedPlan === "service_featured"
                        ? "border-emerald-600 bg-emerald-50/40 ring-2 ring-emerald-500/20"
                        : "border-gray-200 bg-white hover:border-emerald-400"
                    }`}
                  >
                    <div>
                      <div className="inline-block bg-purple-600 text-white text-[11px] font-bold px-2.5 py-0.5 rounded-full mb-3">
                        Most Popular
                      </div>
                      <h4 className="font-bold text-gray-900 text-lg">Featured Professional</h4>
                      <div className="mt-2 mb-1">
                        <div className="flex items-baseline gap-1">
                          <span className="text-2xl sm:text-3xl font-extrabold text-gray-900">₦5,000</span>
                          <span className="text-xs text-gray-500">/month</span>
                        </div>
                        <span className="inline-block text-[11px] font-semibold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full mt-1">
                          30-Day Free Trial
                        </span>
                      </div>

                      <ul className="space-y-2 mt-4 text-xs sm:text-sm text-gray-600">
                        <li className="flex items-start gap-2">
                          <Check className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                          <span className="font-medium text-gray-900">Everything in Verified</span>
                        </li>
                        <li className="flex items-start gap-2">
                          <Check className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                          <span>Featured badge ⭐</span>
                        </li>
                        <li className="flex items-start gap-2">
                          <Check className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                          <span>Top of search results</span>
                        </li>
                        <li className="flex items-start gap-2">
                          <Check className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                          <span>Homepage banner & WhatsApp promo</span>
                        </li>
                      </ul>
                    </div>

                    <button
                      type="button"
                      className="w-full mt-5 py-2.5 px-3 rounded-xl font-semibold text-xs sm:text-sm bg-blue-700 hover:bg-blue-800 text-white transition-all"
                    >
                      Select Featured Plan
                    </button>
                  </div>
                </div>

                {/* ── Value Proposition Section: Why Subscribe as a Service Provider? ── */}
                <div className="mt-6 rounded-2xl bg-gradient-to-br from-blue-50 via-slate-50 to-emerald-50/50 border border-blue-100 p-6">
                  <div className="flex items-center gap-2 mb-4">
                    <Award className="w-5 h-5 text-blue-700" />
                    <h4 className="font-bold text-gray-900 text-base sm:text-lg">
                      Why Subscribe as a Service Provider?
                    </h4>
                  </div>

                  <div className="grid sm:grid-cols-2 gap-3 text-sm text-gray-700">
                    <div className="flex items-start gap-2.5 p-2 bg-white/70 rounded-xl border border-gray-100">
                      <TrendingUp className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
                      <div>
                        <strong className="text-gray-900">Get More Customers</strong> – Connect with people looking for your services.
                      </div>
                    </div>

                    <div className="flex items-start gap-2.5 p-2 bg-white/70 rounded-xl border border-gray-100">
                      <Eye className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                      <div>
                        <strong className="text-gray-900">Increase Visibility</strong> – Get discovered by more customers on Jobbridge.
                      </div>
                    </div>

                    <div className="flex items-start gap-2.5 p-2 bg-white/70 rounded-xl border border-gray-100">
                      <Shield className="w-4 h-4 text-purple-600 shrink-0 mt-0.5" />
                      <div>
                        <strong className="text-gray-900">Build Trust</strong> – Showcase your skills, experience, and portfolio.
                      </div>
                    </div>

                    <div className="flex items-start gap-2.5 p-2 bg-white/70 rounded-xl border border-gray-100">
                      <Sparkles className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                      <div>
                        <strong className="text-gray-900">Get More Opportunities</strong> – Receive enquiries, jobs, and new clients.
                      </div>
                    </div>

                    <div className="flex items-start gap-2.5 p-2 bg-white/70 rounded-xl border border-gray-100">
                      <Star className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                      <div>
                        <strong className="text-gray-900">Stand Out</strong> – Get higher visibility with Verified and Featured plans.
                      </div>
                    </div>

                    <div className="flex items-start gap-2.5 p-2 bg-white/70 rounded-xl border border-gray-100">
                      <Zap className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                      <div>
                        <strong className="text-gray-900">Grow Your Business</strong> – Turn your skills into more customers and income.
                      </div>
                    </div>
                  </div>

                  <p className="text-center font-bold text-blue-900 text-sm mt-4 pt-3 border-t border-blue-100">
                    Subscribe today and get more from your skills.
                  </p>
                </div>
              </div>
            )}

            {/* ══════════════════════════════════════════════════════════════
                SERVICE PROVIDER: PAGE 3 (SPOTIFY-STYLE CHECKOUT)
               ══════════════════════════════════════════════════════════════ */}
            {isProvider && providerStep === 3 && (
              <form onSubmit={handleSubmit} className="space-y-5" noValidate>
                {/* Spotify-Style Plan Header Card */}
                <div className="bg-slate-50 border border-gray-200 rounded-2xl p-5 shadow-sm">
                  <div className="flex items-start justify-between pb-4 border-b border-gray-200">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 rounded-xl bg-emerald-600 text-white flex items-center justify-center font-bold shadow-sm">
                        <Wrench className="w-6 h-6" />
                      </div>
                      <div>
                        <h4 className="font-bold text-gray-900 text-base">{currentPlan.name}</h4>
                        <p className="text-xs text-gray-500">1 Service Provider account</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-bold text-gray-900 text-base sm:text-lg">NGN 0.00</div>
                      <div className="text-xs text-emerald-700 font-semibold">For 30 days free</div>
                    </div>
                  </div>

                  {/* Spotify-Style Timeline Breakdown */}
                  <div className="mt-4 pl-2 space-y-3 relative before:absolute before:left-[11px] before:top-2 before:bottom-2 before:w-[2px] before:bg-emerald-300">
                    {/* Timeline 1: Now */}
                    <div className="relative flex items-start gap-3">
                      <div className="w-4 h-4 rounded-full bg-emerald-600 ring-4 ring-emerald-100 shrink-0 mt-0.5 z-10" />
                      <div>
                        <p className="text-sm font-bold text-gray-900">
                          Now: 30 days for NGN 0.00
                        </p>
                      </div>
                    </div>

                    {/* Timeline 2: Future Billing */}
                    <div className="relative flex items-start gap-3">
                      <div className="w-4 h-4 rounded-full bg-gray-400 ring-4 ring-gray-100 shrink-0 mt-0.5 z-10" />
                      <div>
                        <p className="text-sm font-bold text-gray-900">
                          Starting {trialBillingInfo.formatted}: NGN {currentPlan.price.toLocaleString()}.00/month
                        </p>
                        <p className="text-xs text-gray-500 mt-1">
                          • We'll remind you 7 days before you're charged directly in your Gmail.
                        </p>
                        <p className="text-xs text-gray-500">
                          • Cancel anytime online. Terms apply.
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="mt-4 pt-3 border-t border-gray-200 flex justify-end">
                    <button
                      type="button"
                      onClick={() => setProviderStep(2)}
                      className="text-xs font-semibold text-blue-700 hover:underline"
                    >
                      Change plan
                    </button>
                  </div>
                </div>

                {/* ── Payment Method Section ── */}
                <div className="bg-white border border-gray-200 rounded-2xl p-5 shadow-sm">
                  <div className="flex items-center justify-between mb-4">
                    <h4 className="font-bold text-gray-900 text-sm sm:text-base flex items-center gap-2">
                      <span>Payment method</span>
                    </h4>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider">
                        {cardBrand !== "generic" ? (
                          <span className="text-emerald-700 font-bold uppercase">{cardBrand}</span>
                        ) : (
                          "Visa / Mastercard / Verve"
                        )}
                      </span>
                      <Lock className="w-3.5 h-3.5 text-gray-400" />
                    </div>
                  </div>

                  <p className="text-xs font-medium text-gray-600 mb-3">Credit or debit card</p>

                  {cardErrors.general && (
                    <div className="mb-3 p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700 flex items-center gap-2">
                      <AlertCircle className="w-4 h-4 shrink-0" />
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
                        className={`w-full px-3.5 py-2.5 bg-white text-sm border rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none transition ${
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
                      <label className="block text-xs font-medium text-gray-700 mb-1">
                        Card Number *
                      </label>
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
                          className={`w-full px-3.5 py-2.5 bg-white text-sm font-mono tracking-wider border rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none transition ${
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

                    {/* Expiry Date and Security Code */}
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
                          className={`w-full px-3.5 py-2.5 bg-white text-sm font-mono tracking-wider border rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none transition ${
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
                            Security Code (CVV) *
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
                          className={`w-full px-3.5 py-2.5 bg-white text-sm font-mono tracking-wider border rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none transition ${
                            cardErrors.cvv ? "border-red-400 bg-red-50/50" : "border-gray-300"
                          }`}
                          placeholder="123"
                        />
                        {cardErrors.cvv && (
                          <p className="mt-1 text-xs text-red-600">{cardErrors.cvv}</p>
                        )}
                      </div>
                    </div>

                    {/* Save card for renewal checkbox */}
                    <div className="pt-2 flex items-start gap-2.5">
                      <input
                        type="checkbox"
                        id="save-card-toggle"
                        checked={cardData.saveCard}
                        onChange={(e) => setCardData({ ...cardData, saveCard: e.target.checked })}
                        className="w-4 h-4 mt-0.5 rounded border-gray-300 text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                      />
                      <label htmlFor="save-card-toggle" className="text-xs text-gray-600 cursor-pointer leading-relaxed">
                        <strong className="text-gray-900">Save card for post-trial auto-renewal.</strong> This won't affect anything today (₦0 charged). Your subscription of NGN {currentPlan.price.toLocaleString()}/month will be auto-billed after 30 days.
                      </label>
                    </div>
                  </div>
                </div>

                {/* ── Summary Box ── */}
                <div className="bg-gray-50 border border-gray-200 rounded-2xl p-4 space-y-2.5">
                  <h4 className="font-bold text-gray-900 text-sm">Summary</h4>
                  <div className="flex justify-between items-center text-xs sm:text-sm text-gray-600">
                    <span>{currentPlan.name} (30-Day Free Trial)</span>
                    <span>NGN 0.00</span>
                  </div>
                  <div className="flex justify-between items-center text-xs text-gray-500">
                    <span>Starting {trialBillingInfo.formatted}</span>
                    <span>NGN {currentPlan.price.toLocaleString()}.00/month</span>
                  </div>
                  <div className="pt-2 border-t border-gray-200 flex justify-between items-center text-base font-bold text-gray-900">
                    <span>Total now</span>
                    <span className="text-emerald-700">NGN 0.00</span>
                  </div>
                </div>

                {/* Legal terms disclaimer matching Spotify reference */}
                <p className="text-[11px] text-gray-500 leading-relaxed">
                  If you don't cancel your subscription before the trial ends on <strong>{trialBillingInfo.formatted}</strong>, you agree that you will automatically be charged the subscription fee (<strong>NGN {currentPlan.price.toLocaleString()}.00</strong>) every month until you cancel. If you cancel during your trial period, you will keep access to your provider benefits until the end of the trial period. Full terms are available in our{" "}
                  <Link to="/privacy" target="_blank" className="underline text-blue-700">
                    Terms of Service
                  </Link>.
                </p>

                {error && (
                  <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700 flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    <span>{error}</span>
                  </div>
                )}

                {/* Submit button */}
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-4 rounded-2xl bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-base transition-all active:scale-[0.98] shadow-lg shadow-emerald-700/25 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loading ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      Activating Your 30-Day Free Trial...
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-5 h-5" />
                      Start 30-Day Free Trial (₦0 Today)
                    </>
                  )}
                </button>
              </form>
            )}

            <div className="mt-6 pt-4 border-t border-gray-100 text-center">
              <p className="text-sm text-gray-500">
                Already have an account?{" "}
                <Link to="/login" className="font-semibold text-blue-700 hover:text-blue-800 transition-colors">
                  Sign in
                </Link>
              </p>
            </div>
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
