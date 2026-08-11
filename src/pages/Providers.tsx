import React, { useState, useRef, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import Header from '../components/Header';
import BottomNav from '../components/BottomNav';
import { useModal } from '../contexts/ModalContext';
import { useAuthRequired } from '../hooks/useAuthRequired';
import { useAuth } from '../contexts/AuthContext';
import { fetchProviders, createConversationMessage } from '../lib/supabaseQueries';
import { PROVIDER_CATEGORIES } from '../lib/providerCategories';
import type { Profile } from '../lib/supabase';
import { Search, Star, ArrowRight, MessageCircle, Send, X, BadgeCheck, Sparkles, MapPin, Clock, ChevronDown, ChevronUp, Users } from 'lucide-react';
import FloatingDecorations from '../components/FloatingDecorations';
import { IMG } from '../lib/media';

interface Message {
  id: number;
  text: string;
  sender: 'user' | 'provider';
  timestamp: Date;
}

interface ProviderDisplay {
  id: string;
  email: string;
  name: string;
  specialty: string;
  rating: number;
  reviews: number;
  hourlyRate: number;
  specializations: string[];
  img: string;
  verified: boolean;
  featured: boolean;
  tier: string;
  location: string;
}

const categoryList: string[] = [...PROVIDER_CATEGORIES];

const SERVICE_KEYWORDS: Record<string, string[]> = {
  'Technology': ['software', 'developer', 'web', 'mobile', 'programming', 'coding', 'frontend', 'backend', 'fullstack', 'app', 'data analyst', 'data scientist', 'virtual assistant', 'it', 'computer', 'phone repair', 'tech', 'ui/ux', 'ui ux'],
  'Creative & Media': ['design', 'graphic', 'ui', 'ux', 'video', 'editor', 'photographer', 'photography', 'content creator', 'social media manager', 'copywriter', 'musician', 'saxophonist', 'dj', 'music', 'creative', 'animator', 'branding'],
  'Business & Administration': ['administrative', 'virtual assistant', 'hr', 'human resources', 'project manager', 'accountant', 'accounting', 'business development', 'tax', 'admin', 'customer support', 'secretary'],
  'Sales & Marketing': ['sales', 'marketing', 'digital marketing', 'social media', 'seo', 'content', 'copywriter', 'brand', 'advertising', 'business development', 'affiliate'],
  'Engineering & Construction': ['civil engineer', 'mechanical engineer', 'electrical engineer', 'architect', 'quantity surveyor', 'building', 'construction', 'mason', 'interior design', 'landscaping', 'furniture', 'welder', 'engineer'],
  'Skilled Trades': ['electrician', 'plumber', 'carpenter', 'welder', 'mason', 'painter', 'panel beater', 'generator repair', 'appliance repair', 'mechanic', 'auto mechanic', 'ac installer', 'borehole driller', 'repair', 'maintenance'],
  'Beauty & Fashion': ['barber', 'hair stylist', 'makeup artist', 'nail tech', 'beauty salon', 'barbing salon', 'spa', 'wellness', 'fashion designer', 'tailor', 'fashion house', 'nail', 'makeup', 'hair', 'salon'],
  'Food & Hospitality': ['chef', 'baker', 'caterer', 'catering', 'cook', 'restaurant', 'food', 'hospitality'],
  'Health & Wellness': ['nurse', 'doctor', 'pharmacist', 'medical', 'clinic', 'pharmacy', 'fitness trainer', 'gym', 'wellness', 'spa', 'healthcare'],
  'Education': ['teacher', 'tutor', 'private tutor', 'coaching', 'training', 'translator', 'education', 'instructor'],
  'Transportation & Logistics': ['driver', 'dispatcher', 'rider', 'courier', 'delivery', 'logistics', 'car rental', 'transport', 'travel', 'tours'],
  'Home & Property Services': ['cleaner', 'cleaning', 'sofa cleaner', 'dry cleaner', 'laundry', 'pest control', 'gardening', 'landscaping', 'painting', 'plumber', 'electrician', 'carpenter', 'real estate', 'property', 'home'],
  'Professional Services': ['lawyer', 'legal', 'accountant', 'accounting', 'tax', 'consulting', 'consultant', 'real estate agent', 'visa', 'immigration', 'translator', 'printing', 'coworking', 'security guard'],
  'Events & Entertainment': ['dj', 'musician', 'saxophonist', 'mc', 'compere', 'event planner', 'photography', 'videography', 'entertainment', 'event', 'wedding'],
  'Agriculture': ['agriculture', 'farming', 'farm', 'agro', 'poultry', 'fishery', 'crop', 'livestock'],
  'Cleaning & Maintenance': ['cleaner', 'cleaning', 'sofa cleaner', 'dry cleaner', 'laundry', 'pest control', 'cleaning equipment', 'maintenance', 'janitorial', 'equipment rental'],
};

const categories = ['All', ...categoryList];

export default function Providers() {
  const navigate = useNavigate();
  const { openModal } = useModal();
  const { openProtectedModal, executeIfAuthenticated } = useAuthRequired();
  const { user, profile } = useAuth();
  const [providers, setProviders] = useState<ProviderDisplay[]>([]);
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [chatProvider, setChatProvider] = useState<ProviderDisplay | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [showDirectory, setShowDirectory] = useState(false);

  useEffect(() => {
    fetchProviders().then(data => {
      const mapped: ProviderDisplay[] = data.map(p => {
        const specialty = p.specialty || p.service_category || 'Professional';
        const specializations = Array.from(
          new Set([...(p.skills || []), p.service_category].filter(Boolean) as string[]),
        ).slice(0, 3);

        return {
          id: p.id,
          email: p.email || '',
          name: p.full_name || 'Provider',
          specialty,
          rating: Number(p.rating) || 0,
          reviews: p.reviews_count || 0,
          hourlyRate: p.hourly_rate || 0,
          specializations,
          img: p.avatar_url || '',
          verified: p.is_verified || false,
          featured: p.is_featured || false,
          tier: (p.subscription_tier as string) || p.subscription?.tier || 'basic',
          location: p.location || '',
        };
      });
      setProviders(mapped);
    }).catch(() => {});
  }, []);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const openChat = (provider: ProviderDisplay) => {
    if (!executeIfAuthenticated({ action: 'message', modalData: { name: provider.name, role: provider.specialty } })) return;
    setChatProvider(provider);
    setMessages([{ id: 1, text: `Hello! I'm ${provider.name}. How can I help you today?`, sender: 'provider', timestamp: new Date() }]);
  };

  const closeChat = () => { setChatProvider(null); setMessages([]); setNewMessage(''); };

  const sendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || !chatProvider || !user?.id) return;

    const messageText = newMessage.trim();
    setNewMessage('');
    setMessages(prev => [...prev, { id: prev.length + 1, text: messageText, sender: 'user', timestamp: new Date() }]);

    try {
      const conversationId = await createConversationMessage({
        senderId: user.id,
        senderName: profile?.full_name || user.email || 'A user',
        recipientId: chatProvider.id,
        recipientName: chatProvider.name,
        recipientEmail: chatProvider.email,
        message: messageText,
      });

      if (conversationId) {
        // The message is already persisted server-side by
        // createConversationMessage, so navigating straight to the dedicated
        // thread shows the full history including this message. No sessionStorage
        // hack or full-page reload — the Messages page owns the thread and loads
        // it from the database.
        navigate(`/messages?conversationId=${encodeURIComponent(conversationId)}`, { replace: true });
      } else {
        navigate('/messages', { replace: true });
      }
    } catch (error) {
      console.error('[sendMessage] conversation save failed:', error);
      navigate('/messages', { replace: true });
    }
  };

  const matchCategory = (provider: ProviderDisplay, category: string): boolean => {
    if (category === 'All') return true;
    const keywords = SERVICE_KEYWORDS[category] || [];
    const text = `${provider.specialty} ${provider.specializations.join(' ')} ${provider.name}`.toLowerCase();
    return keywords.some((k: string) => text.includes(k));
  };

  const filteredProviders = providers.filter(p => {
    const q = searchQuery.toLowerCase();
    const matchesSearch = !q || p.name.toLowerCase().includes(q) || p.specialty.toLowerCase().includes(q) || p.specializations.some(s => s.toLowerCase().includes(q));
    return matchesSearch && matchCategory(p, selectedCategory);
  });

  const sortedProviders = [...filteredProviders].sort((a, b) => {
    if (a.featured && !b.featured) return -1;
    if (!a.featured && b.featured) return 1;
    if (a.verified && !b.verified) return -1;
    if (!a.verified && b.verified) return 1;
    return b.reviews - a.reviews;
  });

  // Structure the feed exactly as requested:
  //   1. Featured Professional (paid subscribers) — top
  //   2. Verified Professional — middle
  //   3. Everyone else (unfeatured / unverified) — last
  const featuredProviders = sortedProviders.filter(p => p.featured);
  const verifiedProviders = sortedProviders.filter(p => !p.featured && p.verified);
  const standardProviders = sortedProviders.filter(p => !p.featured && !p.verified);

  const renderStars = (rating: number) => (
    <div className="flex items-center gap-0.5">
      {Array(5).fill(null).map((_, i) => (
        <Star key={i} size={13} className={i < Math.floor(rating) ? 'fill-amber-400 text-amber-400' : 'text-gray-300'} />
      ))}
    </div>
  );

  const getInitials = (name: string) => {
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) || 'PR';
  };

  const renderProviderCard = (p: ProviderDisplay) => (
    <div
      key={p.id}
      className={`group bg-white rounded-xl border transition-all duration-200 hover:shadow-lg hover:-translate-y-0.5 overflow-hidden ${
        p.featured
          ? 'border-amber-200 shadow-sm hover:shadow-amber-100/50'
          : p.verified
          ? 'border-blue-100 shadow-sm hover:shadow-blue-100/30'
          : 'border-slate-100 shadow-sm'
      }`}
    >
      {/* Featured banner */}
      {p.featured && (
        <div className="bg-gradient-to-r from-amber-500 to-amber-600 px-4 py-2 flex items-center gap-2">
          <Sparkles className="w-3.5 h-3.5 text-white shrink-0" />
          <span className="text-white text-xs font-semibold tracking-wide">Featured Professional</span>
        </div>
      )}

      <div className="p-5">
        {/* Avatar + Name row */}
        <div className="flex items-start gap-4 mb-4">
          {p.img ? (
            <img
              src={p.img}
              alt={p.name}
              className="w-14 h-14 rounded-xl object-cover border-2 border-slate-100 shrink-0"
              onError={(e) => {
                (e.target as HTMLImageElement).style.display = 'none';
                (e.target as HTMLImageElement).nextElementSibling?.classList.remove('hidden');
              }}
            />
          ) : null}
          <div className={`${p.img ? '' : ''} ${!p.img ? 'flex items-center gap-3' : ''}`}>
            {!p.img && (
              <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-blue-600 to-indigo-600 flex items-center justify-center text-white font-bold text-lg shrink-0">
                {getInitials(p.name)}
              </div>
            )}
            <div className={p.img ? '' : ''}>
              <div className="flex items-center gap-1.5">
                <h3 className="font-bold text-slate-900 truncate text-base">{p.name}</h3>
                {p.verified && <BadgeCheck className="w-4 h-4 text-blue-600 shrink-0" />}
              </div>
              <p className="text-sm text-slate-600 mt-0.5">{p.specialty}</p>
              {p.location && (
                <p className="text-xs text-slate-400 mt-0.5 flex items-center gap-1">
                  <MapPin className="w-3 h-3" /> {p.location}
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Rating — real, live aggregate from the reviews table */}
        <div className="flex items-center gap-2 mb-3">
          {p.reviews > 0 ? (
            <>
              {renderStars(p.rating)}
              <span className="text-xs text-slate-500">
                {p.rating.toFixed(1)} ({p.reviews} {p.reviews === 1 ? 'review' : 'reviews'})
              </span>
            </>
          ) : (
            <span className="text-xs font-medium text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full">
              New — no reviews yet
            </span>
          )}
        </div>

        {/* Rate */}
        <div className="text-xl font-bold text-blue-700 mb-3">
          {p.hourlyRate > 0 ? `₦${p.hourlyRate.toLocaleString()}/hr` : 'Rate negotiable'}
        </div>

        {/* Specializations */}
        {p.specializations.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mb-4">
            {p.specializations.map(spec => (
              <span key={spec} className="text-xs bg-slate-100 text-slate-700 px-2.5 py-1 rounded-full font-medium">
                {spec}
              </span>
            ))}
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-2">
          <button
            onClick={() => openChat(p)}
            className="flex-1 flex items-center justify-center gap-1.5 bg-blue-700 hover:bg-blue-800 text-white font-semibold py-2.5 px-3 rounded-lg transition-colors text-sm"
          >
            <MessageCircle className="w-4 h-4" /> Chat
          </button>
          <button
            onClick={() => openModal('profile', {
              name: p.name,
              role: p.specialty,
              specialty: p.specialty,
              match: `${p.rating}★`,
              skills: p.specializations,
              bio: '',
              location: p.location,
              hourlyRate: p.hourlyRate,
              email: p.email,
              verified: p.verified,
              reviews: p.reviews,
            })}
            className="flex-1 border border-slate-200 text-slate-700 hover:bg-slate-50 hover:border-slate-300 font-semibold py-2.5 px-3 rounded-lg transition-colors text-sm"
          >
            View Profile
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white pb-24">
      <Header />
      <div className="max-w-6xl mx-auto px-4 py-6">

        {/* ─── Clean Hero ─── */}
        <div className="relative rounded-2xl overflow-hidden mb-8 bg-gradient-to-br from-blue-700 via-blue-600 to-indigo-700">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,_rgba(255,255,255,0.12),_transparent_50%)]" />
          <div className="relative px-6 sm:px-8 py-8 sm:py-10">
            <h1 className="text-2xl sm:text-3xl font-bold text-white mb-2">Find Trusted Service Providers</h1>
            <p className="text-blue-100 text-sm sm:text-base mb-5 max-w-xl">
              Browse our directory of verified professionals across Nigeria.
            </p>
            <div className="relative max-w-xl">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
              <input
                type="text"
                placeholder="Search by name, specialty, or skill..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="w-full pl-12 pr-4 py-3 rounded-xl bg-white/95 focus:outline-none focus:ring-2 focus:ring-blue-400 text-sm shadow-sm"
              />
            </div>
          </div>
        </div>

        {/* ─── Category Pills ─── */}
        <div className="mb-6">
          <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-thin scrollbar-thumb-gray-300">
            {categories.map(cat => (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`px-4 py-2 rounded-full whitespace-nowrap font-medium transition-all text-sm ${
                  selectedCategory === cat
                    ? 'bg-blue-700 text-white shadow-md shadow-blue-200'
                    : 'bg-white text-slate-700 border border-slate-200 hover:border-blue-300 hover:text-blue-700'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>

        {/* ─── Results Summary ─── */}
        <div className="flex items-center justify-between mb-5">
          <p className="text-sm text-slate-600">
            <span className="font-semibold text-slate-900">{sortedProviders.length}</span>{' '}
            {sortedProviders.length === 1 ? 'provider' : 'providers'} found
            {selectedCategory !== 'All' ? ` in ${selectedCategory}` : ''}
          </p>
        </div>

        {/* ─── Provider Sections (Featured → Verified → All) ─── */}
        {sortedProviders.length > 0 ? (
          <>
            {/* Featured Professionals — paid subscribers appear first */}
            {featuredProviders.length > 0 && (
              <section className="mb-10">
                <div className="flex items-center gap-2 mb-4">
                  <span className="w-8 h-8 rounded-lg bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center text-white shrink-0">
                    <Sparkles className="w-4 h-4" />
                  </span>
                  <h2 className="text-lg sm:text-xl font-bold text-slate-900">Featured Professionals</h2>
                  <span className="text-xs bg-amber-100 text-amber-700 px-2.5 py-0.5 rounded-full font-bold">{featuredProviders.length}</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
                  {featuredProviders.map(p => renderProviderCard(p))}
                </div>
              </section>
            )}

            {/* Verified Professionals — verified badge holders */}
            {verifiedProviders.length > 0 && (
              <section className="mb-10">
                <div className="flex items-center gap-2 mb-4">
                  <span className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center text-white shrink-0">
                    <BadgeCheck className="w-4 h-4" />
                  </span>
                  <h2 className="text-lg sm:text-xl font-bold text-slate-900">Verified Professionals</h2>
                  <span className="text-xs bg-blue-100 text-blue-700 px-2.5 py-0.5 rounded-full font-bold">{verifiedProviders.length}</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
                  {verifiedProviders.map(p => renderProviderCard(p))}
                </div>
              </section>
            )}

            {/* All other service providers — unpaid / unverified */}
            {standardProviders.length > 0 && (
              <section className="mb-10">
                <div className="flex items-center gap-2 mb-4">
                  <span className="w-8 h-8 rounded-lg bg-slate-200 flex items-center justify-center text-slate-600 shrink-0">
                    <Users className="w-4 h-4" />
                  </span>
                  <h2 className="text-lg sm:text-xl font-bold text-slate-900">All Service Providers</h2>
                  <span className="text-xs bg-slate-100 text-slate-600 px-2.5 py-0.5 rounded-full font-bold">{standardProviders.length}</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
                  {standardProviders.map(p => renderProviderCard(p))}
                </div>
              </section>
            )}
          </>
        ) : (
          /* ─── Empty State ─── */
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-6 text-center mb-10">
            <p className="text-amber-800 font-semibold mb-1">No providers found</p>
            <p className="text-amber-700 text-sm">
              {searchQuery
                ? 'Try a different search term or category.'
                : 'No providers are currently listed in this category.'}
            </p>
          </div>
        )}

        {/* ─── Service Directory (Collapsible) ─── */}
        <div className="mb-10 bg-white rounded-xl border border-slate-200 overflow-hidden">
          <button
            onClick={() => setShowDirectory(!showDirectory)}
            className="w-full flex items-center justify-between px-5 py-4 hover:bg-slate-50 transition-colors"
          >
            <div className="text-left">
              <h2 className="font-bold text-slate-900">Service Directory</h2>
              <p className="text-xs text-slate-500 mt-0.5">Browse all service categories to find what you need</p>
            </div>
            {showDirectory ? (
              <ChevronUp className="w-5 h-5 text-slate-400 shrink-0" />
            ) : (
              <ChevronDown className="w-5 h-5 text-slate-400 shrink-0" />
            )}
          </button>

          {showDirectory && (
            <div className="px-5 pb-5 border-t border-slate-100 pt-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {categoryList.map(cat => (
                  <button
                    key={cat}
                    onClick={() => {
                      setSelectedCategory(cat);
                      setShowDirectory(false);
                    }}
                    className={`flex items-center justify-between px-4 py-3 rounded-lg border transition-colors text-left ${
                      selectedCategory === cat
                        ? 'bg-blue-50 border-blue-200 text-blue-700'
                        : 'bg-slate-50 border-slate-100 hover:border-blue-200 hover:bg-blue-50/50 text-slate-700'
                    }`}
                  >
                    <span className="text-sm font-medium">{cat}</span>
                    <ArrowRight className="w-4 h-4 shrink-0 opacity-50" />
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* ─── Become a Provider CTA ─── */}
        <div className="bg-gradient-to-br from-emerald-600 to-emerald-700 rounded-xl overflow-hidden">
          <div className="px-6 sm:px-8 py-8">
            <div className="max-w-2xl">
              <h2 className="text-xl sm:text-2xl font-bold text-white mb-2">Become a Service Provider</h2>
              <p className="text-emerald-100 text-sm sm:text-base mb-6">
                Join thousands of professionals offering services on JobBridge. Get clients, build your reputation, and grow your business.
              </p>
              <div className="flex flex-wrap gap-3 mb-6">
                <div className="bg-white/10 backdrop-blur rounded-xl px-5 py-4 flex-1 min-w-[200px]">
                  <div className="font-semibold text-white mb-1">Monthly Listing</div>
                  <div className="text-emerald-200 text-sm mb-2">FREE at launch</div>
                  <ul className="text-xs text-emerald-200 space-y-1">
                    <li className="flex items-center gap-1.5"><span className="text-emerald-300">•</span> Profile on JobBridge</li>
                    <li className="flex items-center gap-1.5"><span className="text-emerald-300">•</span> Contact information</li>
                    <li className="flex items-center gap-1.5"><span className="text-emerald-300">•</span> Receive inquiries</li>
                  </ul>
                </div>
                <div className="bg-white/10 backdrop-blur rounded-xl px-5 py-4 flex-1 min-w-[200px]">
                  <div className="font-semibold text-white mb-1">Featured Professional</div>
                  <div className="text-emerald-200 text-sm mb-2">₦5,000/month</div>
                  <ul className="text-xs text-emerald-200 space-y-1">
                    <li className="flex items-center gap-1.5"><span className="text-emerald-300">•</span> Top of search results</li>
                    <li className="flex items-center gap-1.5"><span className="text-emerald-300">•</span> Featured badge</li>
                    <li className="flex items-center gap-1.5"><span className="text-emerald-300">•</span> Priority support</li>
                  </ul>
                </div>
              </div>
              <Link
                to="/pricing#services"
                className="inline-flex items-center gap-2 bg-white text-emerald-700 hover:bg-emerald-50 font-bold py-3 px-6 rounded-xl transition-colors text-sm"
              >
                View Pricing Plans <ArrowRight size={18} />
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* ─── Chat Modal ─── */}
      {chatProvider && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-slate-950/40 backdrop-blur-sm">
          <div className="w-full max-w-md bg-white rounded-t-2xl sm:rounded-2xl shadow-2xl flex flex-col max-h-[80vh]">
            <div className="flex items-center gap-3 p-4 border-b shrink-0">
              {chatProvider.img ? (
                <img src={chatProvider.img} alt={chatProvider.name} className="w-10 h-10 rounded-xl object-cover border-2 border-slate-100" />
              ) : (
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-600 to-indigo-600 flex items-center justify-center text-white font-bold text-sm">
                  {getInitials(chatProvider.name)}
                </div>
              )}
              <div className="flex-1 min-w-0">
                <h3 className="font-bold text-slate-900 truncate">{chatProvider.name}</h3>
                <p className="text-xs text-slate-500">{chatProvider.specialty}</p>
              </div>
              <button onClick={closeChat} className="p-2 hover:bg-slate-100 rounded-lg transition-colors shrink-0">
                <X className="w-5 h-5 text-slate-500" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {messages.map(msg => (
                <div key={msg.id} className={`flex ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[80%] px-4 py-2.5 rounded-2xl ${
                    msg.sender === 'user'
                      ? 'bg-blue-700 text-white rounded-br-md'
                      : 'bg-slate-100 text-slate-900 rounded-bl-md'
                  }`}>
                    <p className="text-sm">{msg.text}</p>
                    <p className={`text-xs mt-1 ${msg.sender === 'user' ? 'text-blue-200' : 'text-slate-400'}`}>
                      {msg.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>
                </div>
              ))}
              <div ref={messagesEndRef} />
            </div>
            <form onSubmit={sendMessage} className="p-4 border-t shrink-0">
              <div className="flex gap-2">
                <input
                  type="text"
                  value={newMessage}
                  onChange={e => setNewMessage(e.target.value)}
                  placeholder="Type your message..."
                  className="flex-1 px-4 py-2.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                />
                <button
                  type="submit"
                  disabled={!newMessage.trim()}
                  className="p-2.5 bg-blue-700 text-white rounded-xl hover:bg-blue-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Send className="w-5 h-5" />
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <BottomNav />
    </div>
  );
}
