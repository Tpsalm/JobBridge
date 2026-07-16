import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import Header from '../components/Header';
import BottomNav from '../components/BottomNav';
import { useModal } from '../contexts/ModalContext';
import { fetchAdvertisementsByOwner } from '../lib/supabaseQueries';
import { Building, Plus, Eye, Clock, CheckCircle, AlertCircle, CreditCard, TrendingUp, BarChart3, Star, ChevronRight, Edit, Trash2, ExternalLink } from 'lucide-react';
import PageHero from '../components/PageHero';
import { HERO_CAROUSELS, advertImage } from '../lib/media';

type AdvertStatus = 'pending' | 'active' | 'paused' | 'expired' | 'rejected';

interface Advert {
  id: string;
  businessName: string;
  title: string;
  description: string;
  category: string;
  duration: string;
  price: number;
  status: AdvertStatus;
  startDate: string;
  endDate: string;
  views: number;
  clicks: number;
  featured: boolean;
}

const initialAdverts: Advert[] = [];

const adPackages = [
  { name: 'Weekly Ad', duration: '7 days', price: 2000, popular: false },
  { name: 'Monthly Ad', duration: '30 days', price: 7500, popular: true },
  { name: 'Featured Business', duration: '30 days', price: 15000, popular: false },
];

const categories = ['Restaurant', 'Fashion', 'Technology', 'Education', 'Health', 'Entertainment', 'Automotive', 'Real Estate', 'Other'];

