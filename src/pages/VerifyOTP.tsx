import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { verifyOtp, requestOtp } from '../lib/supabase';
import { Mail, Shield, ArrowRight, Building, Wrench } from 'lucide-react';
import Header from '../components/Header';
import BottomNav from '../components/BottomNav';
import JobBridgeLogo from '../components/JobBridgeLogo';
import { IMG } from '../lib/media';

export default function VerifyOTP() {
  const nav = useNavigate();
  const location = useLocation();
  const state = (location.state as any) || {};
  const [email, setEmail] = useState(state.email || '');
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [messageType, setMessageType] = useState<'error' | 'success'>('error');
  const [resendStatus, setResendStatus] = useState<string | null>(null);
  const [cooldown, setCooldown] = useState(0);
  const role = state.role as string | undefined;
  const isRecruiter = role === 'recruiter';
  const isProvider = role === 'provider';
  const accentColor = isRecruiter ? 'blue' : isProvider ? 'emerald' : 'blue';

  // cooldown timer
  useEffect(() => {
    let t: number | undefined;
    if (cooldown > 0) {
      t = window.setTimeout(() => setCooldown(cooldown - 1), 1000);
    }
    return () => { if (t) clearTimeout(t); };
  }, [cooldown]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage(null);
    const res = await verifyOtp({ email, code });
    setLoading(false);
    if (res.ok) {
      setMessage('Verification successful! Redirecting to login...');
      setMessageType('success');
      setTimeout(() => nav('/login'), 1500);
    } else {
      setMessage(res.error || 'Invalid or expired code');
      setMessageType('error');
    }
  };

  const handleResend = async () => {
    if (!email) return setResendStatus('No email provided');
    if (cooldown > 0) return;
    setResendStatus('Sending...');
    const ok = await requestOtp({ email });
    if (ok) {
      setResendStatus('Code sent successfully!');
      setCooldown(60);
    } else {
      setResendStatus('Failed to send code. Try again.');
    }
    setTimeout(() => setResendStatus(null), 3000);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-900 via-blue-800 to-blue-900 flex items-center justify-center p-4">
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute top-20 left-20 w-96 h-96 bg-blue-500/20 rounded-full blur-3xl" />
        <div className="absolute bottom-20 right-20 w-72 h-72 bg-blue-400/20 rounded-full blur-3xl" />
      </div>

      <div className="relative w-full max-w-4xl grid lg:grid-cols-2 gap-8 items-center">
        {/* Illustration — desktop only */}
        <div className="hidden lg:block relative rounded-2xl overflow-hidden shadow-2xl border border-white/10">
          <img
            src={IMG.hero.verify}
            alt="Secure account verification"
            className="w-full h-[520px] object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-blue-900/70 to-transparent" />
          <div className="absolute bottom-6 left-6 right-6">
            <p className="text-white font-semibold text-lg">Secure your account</p>
            <p className="text-blue-200 text-sm mt-1">We verify every account to keep JobBridge safe for professionals and employers.</p>
          </div>
        </div>

      <div className="relative w-full max-w-md mx-auto lg:max-w-none">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-white mb-4 shadow-lg">
            <JobBridgeLogo variant="icon" iconSize={36} />
          </div>
          <h1 className="text-2xl font-bold text-white">Verify Your Account</h1>
          <p className="text-blue-200 mt-2 text-sm">
            We've sent a verification code to your email
          </p>
        </div>

        <div className="bg-white rounded-3xl shadow-2xl p-8">
          {/* Email info */}
          {email && (
            <div className={`mb-6 p-3 rounded-xl flex items-center gap-3 ${
              isRecruiter ? 'bg-blue-50 border border-blue-200' : isProvider ? 'bg-emerald-50 border border-emerald-200' : 'bg-blue-50 border border-blue-200'
            }`}>
              <Mail className={`w-5 h-5 ${isRecruiter ? 'text-blue-600' : isProvider ? 'text-emerald-600' : 'text-blue-600'}`} />
              <div>
                <p className="text-xs text-gray-500">Code sent to</p>
                <p className="text-sm font-semibold text-gray-900">{email}</p>
              </div>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Verification Code</label>
              <input
                value={code}
                onChange={(e) => setCode(e.target.value)}
                type="text"
                required
                placeholder="Enter 6-digit code"
                maxLength={6}
                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition text-center text-2xl tracking-widest font-mono"
              />
            </div>

            {message && (
              <div className={`p-3 rounded-lg text-sm ${
                messageType === 'success'
                  ? 'bg-green-50 border border-green-200 text-green-700'
                  : 'bg-red-50 border border-red-200 text-red-700'
              }`}>
                {message}
              </div>
            )}

            {resendStatus && (
              <div className={`p-3 rounded-lg text-sm ${
                resendStatus.includes('successfully') ? 'bg-green-50 border border-green-200 text-green-700' : 'bg-gray-50 border border-gray-200 text-gray-700'
              }`}>
                {resendStatus}
              </div>
            )}

            <button
              type="submit"
              disabled={loading || !code}
              className={`w-full py-3.5 rounded-xl font-semibold text-white transition flex items-center justify-center gap-2 ${
                isRecruiter ? 'bg-blue-700 hover:bg-blue-800' : isProvider ? 'bg-emerald-700 hover:bg-emerald-800' : 'bg-blue-700 hover:bg-blue-800'
              } disabled:opacity-50 disabled:cursor-not-allowed`}
            >
              {loading ? (
                <>
                  <svg className="animate-spin w-5 h-5" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>
                  Verifying...
                </>
              ) : (
                <>
                  <Shield className="w-5 h-5" />
                  Verify Account
                </>
              )}
            </button>

            <button
              type="button"
              onClick={handleResend}
              disabled={cooldown > 0}
              className="w-full py-3 bg-gray-100 text-gray-700 rounded-xl font-medium hover:bg-gray-200 transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {cooldown > 0 ? `Resend code (${cooldown}s)` : 'Resend verification code'}
            </button>
          </form>

          <div className="mt-6 pt-4 border-t border-gray-100 flex items-center gap-2 text-xs text-gray-500">
            <Shield className="w-4 h-4 text-gray-400" />
            <span>Your data is protected and encrypted</span>
          </div>
        </div>

        <p className="text-center text-blue-300 text-xs mt-6">
          Didn't receive the code? Check your spam folder or click resend.
        </p>
      </div>
      </div>
    </div>
  );
}
