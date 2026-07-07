import { useState, useEffect, useRef, type ReactNode } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  Wallet,
  ShieldCheck,
  CheckCircle,
  Loader2,
  Lock,
  Receipt,
  Sparkles,
  Circle,
  Zap,
} from 'lucide-react';
import Header from '../components/Header';
import BottomNav from '../components/BottomNav';
import { useAuth } from '../contexts/AuthContext';
import { recordPayment } from '../lib/supabaseQueries';
import { sendEmail } from '../lib/email';

// ═══════════════════════════════════════════════
//  KoraPay Type Declarations
// ═══════════════════════════════════════════════

declare global {
  interface Window {
    Korapay: {
      initialize: (config: KoraPayConfig) => void;
      close: () => void;
    };
  }
}

interface KoraPayConfig {
  key: string;
  reference: string;
  amount: number;
  currency?: string;
  customer: { name: string; email: string };
  notification_url?: string;
  narration?: string;
  channels?: string[];
  default_channel?: string;
  metadata?: Record<string, string>;
  onClose?: () => void;
  onSuccess?: (data: { reference: string; amount: string; status: string }) => void;
  onFailed?: (data: { reference: string; status: string }) => void;
  onPending?: () => void;
  merchant_bears_cost?: boolean;
}

// ═══════════════════════════════════════════════
//  Plan Data
// ═══════════════════════════════════════════════

const PLANS: Record<string, { name: string; duration: string; price: number; credits: number; ai?: boolean; service?: boolean }> = {
  basic: { name: 'Basic Job Post', duration: '7 days', price: 2000, credits: 1 },
  standard: { name: 'Standard Job Post', duration: '14 days', price: 3500, credits: 1 },
  premium: { name: 'Premium Job Post', duration: '30 days', price: 5000, credits: 3 },
  ai_monthly: { name: 'AI Career Tools Monthly', duration: '30 days', price: 1500, credits: 0, ai: true },
  ai_annual: { name: 'AI Career Tools Annual', duration: '365 days', price: 15000, credits: 0, ai: true },
  service_verified: { name: 'Verified Professional Listing', duration: '30 days', price: 3000, credits: 0, service: true },
  service_featured: { name: 'Featured Professional Listing', duration: '30 days', price: 5000, credits: 0, service: true },
};

type CheckoutStep = 'kora-checkout' | 'success';

// ═══════════════════════════════════════════════
//  Helpers
// ═══════════════════════════════════════════════

function getSuccessTarget(plan: typeof PLANS[string]): string {
  if (plan.ai) return '/ai-resume';
  if (plan.service) return '/providers';
  return '/recruiter';
}

async function activateAndRecord(
  userId: string,
  planKey: string,
  plan: typeof PLANS[string],
  reference: string,
  fetchSubscription: () => Promise<void>,
  fetchAiSubscription: () => Promise<void>,
): Promise<void> {
  // Insert payment with status 'verified' so the SQL trigger activate_plan_on_verify
  // handles plan activation + credits in a single authoritative path.
  await recordPayment({ user_id: userId, plan: planKey, amount: plan.price, reference, status: 'verified' });
  if (plan.ai) await fetchAiSubscription();
  else await fetchSubscription();
}

function formatNaira(n: number): string {
  return `₦${n.toLocaleString()}`;
}

// ═══════════════════════════════════════════════
//  Component
// ═══════════════════════════════════════════════

