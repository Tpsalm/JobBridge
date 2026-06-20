import React, { useState, useRef, useEffect } from 'react';
import { Link } from 'react-router-dom';
import Header from '../components/Header';
import BottomNav from '../components/BottomNav';
import { useModal } from '../contexts/ModalContext';
import { useAuthRequired } from '../hooks/useAuthRequired';
import { Search, ChevronLeft, ChevronRight, Star, ArrowRight, MessageCircle, Send, X, Check, BadgeCheck, Sparkles } from 'lucide-react';
import { IMG } from '../lib/media';

interface Message {
  id: number;
  text: string;
  sender: 'user' | 'provider';
  timestamp: Date;
}

interface Provider {
  id: number;
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
  tier: 'basic' | 'verified' | 'featured';
}

const providers: Provider[] = [
  {
    id: 1,
    name: 'Tunde Designs',
    specialty: 'Graphic Designer',
    rating: 4.9,
    reviews: 247,
    hourlyRate: 5000,
    specializations: ['Logo Design', 'Branding', 'Print Design'],
    img: 'https://images.pexels.com/photos/220453/pexels-photo-220453.jpeg?auto=compress&cs=tinysrgb&w=100&h=100&dpr=2&fit=crop&crop=face',
    bgColor: 'bg-blue-600',
    verified: true,
    featured: true,
    tier: 'featured',
  },
  {
    id: 2,
    name: 'Creative Hub',
    specialty: 'Web Development',
    rating: 4.8,
    reviews: 189,
    hourlyRate: 8000,
    specializations: ['React', 'Node.js', 'UI Design'],
    img: 'https://images.pexels.com/photos/1121796/pexels-photo-1121796.jpeg?auto=compress&cs=tinysrgb&w=100&h=100&dpr=2&fit=crop&crop=face',
    bgColor: 'bg-emerald-600',
    verified: true,
    featured: true,
    tier: 'featured',
  },
  {
    id: 3,
    name: 'John Graphics',
    specialty: 'UI/UX Designer',
    rating: 4.9,
    reviews: 156,
    hourlyRate: 6000,
    specializations: ['Figma', 'Prototyping', 'User Research'],
    img: 'https://images.pexels.com/photos/1933873/pexels-photo-1933873.jpeg?auto=compress&cs=tinysrgb&w=100&h=100&dpr=2&fit=crop&crop=face',
    bgColor: 'bg-amber-600',
    verified: true,
    featured: false,
    tier: 'verified',
  },
  {
    id: 4,
    name: 'Sarah Photography',
    specialty: 'Photographer',
    rating: 4.7,
    reviews: 203,
    hourlyRate: 10000,
    specializations: ['Events', 'Portraits', 'Product Shots'],
    img: 'https://images.pexels.com/photos/1239291/pexels-photo-1239291.jpeg?auto=compress&cs=tinysrgb&w=100&h=100&dpr=2&fit=crop&crop=face',
    bgColor: 'bg-rose-600',
    verified: true,
    featured: false,
    tier: 'verified',
  },
  {
    id: 5,
    name: 'Emmanuel Writes',
    specialty: 'Content Writer',
    rating: 4.8,
    reviews: 172,
    hourlyRate: 3000,
    specializations: ['SEO Content', 'Copywriting', 'Blog Posts'],
    img: 'https://images.pexels.com/photos/774909/pexels-photo-774909.jpeg?auto=compress&cs=tinysrgb&w=100&h=100&dpr=2&fit=crop&crop=face',
    bgColor: 'bg-cyan-600',
    verified: false,
    featured: false,
    tier: 'basic',
  },
  {
    id: 6,
    name: 'Ada Consults',
    specialty: 'Business Consultant',
    rating: 4.6,
    reviews: 134,
    hourlyRate: 15000,
    specializations: ['Strategy', 'Business Plans', 'Growth'],
    img: 'https://images.pexels.com/photos/1845534/pexels-photo-1845534.jpeg?auto=compress&cs=tinysrgb&w=100&h=100&dpr=2&fit=crop&crop=face',
    bgColor: 'bg-indigo-600',
    verified: false,
    featured: false,
    tier: 'basic',
  },
  {
    id: 7,
    name: 'Chidi Dev',
    specialty: 'Mobile Developer',
    rating: 4.9,
    reviews: 198,
    hourlyRate: 12000,
    specializations: ['Flutter', 'React Native', 'iOS'],
    img: 'https://images.pexels.com/photos/1681010/pexels-photo-1681010.jpeg?auto=compress&cs=tinysrgb&w=100&h=100&dpr=2&fit=crop&crop=face',
    bgColor: 'bg-sky-600',
    verified: true,
    featured: false,
    tier: 'verified',
  },
  {
    id: 8,
    name: 'Fatima Legal',
    specialty: 'Legal Consultant',
    rating: 4.8,
    reviews: 121,
    hourlyRate: 20000,
    specializations: ['Contract Law', 'IP Rights', 'Corporate'],
    img: 'https://images.pexels.com/photos/415829/pexels-photo-415829.jpeg?auto=compress&cs=tinysrgb&w=100&h=100&dpr=2&fit=crop&crop=face',
    bgColor: 'bg-slate-600',
    verified: true,
    featured: false,
    tier: 'verified',
  },
];

