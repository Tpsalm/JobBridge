import { useState, useEffect, type ReactNode } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  BadgeCheck,
  Banknote,
  CheckCircle,
  CreditCard,
  LockKeyhole,
  ReceiptText,
  ShieldCheck,
  Loader2,
  Wallet,
} from 'lucide-react';
import Header from '../components/Header';
import BottomNav from '../components/BottomNav';
import { IMG } from '../lib/media';
import { useAuth } from '../contexts/AuthContext';
import { activatePremiumPlan, recordPayment } from '../lib/supabaseQueries';
import { sendEmail } from '../lib/email';

declare const PaystackPop: any;
declare const Korapay: any;

const PLANS: Record<string, { name: string; duration: string; price: number; credits: number; ai?: boolean; service?: boolean }> = {
  basic: { name: 'Basic Job Post', duration: '7 days', price: 2000, credits: 1 },
  standard: { name: 'Standard Job Post', duration: '14 days', price: 3500, credits: 1 },
  premium: { name: 'Premium Job Post', duration: '30 days', price: 5000, credits: 3 },
  ai_monthly: { name: 'AI Career Tools Monthly', duration: '30 days', price: 1500, credits: 0, ai: true },
  ai_annual: { name: 'AI Career Tools Annual', duration: '365 days', price: 15000, credits: 0, ai: true },
  service_verified: { name: 'Verified Professional Listing', duration: '30 days', price: 3000, credits: 0, service: true },
  service_featured: { name: 'Featured Professional Listing', duration: '30 days', price: 5000, credits: 0, service: true },
};

type PaymentMethod = 'paystack' | 'kora' | 'transfer';

const PAYMENT_METHODS: { id: PaymentMethod; label: string; helper: string; icon: typeof CreditCard }[] = [
  { id: 'paystack', label: 'Pay with Card', helper: 'Visa, Mastercard, Verve — via Paystack', icon: CreditCard },
  { id: 'kora', label: 'Pay with Kora', helper: 'Card, USSD, Bank transfer — via Kora', icon: Wallet },
  { id: 'transfer', label: 'Bank Transfer', helper: 'Direct bank deposit', icon: Banknote },
];

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
  await activatePremiumPlan(userId, planKey, plan.price);
  await recordPayment({ user_id: userId, plan: planKey, amount: plan.price, reference, status: 'completed' });
  if (plan.ai) {
    await fetchAiSubscription();
  } else {
    await fetchSubscription();
  }
}

