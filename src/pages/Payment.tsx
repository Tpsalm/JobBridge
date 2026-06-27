import { useMemo, useState, useEffect } from 'react';
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
} from 'lucide-react';
import Header from '../components/Header';
import BottomNav from '../components/BottomNav';
import { IMG } from '../lib/media';
import { useAuth } from '../contexts/AuthContext';
import { activatePremiumPlan, recordPayment } from '../lib/supabaseQueries';

declare const PaystackPop: any;

const PLANS: Record<string, { name: string; duration: string; price: number; credits: number; ai?: boolean; service?: boolean }> = {
  basic: { name: 'Basic Job Post', duration: '7 days', price: 2000, credits: 1 },
  standard: { name: 'Standard Job Post', duration: '14 days', price: 3500, credits: 1 },
  premium: { name: 'Premium Job Post', duration: '30 days', price: 5000, credits: 3 },
  ai_monthly: { name: 'AI Career Tools Monthly', duration: '30 days', price: 1500, credits: 0, ai: true },
  ai_annual: { name: 'AI Career Tools Annual', duration: '365 days', price: 15000, credits: 0, ai: true },
  service_verified: { name: 'Verified Professional Listing', duration: '30 days', price: 3000, credits: 0, service: true },
  service_featured: { name: 'Featured Professional Listing', duration: '30 days', price: 5000, credits: 0, service: true },
};

export default function Payment() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { user, fetchSubscription, fetchAiSubscription } = useAuth();
  const planKey = searchParams.get('plan') || 'basic';
  const plan = PLANS[planKey] || PLANS.basic;

  const [selectedMethod, setSelectedMethod] = useState<'card' | 'transfer'>('card');
  const [paying, setPaying] = useState(false);
  const [paid, setPaid] = useState(false);
  const [error, setError] = useState('');

  const total = plan.price;

  // Load Paystack script
  useEffect(() => {
    if (!document.getElementById('paystack-script')) {
      const script = document.createElement('script');
      script.id = 'paystack-script';
      script.src = 'https://js.paystack.co/v1/inline.js';
      document.body.appendChild(script);
    }
  }, []);

  const handlePayWithCard = async () => {
    if (!user?.id) {
      setError('Please log in first');
      return;
    }

    setPaying(true);
    setError('');

    try {
      const publicKey = import.meta.env.VITE_PAYSTACK_PUBLIC_KEY || '';

      if (!publicKey) {
        setError('Payment is not configured. Please contact jobbridgesupport@gmail.com.');
        setPaying(false);
        return;
      }

      const reference = 'JB-' + Date.now() + '-' + Math.random().toString(36).slice(2, 8);

      // Open Paystack Inline checkout directly
      const handler = PaystackPop.setup({
        key: publicKey,
        email: user.email || 'user@example.com',
        amount: plan.price * 100,
        ref: reference,
        currency: 'NGN',
        callback: async (response: any) => {
          try {
            // Payment confirmed by Paystack — activate plan directly
            await activatePremiumPlan(user.id, planKey, plan.price);
            await recordPayment({ user_id: user.id, plan: planKey, amount: plan.price, reference: response.reference, status: 'completed' });
            if (plan.ai) {
              await fetchAiSubscription();
            } else {
              await fetchSubscription();
            }
            setPaid(true);
          } catch (err) {
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

  const handlePayWithTransfer = () => {
    setPaying(true);
    setTimeout(() => {
      setPaying(false);
      setError('Bank transfers are verified manually. Please allow up to 24 hours for activation after payment.');
    }, 1000);
  };

  const handlePay = () => {
    if (selectedMethod === 'card') {
      handlePayWithCard();
    } else {
      handlePayWithTransfer();
    }
  };

  const successTarget = plan.ai ? '/ai-resume' : plan.service ? '/providers' : '/recruiter';

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
            <div className="bg-white rounded-xl border border-gray-100 p-5">
              <div className="flex items-center gap-2 mb-4">
                <CreditCard className="w-5 h-5 text-blue-700" />
                <h2 className="text-lg font-bold text-gray-900">Payment method</h2>
              </div>

              <div className="grid sm:grid-cols-2 gap-3">
                {[
                  { id: 'card' as const, label: 'Card', helper: 'Visa, Mastercard, Verve', icon: CreditCard },
                  { id: 'transfer' as const, label: 'Transfer', helper: 'Bank transfer', icon: Banknote },
                ].map(({ id, label, helper, icon: Icon }) => {
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
                        className={`flex h-10 w-10 items-center justify-center rounded-lg ${
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

            <div className="bg-white rounded-xl border border-gray-100 p-5">
              <div className="flex items-center gap-2 mb-4">
                <LockKeyhole className="w-5 h-5 text-blue-700" />
                <h2 className="text-lg font-bold text-gray-900">Billing details</h2>
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
                    <p className="mt-3 text-xs text-gray-500">After transfer, click "I have paid" to activate your plan.</p>
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
                  ) : (
                    <><LockKeyhole className="w-5 h-5" /> {selectedMethod === 'card' ? `Pay NGN ${total.toLocaleString()}` : 'I have paid'}</>
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
                    All payments are encrypted and reviewed for fast activation.
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
