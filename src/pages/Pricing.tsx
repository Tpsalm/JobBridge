import { useEffect, useState } from 'react';
import Header from '../components/Header';
import BottomNav from '../components/BottomNav';
import { useModal } from '../contexts/ModalContext';
import { Check, Star, Zap, Briefcase, Users, Award, MessageCircle, CreditCard, ExternalLink, ChevronRight, Bot, BookOpen, ShoppingBag } from 'lucide-react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import AnimatedSection from '../components/AnimatedSection';
import Card3D from '../components/Card3D';
import FloatingDecorations from '../components/FloatingDecorations';

export default function Pricing() {
  const { openModal } = useModal();
  const navigate = useNavigate();
  const location = useLocation();

  const handleChoosePlan = (plan: string) => {
    navigate(`/payment?plan=${plan}`);
  };
  const [activeTab, setActiveTab] = useState<'jobs' | 'services' | 'business' | 'ai' | 'training'>('jobs');

  useEffect(() => {
    if (!location.hash) return;
    const h = location.hash.replace('#', '');
    if (h === 'ai') setActiveTab('ai');
    else if (h === 'services') setActiveTab('services');
    else if (h === 'business') setActiveTab('business');
    else if (h === 'training') setActiveTab('training');
    else if (h === 'jobs') setActiveTab('jobs');
  }, [location.hash]);

  return (
    <div className="min-h-screen bg-gray-50 pb-24">
      <Header />

      <div className="max-w-6xl mx-auto px-4 py-6">
        {/* Hero */}
        <div className="bg-gradient-to-r from-blue-700 to-blue-800 rounded-2xl p-6 mb-6 text-white relative overflow-hidden">
          <FloatingDecorations className="opacity-65" />
          <img
            src="https://images.pexels.com/photos/3756679/pexels-photo-3756679.jpeg?auto=compress&cs=tinysrgb&w=800&h=300&dpr=2"
            alt=""
            className="absolute inset-0 w-full h-full object-cover opacity-10"
          />
          <div className="relative">
            <h1 className="text-2xl sm:text-3xl font-bold mb-2">JobBridge Pricing</h1>
            <p className="text-blue-100">Choose the right plan for your needs</p>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex gap-2 overflow-x-auto pb-4 mb-6 hide-scrollbar">
          {[
            { id: 'jobs', label: 'Job Postings', icon: Briefcase },
            { id: 'services', label: 'Service Marketplace', icon: ShoppingBag },
            { id: 'business', label: 'Business Ads', icon: Users },
            { id: 'ai', label: 'AI Career Tools', icon: Bot },
            { id: 'training', label: 'Training', icon: BookOpen },
          ].map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setActiveTab(id as typeof activeTab)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-medium text-sm whitespace-nowrap transition-colors ${
                activeTab === id
                  ? 'bg-blue-700 text-white'
                  : 'bg-white text-gray-700 border border-gray-200 hover:border-blue-300'
              }`}
            >
              <Icon className="w-4 h-4" />
              {label}
            </button>
          ))}
        </div>

        {/* Job Postings Section */}
        {activeTab === 'jobs' && (
          <AnimatedSection direction="up"><div className="space-y-6">
            <div>
              <h2 className="text-xl font-bold text-gray-900 mb-4">Job Posting Plans</h2>
              <div className="grid md:grid-cols-3 gap-4">
                {[
                  { name: 'Basic', duration: '7 days', price: 2000, features: ['Job listing', 'Basic visibility', 'Up to 5 applicants', 'Email notifications'] },
                  { name: 'Standard', duration: '14 days', price: 3500, popular: true, features: ['Job listing', 'Medium visibility', 'Up to 15 applicants', 'Email + SMS alerts', 'Priority support'] },
                  { name: 'Premium', duration: '30 days', price: 5000, features: ['Job listing', 'High visibility', 'Unlimited applicants', 'Priority support', 'Featured placement option', 'Social media promotion'] },
                ].map((plan) => (
                  <Card3D
                    key={plan.name}
                    className={`bg-white rounded-xl p-5 border-2 ${plan.popular ? 'border-blue-500 relative' : 'border-gray-100'}`}
                    strength={6}
                  >
                    {plan.popular && (
                      <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-blue-700 text-white text-xs font-semibold px-3 py-1 rounded-full">
                        Most Popular
                      </div>
                    )}
                    <h3 className="font-bold text-gray-900 text-lg">{plan.name} Job Post</h3>
                    <div className="mt-2 mb-1">
                      <span className="text-3xl font-bold text-gray-900">₦{plan.price.toLocaleString()}</span>
                    </div>
                    <p className="text-sm text-gray-500 mb-4">{plan.duration}</p>
                    <ul className="space-y-2 mb-5">
                      {plan.features.map((feature) => (
                        <li key={feature} className="flex items-start gap-2 text-sm text-gray-600">
                          <Check className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                          {feature}
                        </li>
                      ))}
                    </ul>
                    <button
                      onClick={() => handleChoosePlan(plan.name.toLowerCase())}
                      className="w-full py-2.5 bg-blue-700 text-white rounded-lg font-medium hover:bg-blue-800 transition-colors"
                    >
                      {plan.name === 'Basic' ? 'Choose Basic' : plan.name === 'Standard' ? 'Choose Standard' : 'Choose Premium'}
                    </button>
                  </Card3D>
                ))}
              </div>
            </div>

            <div className="grid md:grid-cols-2 gap-4">
              {/* Featured Options */}
              <Card3D className="bg-white rounded-xl p-5 border border-gray-100" strength={6}>
                <h3 className="font-bold text-gray-900 mb-3 flex items-center gap-2">
                  <Star className="w-5 h-5 text-amber-500" />
                  Provider
                </h3>
                <div className="space-y-3">
                  <div className="flex justify-between items-center py-2 border-b border-gray-100">
                    <span className="text-sm text-gray-600">Featured Job</span>
                    <span className="font-semibold">₦1,000</span>
                  </div>
                  <div className="flex justify-between items-center py-2 border-b border-gray-100">
                    <span className="text-sm text-gray-600">Top of Search Results</span>
                    <span className="font-semibold">₦3,000</span>
                  </div>
                  <div className="flex justify-between items-center py-2">
                    <span className="text-sm text-gray-600">Homepage Banner</span>
                    <span className="font-semibold">₦5,000</span>
                  </div>
                </div>
                <button onClick={() => window.open('https://wa.me/2348024425069', '_blank')} className="mt-4 w-full py-2 bg-amber-50 text-amber-700 rounded-lg text-sm font-medium hover:bg-amber-100 transition-colors">
                  Learn More
                </button>
              </Card3D>

              {/* Recruitment Fee */}
              <Card3D className="bg-white rounded-xl p-5 border border-gray-100" strength={6}>
                <h3 className="font-bold text-gray-900 mb-3 flex items-center gap-2">
                  <Users className="w-5 h-5 text-blue-600" />
                  Recruitment & Placement Fee
                </h3>
                <p className="text-sm text-gray-600 mb-4">When JobBridge successfully helps you hire:</p>
                <div className="space-y-3">
                  <div className="bg-gray-50 rounded-lg p-3">
                    <h4 className="font-medium text-gray-900 text-sm">Low-Skilled Jobs</h4>
                    <p className="text-xs text-gray-500 mb-1">Security guards, Drivers, Cleaners, Sales attendants, Dispatch riders</p>
                    <p className="font-bold text-blue-700">₦5,000 per hire</p>
                  </div>
                  <div className="bg-gray-50 rounded-lg p-3">
                    <h4 className="font-medium text-gray-900 text-sm">Skilled Jobs</h4>
                    <p className="text-xs text-gray-500 mb-1">Teachers, Accountants, Managers, IT Staff</p>
                    <p className="font-bold text-blue-700">₦10,000 per hire</p>
                  </div>
                </div>
              </Card3D>
            </div>
          </div></AnimatedSection>
        )}

        {/* Service Marketplace Section */}
        {activeTab === 'services' && (
          <AnimatedSection direction="up"><div className="space-y-6">
            <h2 className="text-xl font-bold text-gray-900 mb-4">Service Provider Listing Plans</h2>
            <div className="grid md:grid-cols-3 gap-4">
              {[
                {
                  name: 'Monthly Listing',
                  price: 'FREE',
                  note: 'at launch',
                  priceNum: 0,
                  features: ['Profile on JobBridge', 'Name and contact info', 'Description of services', 'Location', 'Receive inquiries'],
                  tier: 'basic',
                },
                {
                  name: 'Verified Professional',
                  price: '₦3,000',
                  note: '/month',
                  priceNum: 3000,
                  popular: true,
                  features: ['Everything in Monthly Listing', 'Verified badge ✓', 'ID verification', 'Phone verification', 'Increased trust with customers'],
                  tier: 'verified',
                },
                {
                  name: 'Featured Professional',
                  price: '₦5,000',
                  note: '/month',
                  priceNum: 5000,
                  features: ['Everything in Verified', 'Featured badge ⭐', 'Top of search results', 'Priority placement', 'Featured on homepage', 'Promotion on WhatsApp & social media'],
                  tier: 'featured',
                },
              ].map((plan) => (
                <Card3D
                  key={plan.name}
                  className={`bg-white rounded-xl p-5 border-2 ${plan.popular ? 'border-blue-500 relative' : 'border-gray-100'}`}
                  strength={6}
                >
                  {plan.popular && (
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-blue-700 text-white text-xs font-semibold px-3 py-1 rounded-full">
                      Best Value
                    </div>
                  )}
                  <h3 className="font-bold text-gray-900 text-lg">{plan.name}</h3>
                  <div className="mt-2 mb-1">
                    <span className="text-3xl font-bold text-gray-900">{plan.price}</span>
                    <span className="text-sm text-gray-500">{plan.note}</span>
                  </div>
                  <ul className="space-y-2 mb-5 mt-4">
                    {plan.features.map((feature) => (
                      <li key={feature} className="flex items-start gap-2 text-sm text-gray-600">
                        <Check className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                        {feature}
                      </li>
                    ))}
                  </ul>
                  {plan.tier === 'basic' ? (
                    <Link
                      to="/providers"
                      className="block w-full py-2.5 bg-blue-700 text-white rounded-lg font-medium hover:bg-blue-800 transition-colors text-center"
                    >
                      Get Started Free
                    </Link>
                  ) : (
                    <button
                      onClick={() => navigate(`/payment?plan=service_${plan.tier}`)}
                      className="w-full py-2.5 bg-blue-700 text-white rounded-lg font-medium hover:bg-blue-800 transition-colors"
                    >
                      Subscribe Now
                    </button>
                  )}
                </Card3D>
              ))}
            </div>

            <Card3D className="bg-blue-50 rounded-xl p-5 border border-blue-100" strength={5}>
              <h3 className="font-bold text-gray-900 mb-3">How Search Results Work</h3>
              <p className="text-sm text-gray-600 mb-4">Featured professionals appear at the top, followed by verified, then basic listings:</p>
              <div className="space-y-2">
                <div className="flex items-center gap-3 bg-white rounded-lg p-3">
                  <span className="text-lg">⭐</span>
                  <span className="font-medium text-gray-900">Tunde Designs</span>
                  <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded">Featured</span>
                </div>
                <div className="flex items-center gap-3 bg-white rounded-lg p-3">
                  <span className="text-lg">⭐</span>
                  <span className="font-medium text-gray-900">Creative Hub</span>
                  <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded">Featured</span>
                </div>
                <div className="flex items-center gap-3 bg-white rounded-lg p-3">
                  <span className="text-lg">✓</span>
                  <span className="font-medium text-gray-900">John Graphics</span>
                  <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded">Verified</span>
                </div>
                <div className="flex items-center gap-3 bg-white rounded-lg p-3">
                  <span className="text-lg text-gray-400">○</span>
                  <span className="font-medium text-gray-900">Sarah Graphics</span>
                  <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded">Basic</span>
                </div>
              </div>
            </Card3D>
          </div></AnimatedSection>
        )}

        {/* Business Advertising Section */}
        {activeTab === 'business' && (
          <AnimatedSection direction="up"><div className="space-y-6">
            <h2 className="text-xl font-bold text-gray-900 mb-4">Business Advertisement Plans</h2>
            <p className="text-sm text-gray-600 mb-4">Promote your restaurant, hotel, fashion brand, phone repair shop, school, hospital, and more.</p>
            <div className="grid md:grid-cols-3 gap-4">
              {[
                { name: 'Weekly Ad', duration: '7 days', price: 2000, features: ['Display on platform', 'Category placement', 'Contact info visible', 'View analytics'] },
                { name: 'Monthly Ad', duration: '30 days', price: 7500, popular: true, features: ['Everything in Weekly', 'Extended visibility', 'Priority listing', 'Performance reports', 'Editable content'] },
                { name: 'Featured Business', duration: '30 days', price: 15000, features: ['Everything in Monthly', 'Homepage spotlight', 'Category prominence', 'Social media boost', 'WhatsApp status promo', 'Dedicated banner'] },
              ].map((plan) => (
                <Card3D
                  key={plan.name}
                  className={`bg-white rounded-xl p-5 border-2 ${plan.popular ? 'border-blue-500 relative' : 'border-gray-100'}`}
                  strength={6}
                >
                  {plan.popular && (
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-blue-700 text-white text-xs font-semibold px-3 py-1 rounded-full">
                      Most Popular
                    </div>
                  )}
                  <h3 className="font-bold text-gray-900 text-lg">{plan.name}</h3>
                  <div className="mt-2 mb-1">
                    <span className="text-3xl font-bold text-gray-900">₦{plan.price.toLocaleString()}</span>
                  </div>
                  <p className="text-sm text-gray-500 mb-4">{plan.duration}</p>
                  <ul className="space-y-2 mb-5">
                    {plan.features.map((feature) => (
                      <li key={feature} className="flex items-start gap-2 text-sm text-gray-600">
                        <Check className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                        {feature}
                      </li>
                    ))}
                  </ul>
                  <Link
                    to="/business"
                    className="block w-full py-2.5 bg-blue-700 text-white rounded-lg font-medium hover:bg-blue-800 transition-colors text-center"
                  >
                    Create Advert
                  </Link>
                </Card3D>
              ))}
            </div>
          </div></AnimatedSection>
        )}

        {/* AI Career Tools Section */}
        {activeTab === 'ai' && (
          <AnimatedSection direction="up"><div className="space-y-6">
            <div className="bg-gradient-to-r from-blue-600 to-blue-700 rounded-2xl p-6 text-white">
              <div className="flex items-center gap-2 mb-2">
                <Bot className="w-6 h-6" />
                <h2 className="text-xl font-bold">JobBridge AI Career Suite</h2>
              </div>
              <p className="text-blue-100">Unlock powerful AI tools designed to help you stand out and get hired faster.</p>
            </div>

            <div className="grid md:grid-cols-2 gap-4">
              {[
                { name: 'Monthly Subscription', price: 1500, period: '/month', features: ['AI CV Builder', 'AI Professional CV Upgrade', 'AI Cover Letter Generator', 'AI Interview Preparation', 'Multiple CV Templates', 'Job Application Tracker', 'AI Career Assistant'] },
                { name: 'Annual Subscription', price: 15000, period: '/year', savetag: 'Save 15%+', features: ['Everything in Monthly', 'Priority support', 'Early access to new features', 'Unlimited CV revisions', 'Export to PDF/Word', 'Custom templates', 'All future updates'] },
              ].map((plan) => (
                <Card3D key={plan.name} className="bg-white rounded-xl p-5 border border-gray-100" strength={6}>
                  <h3 className="font-bold text-gray-900 text-lg">{plan.name}</h3>
                  {plan.savetag && (
                    <span className="inline-block text-xs bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full mb-2">{plan.savetag}</span>
                  )}
                  <div className="mt-2 mb-1">
                    <span className="text-3xl font-bold text-gray-900">₦{plan.price.toLocaleString()}</span>
                    <span className="text-sm text-gray-500">{plan.period}</span>
                  </div>
                  <ul className="space-y-1.5 mb-5 mt-4">
                    {plan.features.map((feature) => (
                      <li key={feature} className="flex items-center gap-2 text-sm text-gray-600">
                        <Check className="w-4 h-4 text-emerald-500 shrink-0" />
                        {feature}
                      </li>
                    ))}
                  </ul>
                  <button
                    onClick={() => navigate(`/payment?plan=ai_${plan.name === 'Monthly Subscription' ? 'monthly' : 'annual'}`)}
                    className="w-full py-2.5 bg-blue-700 text-white rounded-lg font-medium hover:bg-blue-800 transition-colors"
                  >
                    Subscribe
                  </button>
                </Card3D>
              ))}
            </div>
          </div></AnimatedSection>
        )}

        {/* Training Section */}
        {activeTab === 'training' && (
          <AnimatedSection direction="up"><div className="space-y-6">
            <h2 className="text-xl font-bold text-gray-900 mb-4">Training & Certification</h2>
            <p className="text-sm text-gray-600 mb-4">Get trained by JobBridge in essential skills and earn recognized certifications.</p>

            <div className="grid md:grid-cols-2 gap-4">
              {[
                { name: 'Customer Service', price: 5000, duration: '4 weeks', desc: 'Learn professional customer handling, communication, and service excellence.' },
                { name: 'Microsoft Office', price: 10000, duration: '6 weeks', desc: 'Master Word, Excel, PowerPoint, and Outlook for professional environments.' },
                { name: 'Digital Skills', price: 15000, duration: '8 weeks', desc: 'Build skills in digital marketing, social media, and online business tools.' },
                { name: 'Sales Training', price: 5000, duration: '4 weeks', desc: 'Learn effective selling techniques, negotiation, and closing strategies.' },
              ].map((course) => (
                <Card3D key={course.name} className="bg-white rounded-xl p-5 border border-gray-100 relative overflow-hidden" strength={6}>
                  <div className="absolute top-3 right-3 z-10">
                    <span className="bg-amber-400 text-amber-900 text-[10px] font-bold px-2 py-0.5 rounded-full animate-pulse-subtle">Coming Soon</span>
                  </div>
                  <div className="flex items-center gap-2 mb-1">
                    <BookOpen className="w-5 h-5 text-blue-600" />
                    <h3 className="font-bold text-gray-900">{course.name}</h3>
                  </div>
                  <p className="text-sm text-gray-600 mb-3">{course.desc}</p>
                  <div className="flex items-center gap-4 mb-3 text-sm text-gray-500">
                    <span>Duration: {course.duration}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xl font-bold text-blue-700">₦{course.price.toLocaleString()}</span>
                  </div>
                </Card3D>
              ))}
            </div>

            <Card3D className="bg-emerald-50 rounded-xl p-6 border border-emerald-100" strength={5}>
              <div className="flex items-start gap-4">
                <MessageCircle className="w-6 h-6 text-emerald-600 shrink-0 mt-1" />
                <div>
                  <h3 className="font-bold text-gray-900 mb-2">Need help choosing the right training?</h3>
                  <p className="text-sm text-gray-600 mb-4">Click "Get Trained" to chat with us on WhatsApp. We'll help you find the right training program based on your interests, experience, and career goals, and get certified.</p>
                  <a
                    href="https://wa.me/2348000000000?text=Hello%20JobBridge!%20I'm%20interested%20in%20your%20training%20programs."
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 bg-emerald-600 text-white px-5 py-2.5 rounded-lg font-medium hover:bg-emerald-700 transition-colors"
                  >
                    <MessageCircle className="w-5 h-5" />
                    Get Trained
                    <ExternalLink className="w-4 h-4" />
                  </a>
                </div>
              </div>
            </Card3D>
          </div></AnimatedSection>
        )}

      </div>
      <BottomNav />
    </div>
  );
}
