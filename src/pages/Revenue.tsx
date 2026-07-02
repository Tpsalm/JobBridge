import Header from '../components/Header';
import BottomNav from '../components/BottomNav';
import { useModal } from '../contexts/ModalContext';
import {
  TrendingUp,
  Percent,
  Users,
  Zap,
  Globe,
  FileText,
} from 'lucide-react';
import PageHero from '../components/PageHero';
import { HERO_CAROUSELS } from '../lib/media';

export default function Revenue() {
  const { openModal } = useModal();

  const kpis = [
    {
      label: 'MRR',
      value: '₦284K',
      change: '+18%',
      icon: TrendingUp,
      color: 'bg-blue-50 text-blue-700',
    },
    {
      label: 'ARR',
      value: '₦3.4M',
      change: '+22%',
      icon: TrendingUp,
      color: 'bg-emerald-50 text-emerald-700',
    },
    {
      label: 'Churn Rate',
      value: '2.1%',
      change: '-0.3%',
      icon: Percent,
      color: 'bg-amber-50 text-amber-700',
    },
    {
      label: 'LTV',
      value: '₦847',
      change: '+12%',
      icon: Users,
      color: 'bg-rose-50 text-rose-700',
    },
  ];

  const projections = [
    { month: 'Jan', expectedMrr: '₦280K', users: '2.05M', conversionRate: '6.2%' },
    { month: 'Feb', expectedMrr: '₦298K', users: '2.15M', conversionRate: '6.5%' },
    { month: 'Mar', expectedMrr: '₦315K', users: '2.25M', conversionRate: '6.8%' },
    { month: 'Apr', expectedMrr: '₦332K', users: '2.35M', conversionRate: '7.1%' },
    { month: 'May', expectedMrr: '₦351K', users: '2.45M', conversionRate: '7.4%' },
    { month: 'Jun', expectedMrr: '₦368K', users: '2.55M', conversionRate: '7.7%' },
  ];

  const plans = [
    {
      name: 'Free',
      price: '₦0',
      period: '/mo',
      features: ['5 job applications/mo', 'Basic matching', 'Community support'],
      button: 'Starter',
      buttonVariant: 'secondary',
    },
    {
      name: 'Professional',
      price: '₦29',
      period: '/mo',
      features: ['Unlimited applications', 'AI matching', 'Priority support', 'Advanced analytics'],
      button: 'Upgrade',
      buttonVariant: 'primary',
      isCurrentPlan: true,
    },
    {
      name: 'Enterprise',
      price: '₦99',
      period: '/mo per seat',
      features: ['Everything included', 'API access', 'White-label', 'Dedicated CSM', 'SSO'],
      button: 'Contact Sales',
      buttonVariant: 'secondary',
    },
  ];
  // Icons
  const Crown = TrendingUp;
  const Building = Users;
  const Briefcase = TrendingUp;

  const revenueStreams = [
    {
      name: 'Premium Subscriptions',
      revenue: '₦190K',
      growth: '+24%',
      icon: Crown,
    },
    {
      name: 'Enterprise Licenses',
      revenue: '₦65K',
      growth: '+18%',
      icon: Building,
    },
    {
      name: 'Service Marketplace',
      revenue: '₦18K',
      growth: '+12%',
      icon: Briefcase,
    },
    {
      name: 'AI Resume Tools',
      revenue: '₦8K',
      growth: '+8%',
      icon: FileText,
    },
    {
      name: 'Job Posting Fees',
      revenue: '₦2K',
      growth: '+5%',
      icon: Zap,
    },
    {
      name: 'Data Insights API',
      revenue: '₦1K',
      growth: '+2%',
      icon: Globe,
    },
  ];

  const investorMetrics = [
    { label: 'CAC', value: '₦23', description: 'Customer Acquisition Cost' },
    { label: 'NPS Score', value: '72', description: 'Net Promoter Score' },
    { label: 'Gross Margin', value: '84%', description: 'Gross Profit Margin' },
  ];
  

  return (
    <div className="min-h-screen bg-stone-50">
      <Header />

      <PageHero
        title="Revenue & Growth Dashboard"
        subtitle="Real-time metrics and growth forecasts"
        images={HERO_CAROUSELS.revenue}
        imageAlt="Business growth and revenue charts"
        compact
      />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
        {/* Revenue KPIs */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          {kpis.map(({ label, value, change, icon: Icon, color }) => (
            <div key={label} className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm">
              <div className="flex items-start justify-between mb-4">
                <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${color}`}>
                  <Icon className="w-6 h-6" />
                </div>
                <span className="text-xs font-semibold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded">
                  {change}
                </span>
              </div>
              <div className="text-3xl font-bold text-gray-900">{value}</div>
              <div className="text-xs text-gray-500 mt-1">{label}</div>
            </div>
          ))}
        </div>

        <div className="grid lg:grid-cols-3 gap-8">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-8">
            {/* Revenue Breakdown */}
            <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm">
              <h2 className="text-lg font-bold text-gray-900 mb-6">Revenue Breakdown</h2>
              <div className="flex items-center justify-center">
                <div
                  className="w-48 h-48 rounded-full"
                  style={{
                    background:
                      'conic-gradient(from 0deg, rgb(29, 78, 216) 0deg 241.2deg, rgb(7, 89, 133) 241.2deg 387.54deg, rgb(253, 224, 71) 387.54deg 360deg)',
                  }}
                />
              </div>
              <div className="flex flex-col gap-4 mt-6">
                <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <div className="flex items-center gap-3">
                    <div className="w-3 h-3 rounded-full bg-blue-700" />
                    <span className="text-sm font-medium text-gray-900">Premium Subscriptions</span>
                  </div>
                  <span className="text-sm font-semibold text-gray-900">67%</span>
                </div>
                <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <div className="flex items-center gap-3">
                    <div className="w-3 h-3 rounded-full" style={{ backgroundColor: 'rgb(7, 89, 133)' }} />
                    <span className="text-sm font-medium text-gray-900">Enterprise</span>
                  </div>
                  <span className="text-sm font-semibold text-gray-900">23%</span>
                </div>
                <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <div className="flex items-center gap-3">
                    <div className="w-3 h-3 rounded-full bg-amber-400" />
                    <span className="text-sm font-medium text-gray-900">Services</span>
                  </div>
                  <span className="text-sm font-semibold text-gray-900">10%</span>
                </div>
              </div>
            </div>

            {/* Growth Projections */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
              <div className="p-6 border-b border-gray-100">
                <h2 className="text-lg font-bold text-gray-900">Growth Projections (6 Months)</h2>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-100 bg-gray-50">
                      <th className="text-left py-3 px-6 font-semibold text-gray-700">Month</th>
                      <th className="text-left py-3 px-6 font-semibold text-gray-700">Expected MRR</th>
                      <th className="text-left py-3 px-6 font-semibold text-gray-700">Users</th>
                      <th className="text-left py-3 px-6 font-semibold text-gray-700">Conversion Rate</th>
                    </tr>
                  </thead>
                  <tbody>
                    {projections.map((proj, i) => (
                      <tr key={i} className="border-b border-gray-100 hover:bg-gray-50">
                        <td className="py-3 px-6 font-medium text-gray-900">{proj.month}</td>
                        <td className="py-3 px-6 text-gray-700">{proj.expectedMrr}</td>
                        <td className="py-3 px-6 text-gray-700">{proj.users}</td>
                        <td className="py-3 px-6 font-medium text-blue-700">{proj.conversionRate}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Pricing Tiers */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
              <h2 className="text-lg font-bold text-gray-900 mb-6">Pricing Tiers</h2>
              <div className="grid md:grid-cols-3 gap-6">
                {plans.map((plan, i) => (
                  <div
                    key={i}
                    className={`rounded-xl border-2 p-6 ${
                      plan.isCurrentPlan
                        ? 'border-blue-700 bg-blue-50'
                        : 'border-gray-200 bg-white'
                    }`}
                  >
                    <h3 className="text-lg font-bold text-gray-900">{plan.name}</h3>
                    <div className="mt-2 mb-4">
                      <span className="text-4xl font-bold text-gray-900">{plan.price}</span>
                      <span className="text-gray-500 text-sm">{plan.period}</span>
                    </div>
                    <ul className="space-y-2 mb-6">
                      {plan.features.map((feature, j) => (
                        <li key={j} className="flex items-start gap-2 text-sm text-gray-700">
                          <span className="text-blue-700 font-bold mt-0.5">✓</span>
                          {feature}
                        </li>
                      ))}
                    </ul>
                    {plan.buttonVariant === 'primary' ? (
                      <button
                        onClick={() => openModal('premium')}
                        className="w-full py-2 px-4 rounded-lg bg-blue-700 text-white font-semibold hover:bg-blue-800 transition-colors"
                      >
                        {plan.button}
                      </button>
                    ) : plan.name === 'Enterprise' ? (
                      <button
                        onClick={() => openModal('message', { name: 'Sales Team' })}
                        className="w-full py-2 px-4 rounded-lg bg-gray-200 text-gray-900 font-semibold hover:bg-gray-300 transition-colors"
                      >
                        {plan.button}
                      </button>
                    ) : (
                      <button
                        disabled
                        className="w-full py-2 px-4 rounded-lg bg-gray-100 text-gray-600 font-semibold cursor-not-allowed"
                      >
                        {plan.button}
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Sidebar */}
          <div className="space-y-8">
            {/* Revenue Streams */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
              <h2 className="text-lg font-bold text-gray-900 mb-5">Revenue Streams</h2>
              <div className="space-y-4">
                {revenueStreams.map((stream, i) => (
                  <div key={i} className="p-4 bg-gray-50 rounded-lg border border-gray-100">
                    <div className="flex items-start justify-between mb-2">
                      <h3 className="font-medium text-gray-900 text-sm">{stream.name}</h3>
                      <span className="text-xs font-semibold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded">
                        {stream.growth}
                      </span>
                    </div>
                    <p className="text-lg font-bold text-gray-900">{stream.revenue}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Investor Metrics */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
              <h2 className="text-lg font-bold text-gray-900 mb-5">Investor Metrics</h2>
              <div className="space-y-4">
                {investorMetrics.map((metric, i) => (
                  <div key={i} className="pb-4 border-b border-gray-100 last:border-0">
                    <div className="flex items-baseline gap-2 mb-1">
                      <div className="text-3xl font-bold text-blue-700">{metric.value}</div>
                      <span className="text-xs text-gray-500 font-medium">{metric.label}</span>
                    </div>
                    <p className="text-xs text-gray-500">{metric.description}</p>
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