export default function Payment() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { user, fetchSubscription, fetchAiSubscription } = useAuth();
  const planKey = searchParams.get('plan') || 'basic';
  const plan = PLANS[planKey] || PLANS.basic;

  const [selectedMethod, setSelectedMethod] = useState<PaymentMethod>('paystack');
  const [paying, setPaying] = useState(false);
  const [paid, setPaid] = useState(false);
  const [error, setError] = useState<ReactNode>('');

  const total = plan.price;

  // Load Paystack inline script dynamically
  useEffect(() => {
    if (!document.getElementById('paystack-script')) {
      const s = document.createElement('script');
      s.id = 'paystack-script';
      s.src = 'https://js.paystack.co/v1/inline.js';
      document.body.appendChild(s);
    }
  }, []);

  // Load Kora collections script dynamically
  useEffect(() => {
    if (!document.getElementById('kora-script')) {
      const s = document.createElement('script');
      s.id = 'kora-script';
      s.src = 'https://korablobstorage.blob.core.windows.net/modal-bucket/korapay-collections.min.js';
      s.onload = () => console.log('[Kora] Script loaded');
      s.onerror = () => console.error('[Kora] Failed to load script');
      document.body.appendChild(s);
    }
  }, []);

  // ─── Paystack Handler ──────────────────────────────────────────

  const handlePayWithPaystack = async () => {
    if (!user?.id) { setError('Please log in first'); return; }
    setPaying(true);
    setError('');

    try {
      const publicKey = import.meta.env.VITE_PAYSTACK_PUBLIC_KEY || '';
      if (!publicKey) {
        setError(<>Paystack is not configured. Please contact <a href="mailto:jobbridgesupport@gmail.com" className="underline font-medium">jobbridgesupport@gmail.com</a>.</>);
        setPaying(false);
        return;
      }

      const reference = 'JB-' + Date.now() + '-' + Math.random().toString(36).slice(2, 8);

      const handler = PaystackPop.setup({
        key: publicKey,
        email: user.email || 'user@example.com',
        amount: plan.price * 100,
        ref: reference,
        currency: 'NGN',
        callback: async (response: any) => {
          try {
            await activateAndRecord(user.id, planKey, plan, response.reference, fetchSubscription, fetchAiSubscription);
            sendEmail({ type: 'payment', email: user.email, name: user.full_name || 'there', plan: plan.name, amount: String(plan.price) });
            setPaid(true);
          } catch {
            setError('Activation failed. Contact support with ref: ' + response.reference);
          }
          setPaying(false);
        },
        onClose: () => {
          setPaying(false);
          setError('Payment cancelled');
        },
      });
      handler.openIframe();
    } catch (err: any) {
      setError(err.message || 'Payment failed');
      setPaying(false);
    }
  };

  // ─── Kora Handler ──────────────────────────────────────────────

  const handlePayWithKora = async () => {
    if (!user?.id) { setError('Please log in first'); return; }
    if (typeof Korapay === 'undefined') {
      setError('Kora payment gateway is still loading. Please try again in a moment.');
      return;
    }

    setPaying(true);
    setError('');

    try {
      const publicKey = import.meta.env.VITE_KORA_PUBLIC_KEY || '';
      if (!publicKey) {
        setError(<>Kora payment is not configured. Please contact <a href="mailto:jobbridgesupport@gmail.com" className="underline font-medium">jobbridgesupport@gmail.com</a>.</>);
        setPaying(false);
        return;
      }

      const reference = 'JB-KORA-' + Date.now() + '-' + Math.random().toString(36).slice(2, 8);

      Korapay.initialize({
        key: publicKey,
        reference,
        amount: plan.price,
        currency: 'NGN',
        customer: {
          name: user.full_name || 'JobBridge User',
          email: user.email || 'user@example.com',
        },
        onSuccess: async (data: any) => {
          try {
            await activateAndRecord(user.id, planKey, plan, data.reference || reference, fetchSubscription, fetchAiSubscription);
            sendEmail({ type: 'payment', email: user.email, name: user.full_name || 'there', plan: plan.name, amount: String(plan.price) });
            setPaid(true);
          } catch {
            setError('Activation failed. Contact support with ref: ' + (data.reference || reference));
          }
          setPaying(false);
        },
        onFailed: (data: any) => {
          setError('Payment failed. Please try again or use a different method.');
          setPaying(false);
        },
        onClose: () => {
          setPaying(false);
          setError('Payment cancelled');
        },
      });
    } catch (err: any) {
      setError(err.message || 'Kora payment failed');
      setPaying(false);
    }
  };

  // ─── Transfer Handler ──────────────────────────────────────────

  const handlePayWithTransfer = () => {
    setPaying(true);
    setTimeout(() => {
      setPaying(false);
      setError('Bank transfers are verified manually. Please allow up to 24 hours for activation after payment.');
    }, 1000);
  };

  const handlePay = () => {
    switch (selectedMethod) {
      case 'paystack': handlePayWithPaystack(); break;
      case 'kora': handlePayWithKora(); break;
      case 'transfer': handlePayWithTransfer(); break;
    }
  };

  const successTarget = getSuccessTarget(plan);

  return (
    <>
      <div className={`min-h-screen bg-gray-50 pb-24 ${paid ? 'opacity-30 pointer-events-none select-none' : ''}`}>
      <Header />

      <main className="max-w-6xl mx-auto px-4 py-6">
        <div className="mb-6">
          <button
            onClick={() => navigate('/pricing')}
            className="inline-flex items-center gap-2 text-sm font-medium text-blue-700 hover:text-blue-800 mb-4"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to pricing
          </button>

          <div className="relative rounded-2xl overflow-hidden">
            <img src={IMG.hero.payment} alt="" className="absolute inset-0 w-full h-full object-cover opacity-20" />
            <div className="relative bg-gradient-to-r from-blue-700/95 to-blue-800/95 p-6 text-white">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-sm font-medium text-blue-100 mb-1">Secure checkout</p>
                  <h1 className="text-2xl sm:text-3xl font-bold">Complete your payment</h1>
                  <p className="text-sm text-blue-100 mt-2 max-w-2xl">
                    Pay for your {plan.name} and activate it instantly.
                  </p>
                </div>
                <div className="inline-flex items-center gap-2 self-start rounded-xl bg-white/10 px-4 py-2 text-sm font-medium text-blue-50">
                  <ShieldCheck className="w-5 h-5" />
                  Protected checkout
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="grid lg:grid-cols-3 gap-6">
          <section className="lg:col-span-2 space-y-6">
            {/* Payment Method Selection */}
            <div className="bg-white rounded-xl border border-gray-100 p-5">
              <div className="flex items-center gap-2 mb-4">
                <CreditCard className="w-5 h-5 text-blue-700" />
                <h2 className="text-lg font-bold text-gray-900">Payment method</h2>
              </div>

              <div className="grid sm:grid-cols-3 gap-3">
                {PAYMENT_METHODS.map(({ id, label, helper, icon: Icon }) => {
                  const active = selectedMethod === id;
                  return (
                    <button
                      key={id}
                      type="button"
                      onClick={() => setSelectedMethod(id)}
                      className={`flex items-center gap-3 rounded-xl border p-4 text-left transition-colors ${
                        active
                          ? 'border-blue-500 bg-blue-50 ring-1 ring-blue-500'
                          : 'border-gray-200 bg-white hover:border-blue-200 hover:bg-gray-50'
                      }`}
                    >
                      <span
                        className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${
                          active ? 'bg-blue-700 text-white' : 'bg-gray-100 text-gray-500'
                        }`}
                      >
                        <Icon className="w-5 h-5" />
                      </span>
                      <span>
                        <span className="block text-sm font-semibold text-gray-900">{label}</span>
                        <span className="block text-xs text-gray-500">{helper}</span>
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Billing Details & CTA */}
            <div className="bg-white rounded-xl border border-gray-100 p-5">
              <div className="flex items-center gap-2 mb-4">
                <LockKeyhole className="w-5 h-5 text-blue-700" />
                <h2 className="text-lg font-bold text-gray-900">
                  {selectedMethod === 'kora' ? 'Kora checkout' : selectedMethod === 'paystack' ? 'Paystack checkout' : 'Bank transfer details'}
                </h2>
              </div>

              <form className="space-y-4" onSubmit={e => e.preventDefault()}>
                <div className="grid sm:grid-cols-2 gap-4">
                  <label className="block">
                    <span className="block text-sm font-medium text-gray-700 mb-1">Full name</span>
                    <input
                      type="text"
                      placeholder="Enter your full name"
                      defaultValue={user?.full_name || ''}
                      className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500"
                    />
                  </label>
                  <label className="block">
                    <span className="block text-sm font-medium text-gray-700 mb-1">Email address</span>
                    <input
                      type="email"
                      placeholder="you@example.com"
                      defaultValue={user?.email || ''}
                      className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500"
                    />
                  </label>
                </div>

                {/* Kora info banner */}
                {selectedMethod === 'kora' && (
                  <div className="rounded-xl border border-purple-100 bg-purple-50 p-4">
                    <div className="flex items-center gap-2 mb-1">
                      <Wallet className="w-5 h-5 text-purple-700" />
                      <p className="text-sm font-semibold text-gray-900">Pay with Kora</p>
                    </div>
                    <p className="text-xs text-gray-600">
                      You will be redirected to Kora's secure checkout to pay via card, USSD, or bank transfer.
                      Your plan activates automatically upon successful payment.
                    </p>
                  </div>
                )}

                {/* Transfer details */}
                {selectedMethod === 'transfer' && (
                  <div className="rounded-xl border border-blue-100 bg-blue-50 p-4">
                    <p className="text-sm font-semibold text-gray-900">Transfer to JobBridge Connect Africa</p>
                    <div className="mt-3 grid sm:grid-cols-3 gap-3 text-sm">
                      <div>
                        <p className="text-xs text-gray-500">Bank</p>
                        <p className="font-semibold text-gray-900">Moniepoint MFB</p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500">Account name</p>
                        <p className="font-semibold text-gray-900">JobBridge Connect Africa</p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500">Account number</p>
                        <p className="font-semibold text-gray-900">9136171354</p>
                      </div>
                      <div className="sm:col-span-3">
                        <p className="text-xs text-gray-500">Amount</p>
                        <p className="font-semibold text-blue-700">NGN {total.toLocaleString()}</p>
                      </div>
                    </div>
                    <p className="mt-3 text-xs text-gray-500">After transfer, click "I have paid" to proceed.</p>
                  </div>
                )}

                {error && (
                  <div className="rounded-lg bg-red-50 border border-red-200 p-3 text-sm text-red-700">
                    {error}
                  </div>
                )}

                <button
                  type="button"
                  onClick={handlePay}
                  disabled={paying}
                  className="w-full inline-flex items-center justify-center gap-2 rounded-lg bg-blue-700 px-5 py-3 font-semibold text-white transition-colors hover:bg-blue-800 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {paying ? (
                    <><Loader2 className="w-5 h-5 animate-spin" /> Processing...</>
                  ) : selectedMethod === 'transfer' ? (
                    <><Banknote className="w-5 h-5" /> I have paid — NGN {total.toLocaleString()}</>
                  ) : (
                    <><LockKeyhole className="w-5 h-5" /> Pay NGN {total.toLocaleString()}</>
                  )}
                </button>
              </form>
            </div>
          </section>

          <aside className="space-y-6">
            <div className="bg-white rounded-xl border border-gray-100 p-5">
              <div className="flex items-center gap-2 mb-4">
                <ReceiptText className="w-5 h-5 text-blue-700" />
                <h2 className="text-lg font-bold text-gray-900">Order summary</h2>
              </div>

              <div className="space-y-4">
                <div className="flex items-start justify-between gap-4 border-b border-gray-100 pb-4">
                  <div>
                    <p className="text-sm font-semibold text-gray-900">{plan.name}</p>
                    <p className="text-xs text-gray-500">{plan.duration}{plan.ai ? '' : ` · ${plan.credits} job post${plan.credits > 1 ? 's' : ''}`}</p>
                  </div>
                  <p className="text-sm font-semibold text-gray-900">NGN {plan.price.toLocaleString()}</p>
                </div>
              </div>

              <div className="mt-5 rounded-xl bg-gray-50 p-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-gray-600">Total due</span>
                  <span className="text-2xl font-bold text-gray-900">NGN {total.toLocaleString()}</span>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-xl border border-gray-100 p-5">
              <h2 className="text-lg font-bold text-gray-900 mb-4">What happens next?</h2>
              <div className="space-y-3">
                {[
                  'Payment is verified securely.',
                  'Your receipt is sent to your email.',
                  plan.ai ? 'AI Career Tools activated on your account.' : plan.service ? 'Professional listing activated.' : `${plan.credits} job post credit${plan.credits > 1 ? 's' : ''} added to your account.`,
                ].map((step) => (
                  <div key={step} className="flex items-start gap-3">
                    <CheckCircle className="w-5 h-5 text-emerald-500 shrink-0 mt-0.5" />
                    <p className="text-sm text-gray-600">{step}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-xl border border-blue-100 bg-blue-50 p-5">
              <div className="flex items-start gap-3">
                <BadgeCheck className="w-6 h-6 text-blue-700 shrink-0" />
                <div>
                  <h2 className="font-bold text-gray-900">Trusted by JobBridge</h2>
                  <p className="mt-1 text-sm text-gray-600">
                    Multiple secure payment options available.
                  </p>
                </div>
              </div>
            </div>
          </aside>
        </div>
      </main>

      <BottomNav />
    </div>

    {paid && (
      <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
        <div className="bg-white rounded-2xl p-8 shadow-2xl max-w-md w-full text-center">
          <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <CheckCircle className="w-8 h-8 text-emerald-600" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Payment Successful!</h1>
          <p className="text-gray-600 mb-2">Your <strong>{plan.name}</strong> plan is now active.</p>
          <p className="text-sm text-gray-500 mb-6">
            {plan.ai
              ? 'You can now use AI Career Tools from the AI Resume page.'
              : plan.service
                ? 'Your professional listing is now active.'
                : 'You can now post jobs from your recruiter dashboard.'}
          </p>
          <button
            onClick={() => navigate(successTarget)}
            className="bg-blue-700 hover:bg-blue-800 text-white px-6 py-3 rounded-lg font-semibold transition-colors"
          >
            {plan.ai ? 'Go to AI Resume Studio' : plan.service ? 'Go to My Profile' : 'Go to Dashboard'}
          </button>
        </div>
      </div>
    )}
    </>
  );
}
