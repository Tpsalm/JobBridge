import { useState, useEffect, useCallback } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import Header from '../components/Header';
import BottomNav from '../components/BottomNav';
import { useModal } from '../contexts/ModalContext';
import { useToasts } from '../contexts/ToastContext';
import {
  fetchAdvertisementsByOwner,
  fetchPublicAdvertisements,
  createAdvertisement,
  updateAdvertisement,
  deleteAdvertisement,
  incrementAdvertisementViews,
  incrementAdvertisementClicks,
  decrementAdvertCredits,
  createConversationMessage,
} from '../lib/supabaseQueries';
import { supabase } from '../lib/supabase';
import {
  Building,
  Plus,
  Eye,
  Clock,
  CheckCircle,
  CreditCard,
  TrendingUp,
  Star,
  ChevronRight,
  Edit,
  Trash2,
  Lock,
  Phone,
  Globe,
  Mail,
  X,
  ExternalLink,
  MessageCircle,
  ImagePlus,
} from 'lucide-react';
import PageHero from '../components/PageHero';
import { HERO_CAROUSELS, advertImage } from '../lib/media';
import { sendEmail } from '../lib/email';
import AnimatedSection from '../components/AnimatedSection';

type AdvertStatus = 'pending' | 'active' | 'paused' | 'expired' | 'rejected';

interface Advert {
  id: string;
  ownerId: string;
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
  imageUrl?: string;
  website?: string;
  phone?: string;
  email?: string;
}

const initialAdverts: Advert[] = [];

const adPackages = [
  { name: 'Weekly Ad', duration: '7 days', price: 2000, popular: false },
  { name: 'Monthly Ad', duration: '30 days', price: 7500, popular: true },
  { name: 'Featured Business', duration: '30 days', price: 15000, popular: false },
];

const categories = ['Restaurant', 'Fashion', 'Technology', 'Education', 'Health', 'Entertainment', 'Automotive', 'Real Estate', 'Other'];

// Auto-expiry: an advert whose paid duration (expires_at) has elapsed is
// treated as EXPIRED even if the background sweep hasn't flipped `status`
// yet. This keeps the owner dashboard accurate the moment the 7/30 day period
// ends and prevents an expired advert from being re-activated.
function effectiveAdStatus(status: string, expiresAt?: string | null): AdvertStatus {
  const base = (status || 'active') as AdvertStatus;
  if (base !== 'expired' && expiresAt) {
    const t = new Date(expiresAt).getTime();
    if (!Number.isNaN(t) && t <= Date.now()) return 'expired';
  }
  return base;
}

// Rank adverts exactly as requested: Featured Business first, then Monthly Ad,
// then Weekly Ad at the bottom. Within the same package, featured ads float up.
// `featured` (is_featured) is the authoritative Featured Business indicator —
// some featured ads carry a weekly/monthly package, so it must win over the
// package-derived duration when ranking.
function sortAdverts(list: Advert[]): Advert[] {
  const rank = (a: Advert) => (a.featured || a.duration === 'Featured' ? 0 : a.duration === 'Monthly' ? 1 : 2);
  return [...list].sort((a, b) => {
    const ra = rank(a);
    const rb = rank(b);
    if (ra !== rb) return ra - rb;
    if (a.featured !== b.featured) return a.featured ? -1 : 1;
    return 0;
  });
}