export default function Business() {
  const { openModal } = useModal();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user } = useAuth();
  const [adverts, setAdverts] = useState<Advert[]>(initialAdverts);
  const [loadingAdverts, setLoadingAdverts] = useState(false);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [formData, setFormData] = useState({
    businessName: '',
    title: '',
    description: '',
    category: '',
    package: '',
    featured: false,
  });

  useEffect(() => {
    if (searchParams.get('create') === 'true') {
      setShowCreateForm(true);
    }
  }, [searchParams]);

  useEffect(() => {
    if (!user?.id) {
      setAdverts([]);
      return;
    }

    let cancelled = false;
    const loadAdverts = async () => {
      setLoadingAdverts(true);
      try {
        const data = await fetchAdvertisementsByOwner(user.id);
        if (!cancelled) {
          setAdverts(
            data.map((ad) => ({
              id: ad.id,
              businessName: ad.business_name,
              title: ad.title,
              description: ad.description,
              category: ad.category,
              duration:
                ad.package === 'weekly'
                  ? 'Weekly'
                  : ad.package === 'monthly'
                  ? 'Monthly'
                  : 'Featured',
              price: ad.amount_paid || (ad.package === 'weekly' ? 2000 : ad.package === 'monthly' ? 7500 : 15000),
              status: ad.status,
              startDate: ad.starts_at ? ad.starts_at.split('T')[0] : '',
              endDate: ad.expires_at ? ad.expires_at.split('T')[0] : '',
              views: ad.views || 0,
              clicks: ad.clicks || 0,
              featured: ad.is_featured || false,
            })),
          );
        }
      } catch (error) {
        console.error('Failed to load business adverts:', error);
        if (!cancelled) setAdverts([]);
      } finally {
        if (!cancelled) setLoadingAdverts(false);
      }
    };

    loadAdverts();
    return () => {
      cancelled = true;
    };
  }, [user?.id]);

  const handleCreateAd = (e: React.FormEvent) => {
    e.preventDefault();
    const selectedPackage = adPackages.find(p => p.name === formData.package);
    if (!selectedPackage) return;

    // If package requires payment, save advert to session and redirect to checkout
    const packageKey = selectedPackage.name === 'Weekly Ad' ? 'business_weekly' : selectedPackage.name === 'Monthly Ad' ? 'business_monthly' : 'business_featured';
    const pending = {
      businessName: formData.businessName,
      title: formData.title,
      description: formData.description,
      category: formData.category,
      package: packageKey,
      featured: formData.featured,
    };

    try {
      sessionStorage.setItem('jb_pending_advert', JSON.stringify(pending));
    } catch {}

    setShowCreateForm(false);
    setFormData({ businessName: '', title: '', description: '', category: '', package: '', featured: false });

    // If user not authenticated, redirect to login first
    if (!user) {
      navigate(`/login?redirect=${encodeURIComponent(`/payment?plan=${packageKey}`)}`);
      return;
    }

    navigate(`/payment?plan=${packageKey}`);
  };

  const toggleAdStatus = (id: string) => {
    setAdverts(adverts.map(ad =>
      ad.id === id
        ? { ...ad, status: ad.status === 'active' ? 'paused' : 'active' }
        : ad
    ));
  };

  const deleteAdvert = (id: string) => {
    setAdverts(adverts.filter(ad => ad.id !== id));
  };

  const stats = {
    totalAds: adverts.length,
    activeAds: adverts.filter(a => a.status === 'active').length,
    totalViews: adverts.reduce((sum, ad) => sum + ad.views, 0),
    totalClicks: adverts.reduce((sum, ad) => sum + ad.clicks, 0),
  };

  return (
    <div className="min-h-screen bg-gray-50 pb-24">
      <Header />

      <PageHero
        title="Business Advertisements"
        subtitle="Promote your business to thousands of JobBridge users across Nigeria"
        images={HERO_CAROUSELS.business}
        imageAlt="Small business owner promoting their brand"
        compact
      />

      <div className="max-w-6xl mx-auto px-4 py-6">
        {/* Stats */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
          <div className="bg-white rounded-xl p-4 border border-gray-100">
            <div className="text-2xl font-bold text-gray-900">{stats.totalAds}</div>
            <div className="text-xs text-gray-500">Total Adverts</div>
          </div>
          <div className="bg-white rounded-xl p-4 border border-gray-100">
            <div className="text-2xl font-bold text-emerald-600">{stats.activeAds}</div>
            <div className="text-xs text-gray-500">Active Now</div>
          </div>
          <div className="bg-white rounded-xl p-4 border border-gray-100">
            <div className="text-2xl font-bold text-blue-700">{stats.totalViews.toLocaleString()}</div>
            <div className="text-xs text-gray-500">Total Views</div>
          </div>
          <div className="bg-white rounded-xl p-4 border border-gray-100">
            <div className="text-2xl font-bold text-amber-600">{stats.totalClicks}</div>
            <div className="text-xs text-gray-500">Total Clicks</div>
          </div>
        </div>

        {/* Pricing Cards */}
        <div className="mb-8">
          <h2 className="text-lg font-bold text-gray-900 mb-4">Advert Packages</h2>
          <div className="grid md:grid-cols-3 gap-4">
            {adPackages.map((pkg) => (
              <div
                key={pkg.name}
                className={`bg-white rounded-xl p-5 border-2 ${pkg.popular ? 'border-blue-500 relative' : 'border-gray-100'}`}
              >
                {pkg.popular && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-blue-700 text-white text-xs font-semibold px-3 py-1 rounded-full">
                    Most Popular
                  </div>
                )}
                <div className="text-sm font-medium text-gray-600 mb-1">{pkg.name}</div>
                <div className="text-2xl font-bold text-gray-900 mb-1">₦{pkg.price.toLocaleString()}</div>
                <div className="text-xs text-gray-500 mb-4">{pkg.duration}</div>
                <ul className="space-y-2 text-sm text-gray-600 mb-4">
                  <li className="flex items-center gap-2">
                    <CheckCircle className="w-4 h-4 text-emerald-500" />
                    Display on platform
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle className="w-4 h-4 text-emerald-500" />
                    Category placement
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle className="w-4 h-4 text-emerald-500" />
                    View analytics
                  </li>
                  {pkg.name === 'Featured Business' && (
                    <li className="flex items-center gap-2">
                      <Star className="w-4 h-4 text-amber-500" />
                      Homepage spotlight
                    </li>
                  )}
                </ul>
                <button
                  onClick={() => {
                    setFormData({ ...formData, package: pkg.name });
                    setShowCreateForm(true);
                  }}
                  className={`w-full py-2.5 rounded-lg font-medium text-sm transition-colors ${
                    pkg.popular
                      ? 'bg-blue-700 text-white hover:bg-blue-800'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  Create Advert
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* Create Advert Form */}
        {showCreateForm && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
            <div className="w-full max-w-lg bg-white rounded-2xl shadow-2xl p-6">
              <h2 className="text-xl font-bold text-gray-900 mb-4">Create New Advert</h2>
              <form onSubmit={handleCreateAd} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Business Name *</label>
                  <input
                    type="text"
                    required
                    value={formData.businessName}
                    onChange={(e) => setFormData({ ...formData, businessName: e.target.value })}
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                    placeholder="Your business name"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Advert Title *</label>
                  <input
                    type="text"
                    required
                    value={formData.title}
                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                    placeholder="Catchy headline for your advert"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Description *</label>
                  <textarea
                    required
                    rows={3}
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none resize-none"
                    placeholder="Describe your product or service..."
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Category *</label>
                    <select
                      required
                      value={formData.category}
                      onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                      className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                    >
                      <option value="">Select...</option>
                      {categories.map(cat => (
                        <option key={cat} value={cat}>{cat}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Package *</label>
                    <select
                      required
                      value={formData.package}
                      onChange={(e) => setFormData({ ...formData, package: e.target.value })}
                      className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                    >
                      <option value="">Select...</option>
                      {adPackages.map(pkg => (
                        <option key={pkg.name} value={pkg.name}>{pkg.name} - ₦{pkg.price.toLocaleString()}</option>
                      ))}
                    </select>
                  </div>
                </div>
                <div className="flex items-center gap-3 p-3 bg-amber-50 rounded-lg border border-amber-200">
                  <input
                    type="checkbox"
                    id="featured"
                    checked={formData.featured}
                    onChange={(e) => setFormData({ ...formData, featured: e.target.checked })}
                    className="w-5 h-5 rounded text-amber-500 focus:ring-amber-500"
                  />
                  <label htmlFor="featured" className="text-sm">
                    <span className="font-medium text-gray-900">Add Featured placement (+₦1,000)</span>
                    <br />
                    <span className="text-gray-600">Your advert gets priority positioning</span>
                  </label>
                </div>
                <div className="flex gap-3 pt-4">
                  <button
                    type="button"
                    onClick={() => setShowCreateForm(false)}
                    className="flex-1 py-2.5 border border-gray-300 rounded-lg font-medium text-gray-700 hover:bg-gray-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="flex-1 py-2.5 bg-blue-700 text-white rounded-lg font-medium hover:bg-blue-800"
                  >
                    Submit Advert
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Create New Advert Button */}
        <button
          onClick={() => setShowCreateForm(true)}
          className="w-full flex items-center justify-center gap-2 bg-blue-700 text-white py-3 rounded-xl font-semibold hover:bg-blue-800 transition-colors mb-8"
        >
          <Plus className="w-5 h-5" />
          Create New Advert
        </button>

        {/* My Adverts */}
        <div className="mb-8">
          <h2 className="text-lg font-bold text-gray-900 mb-4">My Adverts</h2>
          {loadingAdverts ? (
            <div className="bg-white rounded-xl p-8 text-center border border-gray-100">
              <Building className="w-12 h-12 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-500">Loading your adverts...</p>
            </div>
          ) : adverts.length === 0 ? (
            <div className="bg-white rounded-xl p-8 text-center border border-gray-100">
              <Building className="w-12 h-12 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-500">No adverts yet. Create your first advert above!</p>
            </div>
          ) : (
            <div className="space-y-4">
              {adverts.map((advert) => (
                <div
                  key={advert.id}
                  className={`bg-white rounded-xl overflow-hidden border ${advert.featured ? 'border-amber-200 ring-1 ring-amber-200' : 'border-gray-100'}`}
                >
                  <img
                    src={advertImage(advert.category)}
                    alt={advert.title}
                    className="w-full h-36 object-cover"
                  />
                  <div className="p-5">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="font-bold text-gray-900">{advert.title}</h3>
                        {advert.featured && (
                          <span className="flex items-center gap-1 text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full">
                            <Star className="w-3 h-3" /> Featured
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-gray-600">{advert.businessName}</p>
                    </div>
                    <span
                      className={`px-2.5 py-1 rounded-full text-xs font-medium ${
                        advert.status === 'active'
                          ? 'bg-emerald-100 text-emerald-700'
                          : advert.status === 'pending'
                          ? 'bg-amber-100 text-amber-700'
                          : advert.status === 'paused'
                          ? 'bg-gray-100 text-gray-600'
                          : 'bg-red-100 text-red-600'
                      }`}
                    >
                      {advert.status.charAt(0).toUpperCase() + advert.status.slice(1)}
                    </span>
                  </div>

                  <p className="text-sm text-gray-500 mb-3">{advert.description}</p>

                  <div className="flex flex-wrap gap-4 text-sm text-gray-600 mb-4">
                    <span className="flex items-center gap-1">
                      <Building className="w-4 h-4" />
                      {advert.category}
                    </span>
                    <span className="flex items-center gap-1">
                      <Clock className="w-4 h-4" />
                      {advert.duration}
                    </span>
                    <span className="flex items-center gap-1">
                      <Eye className="w-4 h-4" />
                      {advert.views.toLocaleString()} views
                    </span>
                    <span className="flex items-center gap-1">
                      <TrendingUp className="w-4 h-4" />
                      {advert.clicks} clicks
                    </span>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <button
                      onClick={() => toggleAdStatus(advert.id)}
                      className={`px-3 py-1.5 rounded-lg text-sm font-medium ${
                        advert.status === 'active'
                          ? 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                          : 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200'
                      }`}
                    >
                      {advert.status === 'active' ? 'Pause' : 'Activate'}
                    </button>
                    <button className="px-3 py-1.5 rounded-lg text-sm font-medium bg-blue-50 text-blue-700 hover:bg-blue-100">
                      <Edit className="w-4 h-4 inline mr-1" />
                      Edit
                    </button>
                    <button
                      onClick={() => deleteAdvert(advert.id)}
                      className="px-3 py-1.5 rounded-lg text-sm font-medium bg-red-50 text-red-600 hover:bg-red-100"
                    >
                      <Trash2 className="w-4 h-4 inline mr-1" />
                      Delete
                    </button>
                  </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Blog Section - Combined */}
        <div className="bg-white rounded-xl p-5 border border-gray-100">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold text-gray-900">Business Tips & Insights</h2>
            <Link to="/blog" className="text-sm text-blue-700 hover:underline flex items-center gap-1">
              View All <ChevronRight className="w-4 h-4" />
            </Link>
          </div>
          <div className="grid md:grid-cols-2 gap-4">
            <div className="bg-gray-50 rounded-lg overflow-hidden">
              <img src="https://images.pexels.com/photos/5668855/pexels-photo-5668855.jpeg?auto=compress&cs=tinysrgb&w=400&h=200&dpr=2" alt="Effective adverts" className="w-full h-36 object-cover" />
              <div className="p-4">
                <h3 className="font-medium text-gray-900 mb-2">How to Write Effective Adverts</h3>
                <p className="text-sm text-gray-600 mb-2">Learn the secrets to creating ads that convert viewers into customers.</p>
                <button onClick={() => openModal('info', { title: 'Effective Adverts', content: 'Key tips: Use clear headlines, include a call-to-action, showcase benefits not just features, add high-quality images, and always include contact information.' })} className="text-sm text-blue-700 hover:underline">Read more</button>
              </div>
            </div>
            <div className="bg-gray-50 rounded-lg overflow-hidden">
              <img src="https://images.pexels.com/photos/3760067/pexels-photo-3760067.jpeg?auto=compress&cs=tinysrgb&w=400&h=200&dpr=2" alt="Ad ROI" className="w-full h-36 object-cover" />
              <div className="p-4">
                <h3 className="font-medium text-gray-900 mb-2">Maximizing Your Ad ROI</h3>
                <p className="text-sm text-gray-600 mb-2">Get the most out of your advertising budget with these proven strategies.</p>
                <button onClick={() => openModal('info', { title: 'Ad ROI Tips', content: 'To maximize ROI: Target the right category, upgrade to featured for higher visibility, update your ads regularly, respond to inquiries quickly, and track performance metrics.' })} className="text-sm text-blue-700 hover:underline">Read more</button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <BottomNav />
    </div>
  );
}
