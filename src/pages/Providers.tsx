import React, { useState, useRef, useEffect } from 'react';
import { Link } from 'react-router-dom';
import Header from '../components/Header';
import BottomNav from '../components/BottomNav';
import { useModal } from '../contexts/ModalContext';
import { useAuthRequired } from '../hooks/useAuthRequired';
import { useAuth } from '../contexts/AuthContext';
import { fetchProviders, createConversationMessage } from '../lib/supabaseQueries';
import type { Profile } from '../lib/supabase';
import { Search, ChevronLeft, ChevronRight, Star, ArrowRight, MessageCircle, Send, X, BadgeCheck, Sparkles } from 'lucide-react';
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
  bgColor: string;
  verified: boolean;
  featured: boolean;
  tier: string;
}

const BG_COLORS = [
  'bg-blue-600', 'bg-emerald-600', 'bg-amber-600', 'bg-rose-600',
  'bg-cyan-600', 'bg-indigo-600', 'bg-sky-600', 'bg-slate-600',
  'bg-purple-600', 'bg-green-700', 'bg-teal-600', 'bg-orange-600',
];

function getBgColor(id: string) {
  let hash = 0;
  for (let i = 0; i < id.length; i++) hash = id.charCodeAt(i) + ((hash << 5) - hash);
  return BG_COLORS[Math.abs(hash) % BG_COLORS.length];
}

const categoryList: string[] = [
  'Technology', 'Creative & Media', 'Business & Administration',
  'Sales & Marketing', 'Engineering & Construction', 'Skilled Trades',
  'Beauty & Fashion', 'Food & Hospitality', 'Health & Wellness',
  'Education', 'Transportation & Logistics', 'Home & Property Services',
  'Professional Services', 'Events & Entertainment', 'Agriculture',
  'Cleaning & Maintenance',
];

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

// ALL services from both lists combined, organized by categories
const ALL_SERVICES: Record<string, string[]> = {
  'Technology': [
    'Software Developer', 'Web Developer', 'UI/UX Designer',
    'Graphic Designer', 'Data Analyst', 'Data Scientist',
    'Virtual Assistant', 'Customer Support Representative',
    'Phone Repair', 'Computer Repair',
    'Software Development Company', 'Web Design Agency',
  ],
  'Creative & Media': [
    'Graphic Designer', 'Video Editor', 'Photographer', 'Content Creator',
    'Social Media Manager', 'Digital Marketer', 'Copywriter',
    'Musician', 'Saxophonist', 'DJ',
    'Photography Studio', 'Videography Services', 'Printing & Branding',
    'Digital Marketing Agency',
  ],
  'Business & Administration': [
    'Administrative Assistant', 'Project Manager', 'Human Resources (HR) Officer',
    'Business Development Officer', 'Accountant', 'Virtual Assistant',
    'Customer Support Representative', 'Accounting & Tax Services',
    'Sales Executive',
  ],
  'Sales & Marketing': [
    'Sales Executive', 'Digital Marketer', 'Social Media Manager',
    'Content Creator', 'Copywriter', 'Digital Marketing Agency',
    'Business Development Officer',
  ],
  'Engineering & Construction': [
    'Civil Engineer', 'Mechanical Engineer', 'Electrical Engineer',
    'Architect', 'Quantity Surveyor', 'Mason',
    'Building & Construction', 'Interior Design', 'Furniture Making',
    'Landscaping & Gardening', 'Welder',
  ],
  'Skilled Trades': [
    'Electrician', 'Plumber', 'Carpenter', 'Welder', 'Mason', 'Painter',
    'Panel Beater', 'Panel Beaters', 'Generator Repairer', 'Generator Repairers',
    'AC Installer', 'AC Installers', 'Borehole Driller', 'Borehole Drillers',
    'Auto Mechanic Workshop', 'Appliance Repair',
    'Electrical Services', 'Plumbing Services', 'Painting Services',
    'Generator Repair', 'Painters', 'Mechanics',
  ],
  'Beauty & Fashion': [
    'Barber', 'Hair Stylist', 'Makeup Artist', 'Nail Tech',
    'Fashion Designer', 'Tailor',
    'Beauty Salon', 'Barbing Salon', 'Spa & Wellness',
    'Fashion House', 'Tailoring Services',
  ],
  'Food & Hospitality': [
    'Chef', 'Baker', 'Caterer',
    'Catering Services', 'Waiter', 'Restaurant Staff',
  ],
  'Health & Wellness': [
    'Nurse', 'Doctor', 'Pharmacist',
    'Medical Clinic', 'Pharmacy',
    'Fitness Trainer', 'Spa & Wellness',
  ],
  'Education': [
    'Teacher', 'Tutor', 'Private Tutor', 'Private Tutors',
    'Translator', 'Training & Coaching', 'Language Instructor',
  ],
  'Transportation & Logistics': [
    'Driver', 'Dispatcher/Rider',
    'Courier Services', 'Logistics & Delivery',
    'Car Rental', 'Travel & Tours', 'Bike Rider',
    'Translation Services',
  ],
  'Home & Property Services': [
    'Cleaner', 'Sofa Cleaners', 'Dry Cleaners', 'Dry cleaners',
    'Laundry & Dry Cleaning', 'Pest Control',
    'Landscaping & Gardening', 'Painting Services',
    'Plumber', 'Electrician', 'Carpenter',
    'Real Estate Agency', 'Real Estate Agent',
    'Equipment & Tool Rental', 'Cleaning Equipment Rental',
  ],
  'Professional Services': [
    'Lawyer', 'Accountant', 'Security Guard',
    'Visa & Immigration Consulting', 'Translator', 'Translation Services',
    'Printing Press', 'Coworking Space',
    'Legal Services', 'Accounting & Tax Services',
    'Security Services', 'Real Estate Agency',
  ],
  'Events & Entertainment': [
    'DJ', 'Musician', 'Saxophonist', 'MC/Compere',
    'Event Planner', 'Event Planning',
    'Photographer', 'Photography Studio', 'Videography Services',
  ],
  'Agriculture': [
    'Agriculture & Farm Services', 'Poultry Farming', 'Fishery',
    'Crop Farming', 'Livestock',
  ],
  'Cleaning & Maintenance': [
    'Cleaner', 'Cleaning Services',
    'Sofa Cleaners', 'Dry Cleaners', 'Dry cleaners',
    'Laundry & Dry Cleaning', 'Pest Control',
    'Cleaning Equipment Rental', 'Equipment & Tool Rental',
    'Waste Management', 'Car Wash & Auto Detailing',
    'Janitorial Services',
  ],
};