export default function Business() {
  const { openModal } = useModal();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user, profile, subscription, subscriptionLoaded, fetchSubscription } = useAuth();
  const { push } = useToasts();

  // A user can only create an advert when their subscription is active AND
  // they have at least 1 advert credit. `subscription.status` alone is not
  // enough — it reads as "active" for ANY paid plan (AI tools, recruiter job
  // posts, service listings, business adverts) because every paid plan sets
  // `is_premium`. Without this check, a user with a premium flag from another
  // plan but 0 advert credits would see "Create Advert"/"No credits remaining"
  // and NO "pay to subscribe" button, so they could never purchase advert credits.
  const canCreateAdvert =
    subscription.status === 'active' &&
    subscription.advert_credits >= 1;
  const [adverts, setAdverts] = useState<Advert[]>(initialAdverts);
  const [loadingAdverts, setLoadingAdverts] = useState(false);
  const [publicAdverts, setPublicAdverts] = useState<Advert[]>([]);
  const [loadingPublicAdverts, setLoadingPublicAdverts] = useState(true);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [creating, setCreating] = useState(false);
  const [hasExistingAdvert, setHasExistingAdvert] = useState(false);
  const [formData, setFormData] = useState({
    businessName: '',
    title: '',
    description: '',
    category: '',
    package: '',
    featured: false,
    phone: '',
    website: '',
    email: '',
    imageUrl: '',
  });
  const [imageFile, setImageFile] = useState<File | null>(null);

  // Edit existing advert
  const [editingAdvert, setEditingAdvert] = useState<Advert | null>(null);
  const [editForm, setEditForm] = useState({
    businessName: '',
    title: '',
    description: '',
    category: '',
    package: '',
    featured: false,
    phone: '',
    website: '',
    email: '',
    imageUrl: '',
  });
  const [editImageFile, setEditImageFile] = useState<File | null>(null);
  const [savingEdit, setSavingEdit] = useState(false);

  // Advert detail viewer (public showcase + own adverts)
  const [viewAdvert, setViewAdvert] = useState<Advert | null>(null);

  const paidPackage = searchParams.get('paidPackage') || '';
  const paidPackageOption = paidPackage === 'business_weekly'
    ? 'Weekly Ad'
    : paidPackage === 'business_monthly'
      ? 'Monthly Ad'
      : paidPackage === 'business_featured'
        ? 'Featured Business'
        : '';

  const shouldOpenCreate = searchParams.get('create') === 'true';

  // Opening the create form prefills the advert with the business's own
  // picture (profile avatar) so the advert always contains the business's
  // particular image — the owner can still swap in a dedicated photo.
  const openCreateForm = useCallback((pkg?: string) => {
    setFormData({
      businessName: '',
      title: '',
      description: '',
      category: '',
      package: pkg || '',
      featured: false,
      phone: '',
      website: '',
      email: '',
      imageUrl: profile?.avatar_url || '',
    });
    setImageFile(null);
    setShowCreateForm(true);
  }, [profile?.avatar_url]);

  useEffect(() => {
    if (!shouldOpenCreate || !subscriptionLoaded) return;

    if (canCreateAdvert) {
      openCreateForm(paidPackageOption || undefined);
      // Clean up the query param
      navigate('/business', { replace: true });
    } else {
      navigate('/pricing', { replace: true });
    }
  }, [shouldOpenCreate, canCreateAdvert, subscriptionLoaded, paidPackageOption, navigate, openCreateForm]);

  // Refresh adverts when created
  useEffect(() => {
    const handler = () => loadAdverts();
    window.addEventListener('adverts:updated', handler);
    return () => window.removeEventListener('adverts:updated', handler);
  }, [user?.id]);

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
              ownerId: ad.owner_id || '',
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
              status: effectiveAdStatus(ad.status, ad.expires_at),
              startDate: ad.starts_at ? ad.starts_at.split('T')[0] : '',
              endDate: ad.expires_at ? ad.expires_at.split('T')[0] : '',
              views: ad.views || 0,
              clicks: ad.clicks || 0,
              featured: ad.is_featured || false,
              imageUrl: ad.image_url || '',
              website: ad.website_url || '',
              phone: ad.phone || '',
              email: ad.email || '',
            })),
          );
          // One active advert is allowed; expired adverts can be replaced.
          setHasExistingAdvert(data.some((ad) => effectiveAdStatus(ad.status, ad.expires_at) !== 'expired'));
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

  // Load advertisements created by ALL subscribed business users so they are
  // visible to everyone — including brand-new accounts and anonymous visitors.
  useEffect(() => {
    let cancelled = false;
    const loadPublicAdverts = async () => {
      setLoadingPublicAdverts(true);
      try {
        const data = await fetchPublicAdvertisements();
        if (!cancelled) {
          setPublicAdverts(
            data.map((ad) => ({
              id: ad.id,
              ownerId: ad.owner_id || '',
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
              status: effectiveAdStatus(ad.status, ad.expires_at),
              startDate: ad.starts_at ? ad.starts_at.split('T')[0] : '',
              endDate: ad.expires_at ? ad.expires_at.split('T')[0] : '',
              views: ad.views || 0,
              clicks: ad.clicks || 0,
              featured: ad.is_featured || false,
              imageUrl: ad.image_url || '',
              website: ad.website_url || '',
              phone: ad.phone || '',
              email: ad.email || '',
            })),
          );
        }
      } catch (error) {
        console.error('Failed to load public adverts:', error);
        if (!cancelled) setPublicAdverts([]);
      } finally {
        if (!cancelled) setLoadingPublicAdverts(false);
      }
    };

    loadPublicAdverts();
    // Refresh when a new advert is created anywhere
    const handler = () => loadPublicAdverts();
    window.addEventListener('adverts:updated', handler);
    return () => {
      cancelled = true;
      window.removeEventListener('adverts:updated', handler);
    };
  }, []);

  // ── Upload a business picture to the advertisements storage bucket ────────
  const uploadAdvertImage = async (file: File): Promise<string> => {
    if (!user?.id) throw new Error('Not signed in');
    const ext = file.name.split('.').pop()?.toLowerCase() || 'jpg';
    const path = `${user.id}/${Date.now()}.${ext}`;
    const { error: uploadError } = await supabase.storage
      .from('advertisements')
      .upload(path, file, { upsert: true, contentType: file.type });
    if (uploadError) throw uploadError;
    const { data } = supabase.storage.from('advertisements').getPublicUrl(path);
    return data?.publicUrl || '';
  };

  const handleCreateAd = async (e: React.FormEvent) => {
    e.preventDefault();
    const selectedPackage = adPackages.find(p => p.name === formData.package);
    if (!selectedPackage) return;

    // Check if user already has an active advert (limit to 1).
    if (hasExistingAdvert) {
      push({
        message: '❌ You already have an active advert. Pause or delete it before creating another one.',
        type: 'error',
      });
      return;
    }

    // If no subscription/credits, redirect to pricing
    if (subscription.status !== 'active' || subscription.advert_credits < 1) {
      push({
        message: 'No advert credits remaining. Please purchase a plan.',
        type: 'info',
      });
      navigate('/pricing');
      return;
    }

    setCreating(true);

    try {
      // Upload the business picture (if one was selected) before creating.
      let imageUrl = formData.imageUrl || '';
      if (imageFile) {
        try {
          imageUrl = await uploadAdvertImage(imageFile);
        } catch (imgErr) {
          console.warn('[Business] advert image upload failed:', imgErr);
          push({ message: '⚠️ Advert created without image — picture upload failed.', type: 'info' });
        }
      }

      const normalizedPackage = formData.package === 'Weekly Ad'
        ? 'weekly'
        : formData.package === 'Monthly Ad'
          ? 'monthly'
          : 'featured';

      const durationDays = formData.package === 'Weekly Ad' ? 7 : 30;
      const starts_at = new Date().toISOString();
      const expires_at = new Date(Date.now() + durationDays * 24 * 60 * 60 * 1000).toISOString();

      const advert = await createAdvertisement({
        owner_id: user!.id,
        business_name: formData.businessName,
        title: formData.title,
        description: formData.description,
        category: formData.category || 'Other',
        package: normalizedPackage,
        is_featured: formData.package === 'Featured Business' || formData.featured,
        image_url: imageUrl || null,
        phone: formData.phone || null,
        website_url: formData.website || null,
        email: formData.email || null,
        starts_at,
        expires_at,
        amount_paid: 0, // paid via subscription credits
      });

      // Decrement credits
      await decrementAdvertCredits(user!.id);
      await fetchSubscription(user!.id);

      // Refresh subscription state
      window.dispatchEvent(new Event('adverts:updated'));

      setShowCreateForm(false);
      setFormData({ businessName: '', title: '', description: '', category: '', package: '', featured: false, phone: '', website: '', email: '', imageUrl: '' });
      setImageFile(null);

      push({
        message: '✅ Advert created successfully!',
        type: 'success',
      });

      // Send confirmation email
      if (user?.email) {
        try {
          sendEmail({
            type: 'advert_created',
            email: user.email,
            name: user.user_metadata?.full_name || user.email,
            advertId: advert?.id ?? null,
          } as any);
        } catch (e) {
          console.warn('Failed to send advert created email:', e);
        }
      }
    } catch (error) {
      console.error('Failed to create advert:', error);
      push({
        message: '❌ Failed to create advert. Please try again.',
        type: 'error',
      });
    } finally {
      setCreating(false);
    }
  };

  const loadAdverts = async () => {
    if (!user?.id) return;
    try {
      const data = await fetchAdvertisementsByOwner(user.id);
      setAdverts(
        data.map((ad) => ({
          id: ad.id,
          ownerId: ad.owner_id || '',
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
          status: effectiveAdStatus(ad.status, ad.expires_at),
          startDate: ad.starts_at ? ad.starts_at.split('T')[0] : '',
          endDate: ad.expires_at ? ad.expires_at.split('T')[0] : '',
          views: ad.views || 0,
          clicks: ad.clicks || 0,
          featured: ad.is_featured || false,
          imageUrl: ad.image_url || '',
          website: ad.website_url || '',
          phone: ad.phone || '',
          email: ad.email || '',
        })),
      );
      setHasExistingAdvert(data.some((ad) => effectiveAdStatus(ad.status, ad.expires_at) !== 'expired'));
    } catch (error) {
      console.error('Failed to load business adverts:', error);
    }
  };

  // ── Pause / Activate (persisted to the database) ────────────────────────
  const handleToggleAdStatus = async (ad: Advert) => {
    if (ad.status === 'expired') {
      push({
        message: '⛔ This advert has expired. Subscribe again to create a new advert.',
        type: 'info',
      });
      return;
    }
    const next = ad.status === 'active' ? 'paused' : 'active';
    try {
      await updateAdvertisement(ad.id, { status: next });
      window.dispatchEvent(new Event('adverts:updated'));
      push({
        message: next === 'active' ? '✅ Advert activated.' : '⏸️ Advert paused.',
        type: 'success',
      });
    } catch (err) {
      console.error('[Business] toggle advert status failed:', err);
      push({ message: '❌ Failed to update advert status. Please try again.', type: 'error' });
    }
  };

  // ── Delete (persisted to the database) ──────────────────────────────────
  const handleDeleteAdvert = async (ad: Advert) => {
    if (!window.confirm('Delete this advert? This cannot be undone.')) return;
    try {
      await deleteAdvertisement(ad.id);
      if (viewAdvert?.id === ad.id) setViewAdvert(null);
      window.dispatchEvent(new Event('adverts:updated'));
      push({ message: '🗑️ Advert deleted.', type: 'success' });
    } catch (err) {
      console.error('[Business] delete advert failed:', err);
      push({ message: '❌ Failed to delete advert. Please try again.', type: 'error' });
    }
  };

  // ── Edit (open prefilled form) ──────────────────────────────────────────
  const openEditAdvert = (ad: Advert) => {
    setEditingAdvert(ad);
    setEditForm({
      businessName: ad.businessName,
      title: ad.title,
      description: ad.description,
      category: ad.category,
      package: ad.duration,
      featured: ad.featured,
      phone: ad.phone || '',
      website: ad.website || '',
      email: ad.email || '',
      imageUrl: ad.imageUrl || '',
    });
    setEditImageFile(null);
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingAdvert) return;
    setSavingEdit(true);
    try {
      // Upload a newly selected business picture (if any) before saving.
      let imageUrl = editForm.imageUrl || '';
      if (editImageFile) {
        try {
          imageUrl = await uploadAdvertImage(editImageFile);
        } catch (imgErr) {
          console.warn('[Business] edit advert image upload failed:', imgErr);
          push({ message: '⚠️ Advert updated without image — picture upload failed.', type: 'info' });
        }
      }

      const normalizedPackage = editForm.package === 'Weekly'
        ? 'weekly'
        : editForm.package === 'Monthly'
          ? 'monthly'
          : 'featured';
      await updateAdvertisement(editingAdvert.id, {
        business_name: editForm.businessName,
        title: editForm.title,
        description: editForm.description,
        category: editForm.category || 'Other',
        package: normalizedPackage,
        is_featured: editForm.package === 'Featured' || editForm.featured,
        image_url: imageUrl || null,
        phone: editForm.phone || null,
        website_url: editForm.website || null,
        email: editForm.email || null,
      });
      setEditingAdvert(null);
      window.dispatchEvent(new Event('adverts:updated'));
      push({ message: '✅ Advert updated successfully!', type: 'success' });
    } catch (err) {
      console.error('[Business] edit advert failed:', err);
      push({ message: '❌ Failed to update advert. Please try again.', type: 'error' });
    } finally {
      setSavingEdit(false);
    }
  };

  // ── View detail (counts a view + a "click to view") ─────────────────────
  // The business "click" metric represents how many people clicked to view
  // the advert — NOT how many people chose to chat/contact. Opening the
  // detail view is what counts as a click.
  const handleViewAdvert = (ad: Advert) => {
    setViewAdvert(ad);
    incrementAdvertisementViews(ad.id);
    incrementAdvertisementClicks(ad.id);
    // Optimistic bump so the counters reflect immediately in the UI.
    setPublicAdverts(prev => prev.map(a => a.id === ad.id ? { ...a, views: a.views + 1, clicks: a.clicks + 1 } : a));
    setAdverts(prev => prev.map(a => a.id === ad.id ? { ...a, views: a.views + 1, clicks: a.clicks + 1 } : a));
  };

  // ── Contact action from the detail view (call / website / email) ────────
  // Contact actions do NOT increment the "click" metric — only viewing does.
  const handleAdvertContact = (_ad: Advert, action: () => void) => {
    action();
  };

  const renderAdCard = (advert: Advert) => (
    <div
      key={advert.id}
      onClick={() => handleViewAdvert(advert)}
      className={`bg-white rounded-xl overflow-hidden border hover:shadow-lg transition-shadow cursor-pointer ${
        advert.featured ? 'border-amber-200 ring-1 ring-amber-200' : 'border-gray-100'
      }`}
    >
      <img
        src={advert.imageUrl || advertImage(advert.category)}
        alt={advert.title}
        className="w-full h-36 object-cover"
      />
      <div className="p-5">
        <div className="flex items-start justify-between mb-2">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              <h3 className="font-bold text-gray-900">{advert.title}</h3>
              {advert.featured && (
                <span className="flex items-center gap-1 text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full shrink-0">
                  <Star className="w-3 h-3" /> Featured
                </span>
              )}
            </div>
            <p className="text-sm text-gray-600">{advert.businessName}</p>
          </div>
        </div>
        <p className="text-sm text-gray-500 mb-3 line-clamp-2">{advert.description}</p>
        <div className="flex flex-wrap gap-3 text-xs text-gray-600 mb-3">
          <span className="flex items-center gap-1">
            <Building className="w-3.5 h-3.5" />
            {advert.category}
          </span>
          <span className="flex items-center gap-1">
            <Clock className="w-3.5 h-3.5" />
            {advert.duration}
          </span>
          <span className="flex items-center gap-1">
            <Eye className="w-3.5 h-3.5" />
            {advert.views.toLocaleString()} views
          </span>
          <span className="flex items-center gap-1">
            <TrendingUp className="w-3.5 h-3.5" />
            {advert.clicks.toLocaleString()} users clicked
          </span>
        </div>
        <div className="flex items-center justify-between mt-1">
          <button
            onClick={(e) => {
              e.stopPropagation();
              handleViewAdvert(advert);
            }}
            className="inline-flex items-center gap-1 text-sm text-blue-700 font-medium hover:underline"
          >
            View advert <ChevronRight className="w-3.5 h-3.5" />
          </button>
          {user?.id !== advert.ownerId && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleChatAdvert(advert);
              }}
              className="inline-flex items-center gap-1.5 bg-blue-50 text-blue-700 text-sm font-medium px-3 py-1.5 rounded-lg hover:bg-blue-100 transition-colors"
            >
              <MessageCircle className="w-4 h-4" /> Chat
            </button>
          )}
        </div>
      </div>
    </div>
  );

  // ── Chat with the business behind an advert (opens the Message page) ────
  const handleChatAdvert = async (ad: Advert) => {
    if (!user?.id) {
      push({ message: 'Please sign in to message this business.', type: 'info' });
      navigate(`/login?redirect=${encodeURIComponent('/business')}`);
      return;
    }
    if (!ad.ownerId || ad.ownerId === user.id) {
      push({ message: 'You cannot message your own business advert.', type: 'info' });
      return;
    }

    const senderName = profile?.full_name || user.email || 'A user';
    try {
      const conversationId = await createConversationMessage({
        senderId: user.id,
        senderName,
        recipientId: ad.ownerId,
        recipientName: ad.businessName || 'Business',
        recipientEmail: ad.email || undefined,
        message: `Hello ${ad.businessName}! I came across your advert on JobBridge and I'd love to know more about your business.`,
      });
      if (conversationId) {
        navigate(`/messages?conversationId=${encodeURIComponent(conversationId)}`);
      } else {
        navigate('/messages');
      }
    } catch (error) {
      console.error('[Business] chat advert failed:', error);
      push({ message: '❌ Could not start a chat. Please try again.', type: 'error' });
      navigate('/messages');
    }
  };

  // Structure the Advertisements Showcase exactly as requested:
  // Featured Business first, then Monthly Ads, then Weekly Ads at the bottom.
  // Featured = flagged `featured` (is_featured) OR a 'featured' package, so
  // featured ads always land in the Featured Business section and never repeat
  // under monthly/weekly.
  const isFeaturedAd = (a: Advert) => a.featured || a.duration === 'Featured';
  const sortedPublicAdverts = sortAdverts(publicAdverts);
  const featuredAdverts = sortedPublicAdverts.filter(isFeaturedAd);
  const monthlyAdverts = sortedPublicAdverts.filter(a => !isFeaturedAd(a) && a.duration === 'Monthly');
  const weeklyAdverts = sortedPublicAdverts.filter(a => !isFeaturedAd(a) && a.duration === 'Weekly');

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
        {/* Advertisements Showcase — visible to ALL users (new & existing) */}
        <AnimatedSection direction="up" className="mb-10">
          <div className="flex items-end justify-between mb-4">
            <div>
              <h2 className="text-xl font-bold text-gray-900">Advertisements Showcase</h2>
              <p className="text-sm text-gray-500 mt-1">
                Discover businesses advertising on JobBridge — updated as subscribed business owners post.
              </p>
            </div>
          </div>

          {loadingPublicAdverts ? (
            <div className="bg-white rounded-xl p-8 text-center border border-gray-100">
              <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-blue-100 text-blue-600 mx-auto mb-3">
                <Building className="w-5 h-5 animate-pulse" />
              </div>
              <p className="text-gray-500">Loading advertisements...</p>
            </div>
          ) : publicAdverts.length === 0 ? (
            <div className="bg-white rounded-xl p-8 text-center border border-gray-100">
              <Building className="w-12 h-12 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-500">No advertisements yet. Be the first to showcase your business!</p>
            </div>
          ) : (
            <>
              {/* Featured Business — subscribed/paid businesses top the page */}
              {featuredAdverts.length > 0 && (
                <div className="mb-8">
                  <div className="flex items-center gap-2 mb-3">
                    <Star className="w-4 h-4 text-amber-500" />
                    <h3 className="font-semibold text-gray-900">Featured Business</h3>
                    <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full font-medium">{featuredAdverts.length}</span>
                  </div>
                  <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {featuredAdverts.map(advert => renderAdCard(advert))}
                  </div>
                </div>
              )}

              {/* Monthly Ads */}
              {monthlyAdverts.length > 0 && (
                <div className="mb-8">
                  <div className="flex items-center gap-2 mb-3">
                    <Clock className="w-4 h-4 text-blue-600" />
                    <h3 className="font-semibold text-gray-900">Monthly Ads</h3>
                    <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-medium">{monthlyAdverts.length}</span>
                  </div>
                  <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {monthlyAdverts.map(advert => renderAdCard(advert))}
                  </div>
                </div>
              )}

              {/* Weekly Ads — at the bottom */}
              {weeklyAdverts.length > 0 && (
                <div className="mb-8">
                  <div className="flex items-center gap-2 mb-3">
                    <Building className="w-4 h-4 text-slate-500" />
                    <h3 className="font-semibold text-gray-900">Weekly Ads</h3>
                    <span className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full font-medium">{weeklyAdverts.length}</span>
                  </div>
                  <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {weeklyAdverts.map(advert => renderAdCard(advert))}
                  </div>
                </div>
              )}
            </>
          )}
        </AnimatedSection>

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
            <div className="text-xs text-gray-500">Total User Clicks</div>
          </div>
        </div>

        {/* Subscription Status */}
        <div className="mb-6">
          {canCreateAdvert ? (
            <div className="bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-2 text-sm text-emerald-800 flex-wrap">
                <CheckCircle className="w-4 h-4 text-emerald-600" />
                <span className="font-medium">{subscription.advert_credits} advert credit{subscription.advert_credits !== 1 ? 's' : ''} remaining</span>
                {subscription.tier && (
                  <span className="text-xs bg-emerald-200 text-emerald-800 px-2 py-0.5 rounded capitalize">
                    {subscription.tier.replace(/_/g, ' ')} plan
                  </span>
                )}
              </div>
              <div className="text-xs text-emerald-700">Each advert uses 1 credit.</div>
            </div>
          ) : (
            <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-2 text-sm text-amber-800 flex-wrap">
                <CreditCard className="w-4 h-4 text-amber-600" />
                <span className="font-medium">{subscription.status === 'active' ? 'No advert credits' : 'No active plan'}</span>
                <span className="text-xs text-amber-600">Subscribe to create adverts</span>
              </div>
              <Link to="/pricing" className="text-xs bg-amber-600 text-white px-3 py-1.5 rounded-lg font-medium hover:bg-amber-700 transition-colors inline-flex items-center">
                View Plans
              </Link>
            </div>
          )}
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
                {canCreateAdvert ? (
                  <button
                    onClick={() => {
                      openCreateForm(pkg.name);
                    }}
                    className={`w-full py-2.5 rounded-lg font-medium text-sm transition-colors ${
                      pkg.popular
                        ? 'bg-blue-700 text-white hover:bg-blue-800'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    Create Advert
                  </button>
                ) : (
                  <Link
                    to={`/payment?plan=${pkg.name === 'Weekly Ad' ? 'business_weekly' : pkg.name === 'Monthly Ad' ? 'business_monthly' : 'business_featured'}`}
                    className={`block w-full py-2.5 rounded-lg font-medium text-sm text-center transition-colors ${
                      pkg.popular
                        ? 'bg-blue-100 text-blue-500 border-2 border-blue-200 hover:bg-blue-200'
                        : 'bg-gray-100 text-gray-500 border-2 border-gray-200 hover:bg-gray-200'
                    }`}
                  >
                    <Lock className="w-4 h-4 inline mr-1" />
                    Subscribe & Create
                  </Link>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Create Advert Form */}
        {showCreateForm && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 overflow-y-auto">
            <div className="w-full max-w-lg bg-white rounded-2xl shadow-2xl p-6 max-h-[calc(100vh-3rem)] overflow-y-auto">
              <h2 className="text-xl font-bold text-gray-900 mb-4">Create New Advert</h2>
              <p className="text-sm text-emerald-700 mb-4 flex items-center gap-2">
                <CheckCircle className="w-4 h-4" />
                You have {subscription.advert_credits} advert credit{subscription.advert_credits !== 1 ? 's' : ''} remaining. Creating this will use 1 credit.
              </p>
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
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Business Picture</label>
                  <div className="flex items-center gap-3">
                    {(formData.imageUrl || imageFile) && (
                      <img
                        src={imageFile ? URL.createObjectURL(imageFile) : formData.imageUrl}
                        alt="Business preview"
                        className="w-20 h-20 rounded-lg object-cover border border-gray-200"
                      />
                    )}
                    <label className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 border border-dashed border-gray-300 rounded-lg text-sm text-gray-600 hover:bg-gray-50 cursor-pointer">
                      <ImagePlus className="w-4 h-4" />
                      {formData.imageUrl || imageFile ? 'Change picture' : 'Upload business picture'}
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={(e) => {
                          const file = e.target.files?.[0] || null;
                          setImageFile(file);
                          if (file) setFormData({ ...formData, imageUrl: '' });
                        }}
                      />
                    </label>
                  </div>
                  <p className="text-xs text-gray-400 mt-1">Recommended size: 1220 × 434 pixels. Only subscribed business accounts can add a picture.</p>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
                    <input
                      type="tel"
                      value={formData.phone}
                      onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                      className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                      placeholder="0801 234 5678"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Website</label>
                    <input
                      type="url"
                      value={formData.website}
                      onChange={(e) => setFormData({ ...formData, website: e.target.value })}
                      className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                      placeholder="https://..."
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Contact Email</label>
                  <input
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                    placeholder="contact@business.com"
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
                  {canCreateAdvert ? (
                    <button
                      type="submit"
                      disabled={creating}
                      className="flex-1 py-2.5 bg-blue-700 text-white rounded-lg font-medium hover:bg-blue-800 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {creating ? 'Creating...' : 'Create Advert (1 credit)'}
                    </button>
                  ) : (
                    <Link
                      to={formData.package
                        ? `/payment?plan=${formData.package === 'Weekly Ad' ? 'business_weekly' : formData.package === 'Monthly Ad' ? 'business_monthly' : 'business_featured'}`
                        : '/pricing'}
                      className="flex-1 py-2.5 bg-blue-700 text-white rounded-lg font-medium text-center hover:bg-blue-800 transition-colors inline-flex items-center justify-center gap-2"
                    >
                      <Lock className="w-4 h-4" />
                      Subscribe & Pay
                    </Link>
                  )}
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Limit Notice & Create New Advert Button */}
        <div className="mb-8">
          {hasExistingAdvert && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 mb-4 flex items-center gap-2 text-sm text-amber-800">
              <Lock className="w-4 h-4 shrink-0" />
              <span>You already have an active advert. Only <strong>1 active advert</strong> is allowed per business.</span>
            </div>
          )}
          {canCreateAdvert ? (
            <button
              onClick={() => {
                if (hasExistingAdvert) {
                  push({
                    message: '❌ You already have an active advert. Pause or delete it before creating another one.',
                    type: 'error',
                  });
                  return;
                }
                openCreateForm();
              }}
              disabled={subscription.advert_credits < 1 || hasExistingAdvert}
              className="w-full flex items-center justify-center gap-2 bg-blue-700 text-white py-3 rounded-xl font-semibold hover:bg-blue-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Plus className="w-5 h-5" />
              {hasExistingAdvert
                ? 'Active advert limit reached (1 per business)'
                : subscription.advert_credits > 0
                  ? `Create New Advert (${subscription.advert_credits} credit${subscription.advert_credits !== 1 ? 's' : ''} remaining)`
                  : 'No credits remaining'}
            </button>
          ) : (
            <Link
              to="/pricing"
              className="w-full flex items-center justify-center gap-2 bg-blue-100 text-blue-500 font-semibold py-3 rounded-xl border-2 border-blue-200 hover:bg-blue-200 transition-colors"
            >
              <Lock className="w-5 h-5" />
              Subscribe to Create Adverts
            </Link>
          )}
        </div>

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
              {sortAdverts(adverts).map((advert) => (
                <div
                  key={advert.id}
                  className={`bg-white rounded-xl overflow-hidden border ${advert.featured ? 'border-amber-200 ring-1 ring-amber-200' : 'border-gray-100'}`}
                >
                  <img
                    src={advert.imageUrl || advertImage(advert.category)}
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
                      {advert.clicks} users clicked
                    </span>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <button
                      onClick={() => handleViewAdvert(advert)}
                      className="px-3 py-1.5 rounded-lg text-sm font-medium bg-gray-50 text-gray-700 hover:bg-gray-100"
                    >
                      <Eye className="w-4 h-4 inline mr-1" />
                      View
                    </button>
                    <button
                      onClick={() => handleToggleAdStatus(advert)}
                      disabled={advert.status === 'expired'}
                      className={`px-3 py-1.5 rounded-lg text-sm font-medium ${
                        advert.status === 'active'
                          ? 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                          : advert.status === 'expired'
                          ? 'bg-gray-50 text-gray-400 cursor-not-allowed'
                          : 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200'
                      }`}
                    >
                      {advert.status === 'active' ? 'Pause' : advert.status === 'expired' ? 'Expired' : 'Activate'}
                    </button>
                    <button
                      onClick={() => openEditAdvert(advert)}
                      className="px-3 py-1.5 rounded-lg text-sm font-medium bg-blue-50 text-blue-700 hover:bg-blue-100"
                    >
                      <Edit className="w-4 h-4 inline mr-1" />
                      Edit
                    </button>
                    <button
                      onClick={() => handleDeleteAdvert(advert)}
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
        <AnimatedSection direction="up"><div className="bg-white rounded-xl p-5 border border-gray-100">
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
        </div></AnimatedSection>
      </div>

      {/* ── Advert Detail Modal (counts a view on open, clicks on contact) ── */}
      {viewAdvert && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-4 bg-black/50">
          <div className="w-full max-w-lg bg-white rounded-t-2xl sm:rounded-2xl shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="relative">
              <img
                src={viewAdvert.imageUrl || advertImage(viewAdvert.category)}
                alt={viewAdvert.title}
                className="w-full h-48 object-cover"
              />
              <button
                onClick={() => setViewAdvert(null)}
                className="absolute top-3 right-3 p-2 bg-white/90 rounded-full hover:bg-white transition-colors shadow"
                aria-label="Close advert details"
              >
                <X className="w-5 h-5 text-gray-600" />
              </button>
              {viewAdvert.featured && (
                <span className="absolute top-3 left-3 flex items-center gap-1 text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full">
                  <Star className="w-3 h-3" /> Featured
                </span>
              )}
            </div>
            <div className="p-6">
              <h2 className="text-xl font-bold text-gray-900">{viewAdvert.title}</h2>
              <p className="text-sm text-gray-600 mt-1">{viewAdvert.businessName}</p>
              <div className="flex flex-wrap gap-3 text-xs text-gray-600 mt-3">
                <span className="flex items-center gap-1">
                  <Building className="w-3.5 h-3.5" /> {viewAdvert.category}
                </span>
                <span className="flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5" /> {viewAdvert.duration}
                </span>
                <span className="flex items-center gap-1">
                  <Eye className="w-3.5 h-3.5" /> {viewAdvert.views.toLocaleString()} views
                </span>
                <span className="flex items-center gap-1">
                  <TrendingUp className="w-3.5 h-3.5" /> {viewAdvert.clicks} users clicked
                </span>
              </div>
              <p className="text-sm text-gray-700 mt-4 leading-relaxed whitespace-pre-wrap">{viewAdvert.description}</p>

              <div className="mt-6 flex flex-wrap gap-2">
                {user?.id !== viewAdvert.ownerId && (
                  <button
                    onClick={() => handleChatAdvert(viewAdvert)}
                    className="inline-flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium px-4 py-2.5 rounded-lg transition-colors"
                  >
                    <MessageCircle className="w-4 h-4" /> Chat with Business
                  </button>
                )}
                {viewAdvert.phone && (
                  <a
                    href={`tel:${viewAdvert.phone}`}
                    onClick={() => handleAdvertContact(viewAdvert, () => {})}
                    className="inline-flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium px-4 py-2.5 rounded-lg transition-colors"
                  >
                    <Phone className="w-4 h-4" /> Call
                  </a>
                )}
                {viewAdvert.website && (
                  <a
                    href={viewAdvert.website}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={() => handleAdvertContact(viewAdvert, () => {})}
                    className="inline-flex items-center gap-1.5 bg-blue-700 hover:bg-blue-800 text-white text-sm font-medium px-4 py-2.5 rounded-lg transition-colors"
                  >
                    <Globe className="w-4 h-4" /> Visit Website
                  </a>
                )}
                {viewAdvert.email && (
                  <a
                    href={`mailto:${viewAdvert.email}`}
                    onClick={() => handleAdvertContact(viewAdvert, () => {})}
                    className="inline-flex items-center gap-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm font-medium px-4 py-2.5 rounded-lg transition-colors"
                  >
                    <Mail className="w-4 h-4" /> Email
                  </a>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Edit Advert Modal ── */}
      {editingAdvert && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 overflow-y-auto">
          <div className="w-full max-w-lg bg-white rounded-2xl shadow-2xl p-6 max-h-[calc(100vh-3rem)] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold text-gray-900">Edit Advert</h2>
              <button
                onClick={() => setEditingAdvert(null)}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                aria-label="Close edit form"
              >
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>
            <form onSubmit={handleSaveEdit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Business Name *</label>
                <input
                  type="text"
                  required
                  value={editForm.businessName}
                  onChange={(e) => setEditForm({ ...editForm, businessName: e.target.value })}
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                  placeholder="Your business name"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Advert Title *</label>
                <input
                  type="text"
                  required
                  value={editForm.title}
                  onChange={(e) => setEditForm({ ...editForm, title: e.target.value })}
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                  placeholder="Catchy headline for your advert"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Description *</label>
                <textarea
                  required
                  rows={3}
                  value={editForm.description}
                  onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none resize-none"
                  placeholder="Describe your product or service..."
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Business Picture</label>
                <div className="flex items-center gap-3">
                  {(editForm.imageUrl || editImageFile) && (
                    <img
                      src={editImageFile ? URL.createObjectURL(editImageFile) : editForm.imageUrl}
                      alt="Business preview"
                      className="w-20 h-20 rounded-lg object-cover border border-gray-200"
                    />
                  )}
                  <label className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 border border-dashed border-gray-300 rounded-lg text-sm text-gray-600 hover:bg-gray-50 cursor-pointer">
                    <ImagePlus className="w-4 h-4" />
                    {editForm.imageUrl || editImageFile ? 'Change picture' : 'Upload business picture'}
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0] || null;
                        setEditImageFile(file);
                        if (file) setEditForm({ ...editForm, imageUrl: '' });
                      }}
                    />
                  </label>
                </div>
                <p className="text-xs text-gray-400 mt-1">Recommended size: 1220 × 434 pixels.</p>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
                  <input
                    type="tel"
                    value={editForm.phone}
                    onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })}
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                    placeholder="0801 234 5678"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Website</label>
                  <input
                    type="url"
                    value={editForm.website}
                    onChange={(e) => setEditForm({ ...editForm, website: e.target.value })}
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                    placeholder="https://..."
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Contact Email</label>
                <input
                  type="email"
                  value={editForm.email}
                  onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                  placeholder="contact@business.com"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Category *</label>
                  <select
                    required
                    value={editForm.category}
                    onChange={(e) => setEditForm({ ...editForm, category: e.target.value })}
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
                    value={editForm.package}
                    onChange={(e) => setEditForm({ ...editForm, package: e.target.value })}
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                  >
                    <option value="">Select...</option>
                    {adPackages.map(pkg => (
                      <option key={pkg.name} value={pkg.name}>{pkg.name}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="flex items-center gap-3 p-3 bg-amber-50 rounded-lg border border-amber-200">
                <input
                  type="checkbox"
                  id="edit-featured"
                  checked={editForm.featured}
                  onChange={(e) => setEditForm({ ...editForm, featured: e.target.checked })}
                  className="w-5 h-5 rounded text-amber-500 focus:ring-amber-500"
                />
                <label htmlFor="edit-featured" className="text-sm">
                  <span className="font-medium text-gray-900">Featured placement</span>
                  <br />
                  <span className="text-gray-600">Your advert gets priority positioning</span>
                </label>
              </div>
              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setEditingAdvert(null)}
                  className="flex-1 py-2.5 border border-gray-300 rounded-lg font-medium text-gray-700 hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingEdit}
                  className="flex-1 py-2.5 bg-blue-700 text-white rounded-lg font-medium hover:bg-blue-800 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {savingEdit ? 'Saving...' : 'Save Changes'}
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
