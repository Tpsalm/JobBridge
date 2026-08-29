import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { Lock, CheckCircle, AlertCircle, Loader2, KeyRound } from 'lucide-react';
import JobBridgeLogo from '../components/JobBridgeLogo';

/**
 * Dedicated "set a new password" page reached after a user clicks the
 * password-reset link in their email.
 *
 * Supabase's recovery link carries a session that grants the user a short,
 * one-time ability to call `updateUser({ password })`. This page:
 *   1. Waits for the recovery session to be detected (implicit hash token
 *      auto-detected on init, PKCE code already exchanged in /auth/callback,
 *      or the PASSWORD_RECOVERY auth event).
 *   2. Shows the new-password form ONLY once the recovery session is live.
 *   3. Calls `updatePassword` from AuthContext, then prompts them to sign in.
 */
export default function ResetPassword() {
  const { updatePassword } = useAuth();
  const [checking, setChecking] = useState(true);
  const [ready, setReady] = useState(false);
  const [invalid, setInvalid] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const finalizeReady = () => {
      if (cancelled) return;
      setChecking(false);
      setReady(true);
    };

    // A recovery token can be detected via the PASSWORD_RECOVERY auth event
    // (fired by the Supabase client when it processes a recovery token on
    // init or during a PKCE code exchange), or by an already-live session
    // (e.g. the /auth/callback page exchanged the code and navigated here).
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') finalizeReady();
    });

    const check = async () => {
      try {
        // Direct PKCE landing: if a one-time ?code= token is present in the
        // URL (e.g. the user opened the email link straight to this page),
        // exchange it for a recovery session ourselves. This makes the page
        // self-sufficient instead of relying solely on /auth/callback.
        const searchParams = new URLSearchParams(window.location.search);
        const code = searchParams.get('code');
        if (code) {
          const { error } = await supabase.auth.exchangeCodeForSession(code);
          if (error) {
            console.warn('[ResetPassword] code exchange failed:', error);
          }
          // Strip the one-time code from the URL so a refresh doesn't try to
          // exchange an already-used code a second time.
          try {
            window.history.replaceState({}, document.title, window.location.pathname);
          } catch {
            /* ignore */
          }
        }

        const {
          data: { session },
        } = await supabase.auth.getSession();
        if (cancelled) return;
        if (session?.user) {
          finalizeReady();
          return;
        }
        // Give the client a moment to auto-detect an implicit recovery token
        // that may be arriving in the URL hash before declaring the link
        // invalid/expired.
        setTimeout(() => {
          if (cancelled) return;
          setChecking(false);
          setInvalid(true);
        }, 2500);
      } catch (err) {
        if (cancelled) return;
        console.error('[ResetPassword] session check failed:', err);
        setChecking(false);
        setInvalid(true);
      }
    };

    check();

    return () => {
      cancelled = true;
      sub.subscription.unsubscribe();
    };
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!newPassword.trim() || !confirmPassword.trim()) {
      setError('Please enter and confirm your new password.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }
    if (newPassword.length < 8) {
      setError('Password must be at least 8 characters long.');
      return;
    }

    setSaving(true);
    const { error } = await updatePassword(newPassword.trim());
    setSaving(false);

    if (error) {
      setError(error.message || 'Failed to update password. Please try again.');
      return;
    }

    // Keep the user signed in and lead them straight to the "Change password"
    // section of their profile so they can continue managing their account.
    setSuccess(true);
    setNewPassword('');
    setConfirmPassword('');
  };

  const bg = (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      <div className="absolute top-20 left-20 w-96 h-96 bg-blue-500/20 rounded-full blur-3xl animate-pulse" />
      <div className="absolute bottom-20 right-20 w-72 h-72 bg-indigo-400/20 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1s' }} />
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[min(600px,90vw)] h-[min(600px,90vw)] bg-blue-600/5 rounded-full blur-3xl" />
    </div>
  );

  const logoHeader = (
    <div className="text-center mb-8">
      <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-white mb-4 shadow-lg ring-4 ring-white/20">
        <JobBridgeLogo variant="icon" iconSize={40} />
      </div>
      <h1 className="text-3xl font-bold text-white">Set a New Password</h1>
      <p className="text-blue-200 mt-2">Choose a strong password for your JobBridge account</p>
    </div>
  );

  // ── Success state ────────────────────────────────────────────────────────
  if (success) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-900 via-blue-800 to-indigo-900 flex items-center justify-center p-4 relative">
        {bg}
        <div className="relative w-full max-w-md">
          {logoHeader}
          <div className="bg-white rounded-3xl shadow-2xl p-8 text-center">
            <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-5">
              <CheckCircle className="w-10 h-10 text-green-600" />
            </div>
            <h2 className="text-xl font-bold text-gray-900 mb-2">Password Updated!</h2>
            <p className="text-gray-500 mb-6 text-sm">
              Your password has been changed successfully. You can review or update it anytime from the change password section in your profile.
            </p>
            <Link
              to="/profile?section=security"
              className="w-full block bg-blue-700 text-white py-3 rounded-xl font-semibold hover:bg-blue-800 active:scale-[0.98] transition-all"
            >
              Continue to Profile
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // ── Checking for the recovery session ────────────────────────────────────
  if (checking) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-900 via-blue-800 to-indigo-900 flex items-center justify-center p-4 relative">
        {bg}
        <div className="relative w-full max-w-md">
          {logoHeader}
          <div className="bg-white rounded-3xl shadow-2xl p-8 text-center">
            <Loader2 className="w-10 h-10 animate-spin text-blue-700 mx-auto mb-4" />
            <p className="text-gray-600 text-sm">Verifying your reset link...</p>
          </div>
        </div>
      </div>
    );
  }

  // ── Invalid / expired link ───────────────────────────────────────────────
  if (invalid) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-900 via-blue-800 to-indigo-900 flex items-center justify-center p-4 relative">
        {bg}
        <div className="relative w-full max-w-md">
          {logoHeader}
          <div className="bg-white rounded-3xl shadow-2xl p-8 text-center">
            <div className="w-20 h-20 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-5">
              <AlertCircle className="w-10 h-10 text-red-600" />
            </div>
            <h2 className="text-xl font-bold text-gray-900 mb-2">Link Invalid or Expired</h2>
            <p className="text-gray-500 mb-6 text-sm">
              This password reset link is invalid or has expired. Please request a new one from the sign-in page.
            </p>
            <Link
              to="/login"
              className="w-full block bg-blue-700 text-white py-3 rounded-xl font-semibold hover:bg-blue-800 active:scale-[0.98] transition-all"
            >
              Back to Sign In
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // ── New password form ────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-900 via-blue-800 to-indigo-900 flex items-center justify-center p-4 relative">
      {bg}
      <div className="relative w-full max-w-md">
        {logoHeader}
        <div className="bg-white rounded-3xl shadow-2xl p-8">
          <form onSubmit={handleSubmit} className="space-y-5" noValidate>
            <div>
              <label htmlFor="new-password" className="block text-sm font-medium text-gray-700 mb-1.5">
                New Password
              </label>
              <div className="relative">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  id="new-password"
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="At least 8 characters"
                  autoFocus
                  className={`w-full pl-12 pr-4 py-3 border rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition ${
                    error ? 'border-red-400 bg-red-50' : 'border-gray-300'
                  }`}
                />
              </div>
            </div>

            <div>
              <label htmlFor="confirm-password" className="block text-sm font-medium text-gray-700 mb-1.5">
                Confirm New Password
              </label>
              <div className="relative">
                <KeyRound className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  id="confirm-password"
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Re-enter your new password"
                  className={`w-full pl-12 pr-4 py-3 border rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition ${
                    error ? 'border-red-400 bg-red-50' : 'border-gray-300'
                  }`}
                />
              </div>
            </div>

            {error && (
              <div className="flex items-start gap-3 p-3.5 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700 animate-fade-in">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={saving}
              className="w-full flex items-center justify-center gap-2 bg-blue-700 text-white py-3.5 rounded-xl font-semibold hover:bg-blue-800 active:scale-[0.98] transition-all disabled:opacity-70 disabled:cursor-not-allowed shadow-lg shadow-blue-700/20"
            >
              {saving ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Updating Password...
                </>
              ) : (
                <>
                  <CheckCircle className="w-4 h-4" />
                  Update Password
                </>
              )}
            </button>
          </form>

          <p className="text-center text-sm text-gray-500 mt-6">
            Changed your mind?{' '}
            <Link to="/login" className="font-semibold text-blue-700 hover:text-blue-800 transition-colors">
              Back to Sign In
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