export default function Payment() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { user, fetchSubscription, fetchAiSubscription } = useAuth();

  const planKey = searchParams.get('plan') || 'basic';
  const plan = PLANS[planKey] || PLANS.basic;

  const [step, setStep] = useState<CheckoutStep>('kora-checkout');
  const [paying, setPaying] = useState(false);
  const [paid, setPaid] = useState(false);
  const [error, setError] = useState<ReactNode>('');
  const [koraReady, setKoraReady] = useState(false);
  const koraCompletedRef = useRef(false);

  // ─── Load KoraPay Script ───────────────────────────

  useEffect(() => {
    if (document.getElementById('kora-script')) { setKoraReady(true); return; }
    const s = document.createElement('script');
    s.id = 'kora-script';
    s.src = 'https://korablobstorage.blob.core.windows.net/modal-bucket/korapay-collections.min.js';
    s.onload = () => setKoraReady(true);
    s.onerror = () => console.error('[Kora] Failed to load');
    document.body.appendChild(s);
  }, []);

  // ─── Payment Handler ─────────────────────────────

  const handlePayWithKora = () => {
    if (!user?.id) { setError('Please log in first.'); return; }
    if (!koraReady || typeof window.Korapay === 'undefined') {
      setError('Kora gateway loading. Please wait.');
      return;
    }
    const publicKey = import.meta.env.VITE_KORA_PUBLIC_KEY || '';
    if (!publicKey) {
      setError(<>Kora not configured. Contact <a href="mailto:jobbridgesupport@gmail.com" className="underline font-medium">support</a>.</>);
      return;
    }

    setPaying(true);
    setError('');

    const reference = 'JB-KORA-' + Date.now() + '-' + Math.random().toString(36).slice(2, 8);

    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
    if (!supabaseUrl) console.warn('[Payment] VITE_SUPABASE_URL missing — webhook notification_url will not be set');
    const notificationUrl = supabaseUrl ? `${supabaseUrl}/functions/v1/kora-webhook` : undefined;

    window.Korapay.initialize({
      key: publicKey,
      reference,
      amount: plan.price,
      currency: 'NGN',
      notification_url: notificationUrl,
      customer: {
        name: user?.full_name || 'JobBridge User',
        email: user?.email || 'user@example.com',
      },
      onSuccess: async (data) => {
        koraCompletedRef.current = true;
        try {
          await activateAndRecord(user.id, planKey, plan, data.reference || reference, fetchSubscription, fetchAiSubscription);
          sendEmail({ type: 'payment', email: user.email, name: user.full_name || 'there', plan: plan.name, amount: String(plan.price) });
          setPaid(true);
          setStep('success');
        } catch {
          setError('Activation failed. Contact support with ref: ' + (data.reference || reference));
        }
        setPaying(false);
      },
      onFailed: () => { setError('Payment failed. Try again.'); setPaying(false); },
      onClose: () => { if (!koraCompletedRef.current) { setPaying(false); setError('Payment cancelled.'); } },
      onPending: () => { setError('Processing... You will get a confirmation.'); setPaying(false); },
    });
  };

  const successTarget = getSuccessTarget(plan);

  // ═══════════════════════════════════════════════
  //  RENDER — KoraPay Checkout Screen
  // ═══════════════════════════════════════════════

  function renderKoraCheckoutScreen() {
    return (
      <div className="max-w-[420px] mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-br from-[#1A4BCE] to-blue-500 shadow-lg shadow-[#1A4BCE]/25 mb-4">
            <Wallet className="w-7 h-7 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Pay with KoraPay</h1>
          <p className="text-sm text-gray-500 mt-1.5">{plan.name}</p>
        </div>

        {/* Order Summary Card */}
        <div className="bg-white rounded-2xl border border-gray-100 p-5 mb-5 shadow-sm">
          <div className="flex items-center justify-between pb-4 border-b border-gray-50">
            <span className="text-sm text-gray-500">Plan</span>
            <span className="text-sm font-semibold text-gray-900">{plan.name}</span>
          </div>
          <div className="flex items-center justify-between py-4 border-b border-gray-50">
            <span className="text-sm text-gray-500">Duration</span>
            <span className="text-sm font-medium text-gray-700">{plan.duration}</span>
          </div>
          <div className="flex items-center justify-between pt-4">
            <span className="text-sm font-medium text-gray-700">Total</span>
            <span className="text-xl font-bold text-[#1A4BCE]">{formatNaira(plan.price)}</span>
          </div>
        </div>

        {/* Kora Info */}
        <div className="rounded-2xl bg-gradient-to-br from-[#1A4BCE]/5 to-blue-50 border border-[#1A4BCE]/10 p-5 mb-6">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-8 h-8 rounded-lg bg-[#1A4BCE] flex items-center justify-center">
              <Zap className="w-4 h-4 text-white" />
            </div>
            <div>
              <p className="text-sm font-semibold text-gray-900">Secure Checkout</p>
              <p className="text-xs text-gray-500">Powered by KoraPay</p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            {['Pay with Card', 'USSD', 'Bank Transfer'].map((method) => (
              <span key={method} className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-white/80 text-xs font-medium text-gray-600 border border-gray-100">
                <svg className="w-3 h-3 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
                {method}
              </span>
            ))}
          </div>
        </div>

        {error && (
          <div className="mb-4 p-3 rounded-xl bg-red-50 border border-red-100 text-sm text-red-700 flex items-start gap-2">
            <Circle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" fill="currentColor" />
            <span>{error}</span>
          </div>
        )}

        {/* Pay Button */}
        <button
          onClick={handlePayWithKora}
          disabled={paying || !koraReady}
          className="w-full py-3.5 rounded-2xl bg-[#1A4BCE] text-white font-semibold text-base 
                     transition-all duration-200 hover:bg-[#1A4BCE]/90 active:scale-[0.98]
                     shadow-lg shadow-[#1A4BCE]/25 hover:shadow-xl hover:shadow-[#1A4BCE]/30
                     disabled:opacity-50 disabled:cursor-not-allowed disabled:active:scale-100"
        >
          {paying ? (
            <span className="inline-flex items-center gap-2">
              <Loader2 className="w-5 h-5 animate-spin" />
              Processing...
            </span>
          ) : !koraReady ? (
            <span className="inline-flex items-center gap-2">
              <Loader2 className="w-5 h-5 animate-spin" />
              Loading...
            </span>
          ) : (
            <span className="inline-flex items-center gap-2">
              <Lock className="w-5 h-5" />
              Pay {formatNaira(plan.price)} securely
            </span>
          )}
        </button>

        <p className="mt-4 text-center text-xs text-gray-400">
          Your plan activates immediately after successful payment
        </p>
      </div>
    );
  }

  // ═══════════════════════════════════════════════
  //  RENDER — Success Screen
  // ═══════════════════════════════════════════════

  function renderSuccessScreen() {
    return (
      <div className="max-w-[420px] mx-auto text-center">
        <div className="mb-8">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-emerald-100 mb-5">
            <CheckCircle className="w-10 h-10 text-emerald-600" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Payment Successful!</h1>
          <p className="text-sm text-gray-500 mt-2 max-w-sm mx-auto leading-relaxed">
            Your <strong className="text-gray-900">{plan.name}</strong> plan is now active.
          </p>
        </div>

        {/* Status Card */}
        <div className="rounded-2xl border bg-emerald-50 border-emerald-100 p-5 mb-6">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-8 h-8 rounded-lg bg-emerald-500 flex items-center justify-center">
              <CheckCircle className="w-4 h-4 text-white" />
            </div>
            <div className="text-left">
              <p className="text-sm font-semibold text-gray-900">Plan Activated</p>
              <p className="text-xs text-gray-600">Your {plan.name} is ready to use</p>
            </div>
          </div>
        </div>

        {/* What's Next */}
        <div className="rounded-2xl bg-gray-50 p-5 mb-8">
          <p className="text-sm font-semibold text-gray-900 mb-3">What's next</p>
          <div className="space-y-3">
            {[
              'Your plan is active — start using it now',
              'A receipt will be sent to your email',
              plan.ai ? 'Explore AI Career Tools' : plan.service ? 'Manage your professional listing' : 'Post your jobs and reach candidates',
            ].map((item, i) => (
              <div key={i} className="flex items-start gap-3">
                <div className="w-6 h-6 rounded-full bg-[#1A4BCE]/10 flex items-center justify-center shrink-0 mt-0.5">
                  <svg className="w-3.5 h-3.5 text-[#1A4BCE]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <p className="text-sm text-gray-600 text-left">{item}</p>
              </div>
            ))}
          </div>
        </div>

        {/* CTA */}
        <button
          onClick={() => navigate(successTarget)}
          className="w-full py-3.5 rounded-2xl bg-[#1A4BCE] text-white font-semibold text-base 
                     transition-all duration-200 hover:bg-[#1A4BCE]/90 active:scale-[0.98]
                     shadow-lg shadow-[#1A4BCE]/25"
        >
          {plan.ai ? 'Go to AI Resume Studio' : plan.service ? 'Go to My Profile' : 'Go to Dashboard'}
        </button>
      </div>
    );
  }

  // ═══════════════════════════════════════════════
  //  MAIN RENDER
  // ═══════════════════════════════════════════════

  return (
    <>
      {/* Overlay when paid */}
      {paid && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/30 backdrop-blur-md" style={{ animation: 'fadeIn 0.3s ease-out' }}>
          <div className="bg-white rounded-3xl p-8 shadow-2xl max-w-md w-full mx-4" style={{ animation: 'slideUp 0.35s ease-out' }}>
            {renderSuccessScreen()}
          </div>
        </div>
      )}

      {/* Main Page */}
      <div className={`min-h-screen bg-white pb-24 ${paid ? 'opacity-20 pointer-events-none select-none' : ''}`}>
        <Header />

        {/* Hero Banner */}
        <div className="bg-[#1A4BCE] relative overflow-hidden">
          <div className="absolute inset-0 opacity-10">
            <div className="absolute -top-24 -right-24 w-96 h-96 rounded-full bg-white" />
            <div className="absolute -bottom-32 -left-32 w-80 h-80 rounded-full bg-white" />
          </div>
          <div className="relative max-w-7xl mx-auto px-4 py-8">
            <button
              onClick={() => navigate('/pricing')}
              className="inline-flex items-center gap-1.5 text-sm text-blue-200 hover:text-white mb-4 transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              Back to pricing
            </button>
            <h1 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">Complete Checkout</h1>
            <p className="text-blue-200 text-sm mt-1">Pay for <strong className="text-white">{plan.name}</strong> with KoraPay and activate instantly</p>
          </div>
        </div>

        {/* Checkout Content */}
        <div className="max-w-7xl mx-auto px-4 -mt-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* KoraPay Checkout */}
            <div className="bg-white rounded-3xl border border-gray-100 shadow-xl shadow-gray-200/50 overflow-hidden transition-transform duration-300 hover:shadow-2xl hover:-translate-y-1">
              <div className="bg-gray-50/80 px-5 py-3 border-b border-gray-100">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="flex gap-1.5">
                      <div className="w-2.5 h-2.5 rounded-full bg-red-400" />
                      <div className="w-2.5 h-2.5 rounded-full bg-yellow-400" />
                      <div className="w-2.5 h-2.5 rounded-full bg-emerald-400" />
                    </div>
                    <span className="text-[11px] font-medium text-gray-400 ml-2">jobbridge.com.ng/payment</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-[11px] text-gray-400">
                    <Sparkles className="w-3 h-3 text-[#1A4BCE]" />
                    Secure Checkout
                  </div>
                </div>
              </div>
              <div className="p-6">
                {renderKoraCheckoutScreen()}
              </div>
            </div>

            {/* Order Summary */}
            <div className="bg-white rounded-3xl border border-gray-100 shadow-xl shadow-gray-200/50 overflow-hidden transition-transform duration-300 hover:shadow-2xl hover:-translate-y-1">
              <div className="bg-gray-50/80 px-5 py-3 border-b border-gray-100">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="flex gap-1.5">
                      <div className="w-2.5 h-2.5 rounded-full bg-red-400" />
                      <div className="w-2.5 h-2.5 rounded-full bg-yellow-400" />
                      <div className="w-2.5 h-2.5 rounded-full bg-emerald-400" />
                    </div>
                    <span className="text-[11px] font-medium text-gray-400 ml-2">Order Summary</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-[11px] text-gray-400">
                    <Sparkles className="w-3 h-3 text-[#1A4BCE]" />
                    Summary
                  </div>
                </div>
              </div>
              <div className="p-6">
                <div className="max-w-[420px] mx-auto">
                  {/* Plan Card */}
                  <div className="text-center mb-8">
                    <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-br from-[#1A4BCE] to-blue-500 shadow-lg shadow-[#1A4BCE]/20 mb-4">
                      <Receipt className="w-7 h-7 text-white" />
                    </div>
                    <h2 className="text-xl font-bold text-gray-900 tracking-tight">Order Summary</h2>
                  </div>

                  <div className="bg-white rounded-2xl border border-gray-100 p-5 mb-5 shadow-sm">
                    <div className="flex items-center gap-4 pb-4 border-b border-gray-50">
                      <div className="w-12 h-12 rounded-xl bg-[#1A4BCE]/10 flex items-center justify-center text-lg font-bold text-[#1A4BCE]">
                        {plan.name.charAt(0)}
                      </div>
                      <div className="flex-1">
                        <p className="text-sm font-semibold text-gray-900">{plan.name}</p>
                        <p className="text-xs text-gray-500">{plan.duration}</p>
                      </div>
                    </div>
                    <div className="space-y-3 pt-4">
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-gray-500">Credits</span>
                        <span className="font-medium text-gray-900">{plan.ai ? '—' : `${plan.credits} job post${plan.credits > 1 ? 's' : ''}`}</span>
                      </div>
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-gray-500">Subtotal</span>
                        <span className="font-medium text-gray-900">{formatNaira(plan.price)}</span>
                      </div>
                      <div className="pt-3 border-t border-gray-100 flex items-center justify-between">
                        <span className="text-sm font-semibold text-gray-900">Total</span>
                        <span className="text-xl font-bold text-[#1A4BCE]">{formatNaira(plan.price)}</span>
                      </div>
                    </div>
                  </div>

                  {/* Next Steps */}
                  <div className="rounded-2xl bg-gray-50 p-5">
                    <p className="text-sm font-semibold text-gray-900 mb-4 flex items-center gap-2">
                      <Sparkles className="w-4 h-4 text-[#1A4BCE]" />
                      {step === 'success' ? 'Completed' : 'What happens next'}
                    </p>
                    <div className="space-y-3">
                      {[
                        step === 'success'
                          ? 'Plan activated successfully'
                          : 'Complete checkout with KoraPay',
                        step === 'success' ? 'Receipt sent to your email' : 'Instant activation with KoraPay',
                        plan.ai ? 'AI Career Tools ready' : plan.service ? 'Professional listing ready' : `${plan.credits} job post credit${plan.credits > 1 ? 's' : ''} added`,
                      ].map((item, i) => (
                        <div key={i} className="flex items-start gap-3">
                          <div className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 mt-0.5 ${
                            step === 'success' ? 'bg-emerald-100' : 'bg-[#1A4BCE]/10'
                          }`}>
                            {step === 'success' ? (
                              <svg className="w-3.5 h-3.5 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                              </svg>
                            ) : (
                              <div className="w-2 h-2 rounded-full bg-[#1A4BCE]" />
                            )}
                          </div>
                          <p className={`text-sm ${step === 'success' ? 'text-gray-700' : 'text-gray-500'}`}>{item}</p>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Security Badge */}
                  <div className="mt-6 flex items-center justify-center gap-2 text-xs text-gray-400">
                    <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
                    <span>Protected by SSL encryption</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Bottom info bar */}
        <div className="max-w-7xl mx-auto px-4 mt-8 mb-6">
          <div className="bg-gray-50 rounded-2xl border border-gray-100 p-4 flex items-center justify-center gap-4 flex-wrap text-sm text-gray-500">
            <span className="flex items-center gap-1.5">
              <Lock className="w-4 h-4 text-gray-400" />
              Secure checkout
            </span>
            <span className="hidden sm:inline text-gray-200">|</span>
            <span className="flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-gray-400" />
              SSL encrypted
            </span>
            <span className="hidden sm:inline text-gray-200">|</span>
            <span className="flex items-center gap-1.5">
              <Wallet className="w-4 h-4 text-gray-400" />
              Powered by KoraPay
            </span>
          </div>
        </div>

        <BottomNav />
      </div>

      {/* Animations */}
      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes slideUp {
          from { opacity: 0; transform: translateY(20px) scale(0.96); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }
      `}</style>
    </>
  );
}
