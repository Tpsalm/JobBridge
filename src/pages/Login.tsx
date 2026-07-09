import { useState, useEffect } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Mail, ArrowRight, Eye, EyeOff, Lock, CheckCircle, AlertCircle, Loader2 } from 'lucide-react';
import JobBridgeLogo from '../components/JobBridgeLogo';
import { checkRateLimit } from '../lib/security';

type View = 'signin' | 'forgot' | 'forgot-sent';

export default function Login() {
  const { signIn, resetPassword } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  // Grab optional ?redirect= param so we can send users back after login
  const redirectTo = new URLSearchParams(location.search).get('redirect') || '/';

  const [view, setView] = useState<View>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(true);
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  // Field-level validation errors
  const [emailError, setEmailError] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [formError, setFormError] = useState('');

  // Forgot password state
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotEmailError, setForgotEmailError] = useState('');
  const [forgotLoading, setForgotLoading] = useState(false);

  // Clear field errors when user starts typing
  useEffect(() => { if (email) setEmailError(''); }, [email]);
  useEffect(() => { if (password) setPasswordError(''); }, [password]);

  const validateSignInFields = () => {
    let valid = true;
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!email.trim()) {
      setEmailError('Email address is required.');
      valid = false;
    } else if (!emailRegex.test(email.trim())) {
      setEmailError('Please enter a valid email address.');
      valid = false;
    }
    if (!password) {
      setPasswordError('Password is required.');
      valid = false;
    }
    return valid;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');
    if (!validateSignInFields()) return;

    if (!checkRateLimit('signin', 5, 60000)) {
      setFormError('Too many sign-in attempts. Please wait a minute and try again.');
      return;
    }

    setLoading(true);
    const { error } = await signIn(email.trim(), password, rememberMe);
    setLoading(false);

    if (error) {
      const msg = error.message || 'Sign in failed. Please check your credentials and try again.';
      setFormError(msg);
      // Surface email-confirmation errors as an email field error too
      if (msg.toLowerCase().includes('confirm') || msg.toLowerCase().includes('email')) {
        setEmailError(msg);
        setFormError('');
      }
      return;
    }

    window.dispatchEvent(new CustomEvent('jobbridge:toast', {
      detail: { message: 'Signed in successfully! Welcome back.', type: 'success' }
    }));
    navigate(redirectTo, { replace: true });
  };

  const handleForgotSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setForgotEmailError('');
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!forgotEmail.trim()) {
      setForgotEmailError('Please enter your email address.');
      return;
    }
    if (!emailRegex.test(forgotEmail.trim())) {
      setForgotEmailError('Please enter a valid email address.');
      return;
    }
    if (!checkRateLimit('forgot-password', 3, 60000)) {
      setForgotEmailError('Too many reset attempts. Please wait a minute.');
      return;
    }

    setForgotLoading(true);
    const { error } = await resetPassword(forgotEmail.trim());
    setForgotLoading(false);

    if (error) {
      setForgotEmailError(error.message || 'Failed to send reset email. Please try again.');
      return;
    }
    setView('forgot-sent');
  };

  // ── Shared background ──
  const bg = (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      <div className="absolute top-20 left-20 w-96 h-96 bg-blue-500/20 rounded-full blur-3xl animate-pulse" />
      <div className="absolute bottom-20 right-20 w-72 h-72 bg-indigo-400/20 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1s' }} />
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-blue-600/5 rounded-full blur-3xl" />
      <img
        src="https://images.pexels.com/photos/3184291/pexels-photo-3184291.jpeg?auto=compress&cs=tinysrgb&w=1920&h=1080&dpr=2"
        alt=""
        className="absolute inset-0 w-full h-full object-cover opacity-5"
      />
    </div>
  );

  // ── Logo header ──
  const logoHeader = (
    <div className="text-center mb-8">
      <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-white mb-4 shadow-lg ring-4 ring-white/20">
        <JobBridgeLogo variant="icon" iconSize={40} />
      </div>
      {view === 'signin' && (
        <>
          <h1 className="text-3xl font-bold text-white">Welcome back</h1>
          <p className="text-blue-200 mt-2">Sign in to your JobBridge account</p>
        </>
      )}
      {view === 'forgot' && (
        <>
          <h1 className="text-3xl font-bold text-white">Reset Password</h1>
          <p className="text-blue-200 mt-2">We'll send you a secure reset link</p>
        </>
      )}
      {view === 'forgot-sent' && (
        <>
          <h1 className="text-3xl font-bold text-white">Check Your Inbox</h1>
          <p className="text-blue-200 mt-2">A reset link has been sent</p>
        </>
      )}
    </div>
  );

  if (view === 'forgot-sent') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-900 via-blue-800 to-indigo-900 flex items-center justify-center p-4 relative">
        {bg}
        <div className="relative w-full max-w-md">
          {logoHeader}
          <div className="bg-white rounded-3xl shadow-2xl p-8 text-center">
            <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-5">
              <CheckCircle className="w-10 h-10 text-green-600" />
            </div>
            <h2 className="text-xl font-bold text-gray-900 mb-2">Reset Email Sent!</h2>
            <p className="text-gray-500 mb-1 text-sm">We sent a password reset link to</p>
            <p className="font-semibold text-gray-900 mb-6">{forgotEmail}</p>

            <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 mb-6 text-left">
              <h3 className="font-semibold text-sm text-blue-800 mb-2">What to do next:</h3>
              <ol className="space-y-2 text-sm text-blue-700">
                <li className="flex gap-2"><span className="font-bold">1.</span><span>Open the reset email we sent you</span></li>
                <li className="flex gap-2"><span className="font-bold">2.</span><span>Click <strong>Reset password</strong> in the email</span></li>
                <li className="flex gap-2"><span className="font-bold">3.</span><span>Enter and confirm your new password</span></li>
              </ol>
            </div>

            <p className="text-xs text-gray-400 mb-6">
              Didn't receive it? Check your spam folder. The link expires in 1 hour.
            </p>

            <button
              onClick={() => { setView('signin'); setForgotEmail(''); }}
              className="w-full bg-blue-700 text-white py-3 rounded-xl font-semibold hover:bg-blue-800 active:scale-[0.98] transition-all"
            >
              Back to Sign In
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (view === 'forgot') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-900 via-blue-800 to-indigo-900 flex items-center justify-center p-4 relative">
        {bg}
        <div className="relative w-full max-w-md">
          {logoHeader}
          <div className="bg-white rounded-3xl shadow-2xl p-8">
            <button
              onClick={() => { setView('signin'); setForgotEmailError(''); }}
              className="text-sm text-gray-500 hover:text-gray-700 mb-5 flex items-center gap-1 transition-colors"
            >
              ← Back to Sign In
            </button>

            <p className="text-gray-600 text-sm mb-6">
              Enter the email address you signed up with and we'll send you a secure link to reset your password.
            </p>

            <form onSubmit={handleForgotSubmit} className="space-y-5" noValidate>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  Email Address
                </label>
                <div className="relative">
                  <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <input
                    id="forgot-email"
                    type="email"
                    value={forgotEmail}
                    onChange={(e) => { setForgotEmail(e.target.value); setForgotEmailError(''); }}
                    className={`w-full pl-12 pr-4 py-3 border rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition ${
                      forgotEmailError ? 'border-red-400 bg-red-50' : 'border-gray-300'
                    }`}
                    placeholder="you@example.com"
                    autoFocus
                  />
                </div>
                {forgotEmailError && (
                  <p className="mt-1.5 text-xs text-red-600 flex items-center gap-1">
                    <AlertCircle className="w-3 h-3 shrink-0" />
                    {forgotEmailError}
                  </p>
                )}
              </div>

              <button
                type="submit"
                disabled={forgotLoading}
                className="w-full flex items-center justify-center gap-2 bg-blue-700 text-white py-3.5 rounded-xl font-semibold hover:bg-blue-800 active:scale-[0.98] transition-all disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {forgotLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Sending Reset Link...
                  </>
                ) : (
                  <>
                    Send Reset Link
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </form>
          </div>
        </div>
      </div>
    );
  }

  // ── Main Sign-In view ──
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-900 via-blue-800 to-indigo-900 flex items-center justify-center p-4 relative">
      {bg}

      <div className="relative w-full max-w-md">
        {logoHeader}

        <div className="bg-white rounded-3xl shadow-2xl p-8">
          <form onSubmit={handleSubmit} className="space-y-5" noValidate>

            {/* Email */}
            <div>
              <label htmlFor="signin-email" className="block text-sm font-medium text-gray-700 mb-1.5">
                Email Address
              </label>
              <div className="relative">
                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  id="signin-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className={`w-full pl-12 pr-4 py-3 border rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition ${
                    emailError ? 'border-red-400 bg-red-50' : 'border-gray-300'
                  }`}
                  placeholder="you@example.com"
                  autoComplete="email"
                />
              </div>
              {emailError && (
                <p className="mt-1.5 text-xs text-red-600 flex items-center gap-1">
                  <AlertCircle className="w-3 h-3 shrink-0" />
                  {emailError}
                </p>
              )}
            </div>

            {/* Password */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label htmlFor="signin-password" className="block text-sm font-medium text-gray-700">
                  Password
                </label>
                <button
                  type="button"
                  onClick={() => { setView('forgot'); setForgotEmail(email); }}
                  className="text-xs text-blue-600 hover:text-blue-800 font-medium transition-colors"
                >
                  Forgot password?
                </button>
              </div>
              <div className="relative">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  id="signin-password"
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className={`w-full pl-12 pr-12 py-3 border rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition ${
                    passwordError ? 'border-red-400 bg-red-50' : 'border-gray-300'
                  }`}
                  placeholder="Your password"
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
              {passwordError && (
                <p className="mt-1.5 text-xs text-red-600 flex items-center gap-1">
                  <AlertCircle className="w-3 h-3 shrink-0" />
                  {passwordError}
                </p>
              )}
            </div>

            {/* Remember Me */}
            <div className="flex items-center gap-2.5">
              <input
                type="checkbox"
                id="remember-me"
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
                className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
              />
              <label htmlFor="remember-me" className="text-sm text-gray-600 cursor-pointer select-none">
                Keep me signed in on this device
              </label>
            </div>

            {/* Form-level error banner */}
            {formError && (
              <div className="flex items-start gap-3 p-3.5 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700 animate-fade-in">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{formError}</span>
              </div>
            )}

            {/* Submit */}
            <button
              type="submit"
              id="signin-submit"
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 bg-blue-700 text-white py-3.5 rounded-xl font-semibold hover:bg-blue-800 active:scale-[0.98] transition-all disabled:opacity-70 disabled:cursor-not-allowed shadow-lg shadow-blue-700/20"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Signing In...
                </>
              ) : (
                <>
                  Sign In
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>

          <p className="text-center text-sm text-gray-500 mt-6">
            Don't have an account?{' '}
            <Link to="/signup" className="font-semibold text-blue-700 hover:text-blue-800 transition-colors">
              Sign up free
            </Link>
          </p>
        </div>

        {/* Trust indicators */}
        <div className="flex items-center justify-center gap-4 mt-6 text-blue-300/70 text-xs">
          <span className="flex items-center gap-1">
            <Lock className="w-3 h-3" /> Encrypted & Secure
          </span>
          <span>•</span>
          <span>Nigeria's #1 Job Network</span>
        </div>
      </div>
    </div>
  );
}