const categories = [
  'All',
  'Design',
  'Development',
  'Marketing',
  'Finance',
  'Legal',
  'Photography',
  'Consulting',
];

export default function Providers() {
  const { openModal } = useModal();
  const { openProtectedModal, executeIfAuthenticated } = useAuthRequired();
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [chatProvider, setChatProvider] = useState<Provider | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const openChat = (provider: Provider) => {
    if (!executeIfAuthenticated({ action: 'message', modalData: { name: provider.name, role: provider.specialty } })) {
      return;
    }
    setChatProvider(provider);
    setMessages([
      {
        id: 1,
        text: `Hello! I'm ${provider.name}. How can I help you today?`,
        sender: 'provider',
        timestamp: new Date(),
      },
    ]);
  };

  const closeChat = () => {
    setChatProvider(null);
    setMessages([]);
    setNewMessage('');
  };

  const sendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || !chatProvider) return;

    const userMessage: Message = {
      id: messages.length + 1,
      text: newMessage,
      sender: 'user',
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setNewMessage('');

    // Simulate provider response
    setTimeout(() => {
      const responses = [
        "Thank you for your message! I'd be happy to discuss your project requirements.",
        "That sounds interesting! Let me know more details about what you need.",
        "I'm available to start working on your project. What timeline are you looking at?",
        "Great question! I can definitely help with that. Would you like to schedule a consultation?",
      ];
      const randomResponse = responses[Math.floor(Math.random() * responses.length)];

      const providerMessage: Message = {
        id: messages.length + 2,
        text: randomResponse,
        sender: 'provider',
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, providerMessage]);
    }, 1000);
  };

  const scroll = (direction: 'left' | 'right') => {
    if (scrollRef.current) {
      const scrollAmount = 300;
      scrollRef.current.scrollBy({
        left: direction === 'left' ? -scrollAmount : scrollAmount,
        behavior: 'smooth',
      });
    }
  };

  const filteredProviders = providers.filter((provider) => {
    const matchesSearch =
      provider.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      provider.specialty.toLowerCase().includes(searchQuery.toLowerCase()) ||
      provider.specializations.some(s => s.toLowerCase().includes(searchQuery.toLowerCase()));
    const matchesCategory = selectedCategory === 'All';
    return matchesSearch && matchesCategory;
  });

  // Sort: featured first, then verified, then basic
  const sortedProviders = [...filteredProviders].sort((a, b) => {
    if (a.featured && !b.featured) return -1;
    if (!a.featured && b.featured) return 1;
    if (a.verified && !b.verified) return -1;
    if (!a.verified && b.verified) return 1;
    return 0;
  });

  const renderStars = (rating: number) => {
    return (
      <div className="flex items-center gap-0.5">
        {Array(5)
          .fill(null)
          .map((_, i) => (
            <Star
              key={i}
              size={14}
              className={
                i < Math.floor(rating) ? 'fill-amber-400 text-amber-400' : 'text-gray-300'
              }
            />
          ))}
      </div>
    );
  };

  const ProviderCard = ({ provider }: { provider: Provider }) => (
    <div className={`bg-white rounded-xl shadow-sm hover:shadow-md transition-all overflow-hidden border ${provider.featured ? 'border-amber-200 ring-1 ring-amber-200' : provider.verified ? 'border-blue-100' : 'border-gray-100'}`}>
      {provider.featured && (
        <div className="bg-gradient-to-r from-amber-500 to-amber-600 text-white text-xs font-semibold px-3 py-1.5 flex items-center justify-center gap-1.5">
          <Sparkles className="w-3.5 h-3.5" />
          Featured Professional
        </div>
      )}
      <div className="p-5">
        <div className="flex items-start gap-3 mb-3">
          <img
            src={provider.img}
            alt={provider.name}
            className="w-11 h-11 rounded-xl object-cover border-2 border-gray-100 shrink-0"
          />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5">
              <h3 className="font-bold text-gray-900 truncate">{provider.name}</h3>
              {provider.verified && (
                <BadgeCheck className="w-4 h-4 text-blue-600 shrink-0" />
              )}
            </div>
            <p className="text-sm text-gray-600">{provider.specialty}</p>
          </div>
        </div>

        <div className="flex items-center gap-2 mb-3">
          {renderStars(provider.rating)}
          <span className="text-xs text-gray-500">({provider.reviews} reviews)</span>
        </div>

        <div className="text-lg font-bold text-blue-700 mb-3">
          ₦{provider.hourlyRate.toLocaleString()}/hr
        </div>

        <div className="flex flex-wrap gap-1.5 mb-4">
          {provider.specializations.slice(0, 3).map((spec) => (
            <span
              key={spec}
              className="text-xs bg-gray-100 text-gray-700 px-2 py-1 rounded-full"
            >
              {spec}
            </span>
          ))}
        </div>

        <div className="flex gap-2">
          <button
            onClick={() => openChat(provider)}
            className="flex-1 flex items-center justify-center gap-1.5 bg-blue-700 hover:bg-blue-800 text-white font-medium py-2.5 px-3 rounded-lg transition-colors text-sm"
          >
            <MessageCircle className="w-4 h-4" />
            Chat
          </button>
          <button
            onClick={() => openModal('profile', {
              name: provider.name,
              role: provider.specialty,
              match: `${provider.rating}★`,
            })}
            className="flex-1 border border-gray-300 text-gray-700 hover:bg-gray-50 font-medium py-2.5 px-3 rounded-lg transition-colors text-sm"
          >
            View Profile
          </button>
        </div>
      </div>
    </div>
  );

  const featuredProviders = sortedProviders.filter(p => p.featured);
  const verifiedProviders = sortedProviders.filter(p => p.verified && !p.featured);
  const basicProviders = sortedProviders.filter(p => !p.verified);

  return (
    <div className="min-h-screen bg-gray-50 pb-24">
      <Header />

      <div className="max-w-6xl mx-auto px-4 py-6">
        {/* Hero Search */}
        <div className="relative rounded-2xl shadow-lg overflow-hidden mb-6">
          <img src={IMG.hero.providers} alt="" className="absolute inset-0 w-full h-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-r from-blue-900/90 via-blue-800/80 to-blue-700/70" />
          <div className="relative p-6 sm:p-8">
            <h1 className="text-2xl sm:text-3xl font-bold text-white mb-2">
              Find Trusted Service Providers
            </h1>
            <p className="text-blue-100 mb-4 text-sm max-w-xl">
              Looking for a graphic designer? A photographer? Any professional? Find them here.
            </p>
            <div className="relative max-w-xl">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
              <input
                type="text"
                placeholder="Search by name, specialty, or skill..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-12 pr-4 py-3 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
        </div>

        {/* Category Pills */}
        <div className="mb-6">
          <div className="flex gap-2 overflow-x-auto pb-2 hide-scrollbar">
            {categories.map((cat) => (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`px-4 py-2 rounded-full whitespace-nowrap font-medium transition-colors text-sm ${
                  selectedCategory === cat
                    ? 'bg-blue-700 text-white'
                    : 'bg-white text-gray-700 border border-gray-200 hover:border-blue-300'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>

        {/* Legend */}
        <div className="flex flex-wrap gap-4 mb-6 text-xs text-gray-600">
          <div className="flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-amber-500" />
            <span>Featured - ₦5,000/mo</span>
          </div>
          <div className="flex items-center gap-1.5">
            <BadgeCheck className="w-3.5 h-3.5 text-blue-600" />
            <span>Verified - ₦3,000/mo</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded bg-gray-300" />
            <span>Basic - FREE at launch</span>
          </div>
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
              <button
                onClick={() => scroll('left')}
                className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-3 z-10 bg-white rounded-full p-2 shadow-md hover:shadow-lg transition-shadow"
              >
                <ChevronLeft size={18} className="text-gray-600" />
              </button>
              <button
                onClick={() => scroll('right')}
                className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-3 z-10 bg-white rounded-full p-2 shadow-md hover:shadow-lg transition-shadow"
              >
                <ChevronRight size={18} className="text-gray-600" />
              </button>
              <div ref={scrollRef} className="overflow-x-auto scroll-smooth hide-scrollbar">
                <div className="flex gap-4 pb-2">
                  {featuredProviders.map((provider) => (
                    <div key={provider.id} className="w-72 shrink-0">
                      <ProviderCard provider={provider} />
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* All Providers Grid */}
        <div className="mb-10">
          <h2 className="text-xl font-bold text-gray-900 mb-4">All Providers</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {sortedProviders.map((provider) => (
              <ProviderCard key={provider.id} provider={provider} />
            ))}
          </div>
        </div>

        {/* Become a Provider CTA */}
        <div className="bg-gradient-to-r from-emerald-600 to-emerald-700 rounded-2xl shadow-lg p-8">
          <div className="max-w-2xl">
            <h2 className="text-2xl font-bold text-white mb-2">Become a Service Provider</h2>
            <p className="text-emerald-100 mb-6">
              Join thousands of professionals offering services on JobBridge. Get clients, build your reputation, and grow your business.
            </p>
            <div className="grid sm:grid-cols-2 gap-3 mb-6">
              <div className="bg-white/10 backdrop-blur rounded-xl p-4">
                <div className="font-bold text-white mb-1">Monthly Listing</div>
                <div className="text-emerald-100 text-sm mb-1">FREE at launch</div>
                <ul className="text-xs text-emerald-200 space-y-1">
                  <li>• Profile on JobBridge</li>
                  <li>• Contact information</li>
                  <li>• Receive inquiries</li>
                </ul>
              </div>
              <div className="bg-white/10 backdrop-blur rounded-xl p-4">
                <div className="font-bold text-white mb-1">Featured Professional</div>
                <div className="text-emerald-100 text-sm mb-1">₦5,000/month</div>
                <ul className="text-xs text-emerald-200 space-y-1">
                  <li>• Top of search results</li>
                  <li>• Featured on homepage</li>
                  <li>• Social media promotion</li>
                </ul>
              </div>
            </div>
            <Link to="/pricing" className="inline-flex items-center gap-2 bg-white text-emerald-700 hover:bg-emerald-50 font-bold py-3 px-6 rounded-xl transition-colors">
              View Pricing Plans <ArrowRight size={18} />
            </Link>
          </div>
        </div>
      </div>

      {/* Chat Modal */}
      {chatProvider && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/50">
          <div className="w-full max-w-md bg-white rounded-t-2xl sm:rounded-2xl shadow-2xl flex flex-col max-h-[80vh]">
            {/* Chat Header */}
            <div className="flex items-center gap-3 p-4 border-b shrink-0">
              <img
                src={chatProvider.img}
                alt={chatProvider.name}
                className="w-10 h-10 rounded-xl object-cover border-2 border-gray-100"
              />
              <div className="flex-1">
                <h3 className="font-bold text-gray-900">{chatProvider.name}</h3>
                <p className="text-xs text-gray-500">{chatProvider.specialty}</p>
              </div>
              <button
                onClick={closeChat}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {messages.map((message) => (
                <div
                  key={message.id}
                  className={`flex ${message.sender === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`max-w-[80%] px-4 py-2.5 rounded-2xl ${
                      message.sender === 'user'
                        ? 'bg-blue-700 text-white rounded-br-md'
                        : 'bg-gray-100 text-gray-900 rounded-bl-md'
                    }`}
                  >
                    <p className="text-sm">{message.text}</p>
                    <p className={`text-xs mt-1 ${message.sender === 'user' ? 'text-blue-200' : 'text-gray-400'}`}>
                      {message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>
                </div>
              ))}
              <div ref={messagesEndRef} />
            </div>

            {/* Input */}
            <form onSubmit={sendMessage} className="p-4 border-t shrink-0">
              <div className="flex gap-2">
                <input
                  type="text"
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  placeholder="Type your message..."
                  className="flex-1 px-4 py-2.5 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
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