const categories = ['All', ...categoryList];

export default function Providers() {
  const { openModal } = useModal();
  const { openProtectedModal, executeIfAuthenticated } = useAuthRequired();
  const { user, profile } = useAuth();
  const [providers, setProviders] = useState<ProviderDisplay[]>([]);
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [chatProvider, setChatProvider] = useState<ProviderDisplay | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

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
          rating: 4.8,
          reviews: p.reviews_count || 0,
          hourlyRate: p.hourly_rate || 0,
          specializations,
          img: p.avatar_url || 'https://images.pexels.com/photos/220453/pexels-photo-220453.jpeg?auto=compress&cs=tinysrgb&w=100&h=100&dpr=2&fit=crop&crop=face',
          bgColor: getBgColor(p.id),
          verified: p.is_verified || false,
          featured: p.is_featured || false,
          tier: (p.subscription_tier as string) || p.subscription?.tier || 'basic',
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
      await createConversationMessage({
        senderId: user.id,
        senderName: profile?.full_name || user.email || 'A user',
        recipientId: chatProvider.id,
        recipientName: chatProvider.name,
        recipientEmail: chatProvider.email,
        message: messageText,
      });
    } catch (error) {
      console.error('[sendMessage] conversation save failed:', error);
    }
  };

  const scroll = (direction: 'left' | 'right') => {
    if (scrollRef.current) {
      scrollRef.current.scrollBy({ left: direction === 'left' ? -300 : 300, behavior: 'smooth' });
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

  const featuredProviders = sortedProviders.filter(p => p.featured);
  const verifiedProviders = sortedProviders.filter(p => p.verified && !p.featured);
  const basicProviders = sortedProviders.filter(p => !p.verified);

  const renderStars = (rating: number) => (
    <div className="flex items-center gap-0.5">
      {Array(5).fill(null).map((_, i) => (
        <Star key={i} size={14} className={i < Math.floor(rating) ? 'fill-amber-400 text-amber-400' : 'text-gray-300'} />
      ))}
    </div>
  );

  const ProviderCard = ({ provider }: { provider: ProviderDisplay }) => (
    <div className={`bg-white rounded-xl shadow-sm hover:shadow-md transition-all overflow-hidden border ${provider.featured ? 'border-amber-200 ring-1 ring-amber-200' : provider.verified ? 'border-blue-100' : 'border-gray-100'}`}>
      {provider.featured && (
        <div className="bg-gradient-to-r from-amber-500 to-amber-600 text-white text-xs font-semibold px-3 py-1.5 flex items-center justify-center gap-1.5">
          <Sparkles className="w-3.5 h-3.5" /> Featured Professional
        </div>
      )}
      <div className="p-5">
        <div className="flex items-start gap-3 mb-3">
          <img src={provider.img} alt={provider.name} className="w-11 h-11 rounded-xl object-cover border-2 border-gray-100 shrink-0" />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5">
              <h3 className="font-bold text-gray-900 truncate">{provider.name}</h3>
              {provider.verified && <BadgeCheck className="w-4 h-4 text-blue-600 shrink-0" />}
            </div>
            <div className="flex flex-wrap items-center gap-2 mt-1 text-xs">
              <span className="text-sm text-gray-600">{provider.specialty}</span>
              <span className="rounded-full bg-gray-100 text-gray-600 px-2 py-0.5">{provider.tier}</span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2 mb-3">
          {renderStars(provider.rating)}
          <span className="text-xs text-gray-500">({provider.reviews} reviews)</span>
        </div>
        <div className="text-lg font-bold text-blue-700 mb-3">
          {provider.hourlyRate > 0 ? `₦${provider.hourlyRate.toLocaleString()}/hr` : 'Rate negotiable'}
        </div>
        <div className="flex flex-wrap gap-1.5 mb-4">
          {provider.specializations.slice(0, 3).map(spec => (
            <span key={spec} className="text-xs bg-gray-100 text-gray-700 px-2 py-1 rounded-full">{spec}</span>
          ))}
        </div>
        <div className="flex gap-2">
          <button onClick={() => openChat(provider)} className="flex-1 flex items-center justify-center gap-1.5 bg-blue-700 hover:bg-blue-800 text-white font-medium py-2.5 px-3 rounded-lg transition-colors text-sm">
            <MessageCircle className="w-4 h-4" /> Chat
          </button>
          <button onClick={() => openModal('profile', {
            name: provider.name,
            role: provider.specialty,
            specialty: provider.specialty,
            match: `${provider.rating}★`,
            skills: provider.specializations,
            bio: '',
            location: '',
            hourlyRate: provider.hourlyRate,
            email: provider.email,
            verified: provider.verified,
            reviews: provider.reviews,
          })} className="flex-1 border border-gray-300 text-gray-700 hover:bg-gray-50 font-medium py-2.5 px-3 rounded-lg transition-colors text-sm">
            View Profile
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-50 pb-24">
      <Header />
      <div className="max-w-6xl mx-auto px-4 py-6">
        {/* Hero Search */}
        <div className="relative rounded-2xl shadow-lg overflow-hidden mb-6">
          <FloatingDecorations className="opacity-70" />
          <img src={IMG.hero.providers} alt="" className="absolute inset-0 w-full h-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-r from-blue-900/90 via-blue-800/80 to-blue-700/70" />
          <div className="relative p-6 sm:p-8">
            <h1 className="text-2xl sm:text-3xl font-bold text-white mb-2">Find Trusted Service Providers</h1>
            <p className="text-blue-100 mb-4 text-sm max-w-xl">Looking for a graphic designer? A photographer? Any professional? Find them here.</p>
            <div className="relative max-w-xl">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
              <input type="text" placeholder="Search by name, specialty, or skill..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} className="w-full pl-12 pr-4 py-3 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
          </div>
        </div>

        {/* Category Pills */}
        <div className="mb-6">
          <div className="flex gap-2 overflow-x-auto pb-2 hide-scrollbar">
            {categories.map(cat => (
              <button key={cat} onClick={() => setSelectedCategory(cat)} className={`px-4 py-2 rounded-full whitespace-nowrap font-medium transition-colors text-sm ${selectedCategory === cat ? 'bg-blue-700 text-white' : 'bg-white text-gray-700 border border-gray-200 hover:border-blue-300'}`}>
                {cat}
              </button>
            ))}
          </div>
        </div>

        {/* Legend */}
        <div className="flex flex-wrap gap-4 mb-6 text-xs text-gray-600">
          <div className="flex items-center gap-1.5"><Sparkles className="w-3.5 h-3.5 text-amber-500" /><span>Featured - ₦5,000/mo</span></div>
          <div className="flex items-center gap-1.5"><BadgeCheck className="w-3.5 h-3.5 text-blue-600" /><span>Verified - ₦3,000/mo</span></div>
          <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded bg-gray-300" /><span>Basic - FREE at launch</span></div>
        </div>

        {/* Featured Providers */}
        {featuredProviders.length > 0 && (
          <div className="mb-8">
            <div className="flex items-center gap-2 mb-4">
              <Sparkles className="w-5 h-5 text-amber-500" />
              <h2 className="text-xl font-bold text-gray-900">Featured Professionals</h2>
              <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full">Top visibility</span>
            </div>
            <div className="relative">
              <button onClick={() => scroll('left')} className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-3 z-10 bg-white rounded-full p-2 shadow-md hover:shadow-lg transition-shadow"><ChevronLeft size={18} className="text-gray-600" /></button>
              <button onClick={() => scroll('right')} className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-3 z-10 bg-white rounded-full p-2 shadow-md hover:shadow-lg transition-shadow"><ChevronRight size={18} className="text-gray-600" /></button>
              <div ref={scrollRef} className="overflow-x-auto scroll-smooth hide-scrollbar">
                <div className="flex gap-4 pb-2">
                  {featuredProviders.map(p => (
                    <div key={p.id} className="w-72 shrink-0"><ProviderCard provider={p} /></div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* All Providers Grid */}
        <div className="mb-10">
          <h2 className="text-xl font-bold text-gray-900 mb-4">
            {selectedCategory === 'All' ? 'All Service Providers' : `Service Providers in ${selectedCategory}`}
          </h2>
          {sortedProviders.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {sortedProviders.map(p => <ProviderCard key={p.id} provider={p} />)}
            </div>
          ) : null}
        </div>

        {/* Browse All Services Directory - shown regardless of provider count */}
        <div className="mb-10">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-bold text-gray-900">Browse All Services</h2>
            <p className="text-sm text-gray-500">Find professionals for any service</p>
          </div>

          {selectedCategory === 'All' ? (
            /* Show all categories in a grid */
            <div className="space-y-8">
              {categoryList.map(cat => {
                const services = ALL_SERVICES[cat] || [];
                return (
                  <div key={cat} className="bg-white rounded-xl border border-gray-100 overflow-hidden">
                    <div className="bg-gradient-to-r from-blue-700 to-blue-600 px-5 py-3">
                      <h3 className="font-bold text-white text-lg">{cat}</h3>
                      <p className="text-blue-200 text-xs mt-0.5">{services.length} services available</p>
                    </div>
                    <div className="p-4">
                      <div className="flex flex-wrap gap-2">
                        {services.map(service => (
                          <button
                            key={service}
                            onClick={() => {
                              setSearchQuery(service);
                              setSelectedCategory(cat);
                              window.scrollTo({ top: 0, behavior: 'smooth' });
                            }}
                            className="px-3.5 py-2 bg-gray-50 hover:bg-blue-50 hover:text-blue-700 hover:border-blue-200 border border-gray-200 rounded-lg text-sm text-gray-700 transition-colors font-medium"
                          >
                            {service}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            /* Show services only for selected category */
            <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
              <div className="bg-gradient-to-r from-blue-700 to-blue-600 px-5 py-3">
                <h3 className="font-bold text-white text-lg">{selectedCategory}</h3>
                <p className="text-blue-200 text-xs mt-0.5">{(ALL_SERVICES[selectedCategory] || []).length} services available</p>
              </div>
              <div className="p-4">
                <div className="flex flex-wrap gap-2">
                  {(ALL_SERVICES[selectedCategory] || []).map(service => (
                    <button
                      key={service}
                      onClick={() => {
                        setSearchQuery(service);
                        window.scrollTo({ top: 0, behavior: 'smooth' });
                      }}
                      className="px-3.5 py-2 bg-gray-50 hover:bg-blue-50 hover:text-blue-700 hover:border-blue-200 border border-gray-200 rounded-lg text-sm text-gray-700 transition-colors font-medium"
                    >
                      {service}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {sortedProviders.length === 0 && (
            <div className="mt-6 bg-amber-50 border border-amber-200 rounded-xl p-5 text-center">
              <p className="text-amber-800 font-medium mb-2">No providers listed in this category yet</p>
              <p className="text-amber-700 text-sm">If you're a professional, <Link to="/pricing#services" className="text-blue-700 hover:underline font-semibold">become a provider</Link> and get listed here.</p>
            </div>
          )}
        </div>

        {/* Become a Provider CTA */}
        <div className="bg-gradient-to-r from-emerald-600 to-emerald-700 rounded-2xl shadow-lg p-8">
          <div className="max-w-2xl">
            <h2 className="text-2xl font-bold text-white mb-2">Become a Service Provider</h2>
            <p className="text-emerald-100 mb-6">Join thousands of professionals offering services on JobBridge. Get clients, build your reputation, and grow your business.</p>
            <div className="grid sm:grid-cols-2 gap-3 mb-6">
              <div className="bg-white/10 backdrop-blur rounded-xl p-4">
                <div className="font-bold text-white mb-1">Monthly Listing</div>
                <div className="text-emerald-100 text-sm mb-1">FREE at launch</div>
                <ul className="text-xs text-emerald-200 space-y-1"><li>• Profile on JobBridge</li><li>• Contact information</li><li>• Receive inquiries</li></ul>
              </div>
              <div className="bg-white/10 backdrop-blur rounded-xl p-4">
                <div className="font-bold text-white mb-1">Featured Professional</div>
                <div className="text-emerald-100 text-sm mb-1">₦5,000/month</div>
                <ul className="text-xs text-emerald-200 space-y-1"><li>• Top of search results</li><li>• Featured on homepage</li><li>• Social media promotion</li></ul>
              </div>
            </div>
              <Link to="/pricing#services" className="inline-flex items-center gap-2 bg-white text-emerald-700 hover:bg-emerald-50 font-bold py-3 px-6 rounded-xl transition-colors">
              View Pricing Plans <ArrowRight size={18} />
            </Link>
          </div>
        </div>
      </div>

      {/* Chat Modal */}
      {chatProvider && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/50">
          <div className="w-full max-w-md bg-white rounded-t-2xl sm:rounded-2xl shadow-2xl flex flex-col max-h-[80vh]">
            <div className="flex items-center gap-3 p-4 border-b shrink-0">
              <img src={chatProvider.img} alt={chatProvider.name} className="w-10 h-10 rounded-xl object-cover border-2 border-gray-100" />
              <div className="flex-1">
                <h3 className="font-bold text-gray-900">{chatProvider.name}</h3>
                <p className="text-xs text-gray-500">{chatProvider.specialty}</p>
              </div>
              <button onClick={closeChat} className="p-2 hover:bg-gray-100 rounded-lg transition-colors"><X className="w-5 h-5 text-gray-500" /></button>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {messages.map(msg => (
                <div key={msg.id} className={`flex ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[80%] px-4 py-2.5 rounded-2xl ${msg.sender === 'user' ? 'bg-blue-700 text-white rounded-br-md' : 'bg-gray-100 text-gray-900 rounded-bl-md'}`}>
                    <p className="text-sm">{msg.text}</p>
                    <p className={`text-xs mt-1 ${msg.sender === 'user' ? 'text-blue-200' : 'text-gray-400'}`}>{msg.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
                  </div>
                </div>
              ))}
              <div ref={messagesEndRef} />
            </div>
            <form onSubmit={sendMessage} className="p-4 border-t shrink-0">
              <div className="flex gap-2">
                <input type="text" value={newMessage} onChange={e => setNewMessage(e.target.value)} placeholder="Type your message..." className="flex-1 px-4 py-2.5 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm" />
                <button type="submit" disabled={!newMessage.trim()} className="p-2.5 bg-blue-700 text-white rounded-xl hover:bg-blue-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"><Send className="w-5 h-5" /></button>
              </div>
            </form>
          </div>
        </div>
      )}

      <BottomNav />
    </div>
  );
}
