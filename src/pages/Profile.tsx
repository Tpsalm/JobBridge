import { useState, useEffect, useMemo, useRef } from 'react';
import Header from '../components/Header';
import BottomNav from '../components/BottomNav';
import { useAuth } from '../contexts/AuthContext';
import { updateProfile, fetchProfile } from '../lib/supabaseQueries';
import { supabase } from '../lib/supabase';
import { Camera, Check, ChevronRight, Lock, Shield, AlertTriangle, Upload, Loader, Eye, EyeOff, Trash2, Sliders, RefreshCw, Pencil, Eye as EyeIcon, Users, Briefcase, Settings, LogOut, HelpCircle, ArrowRight, ExternalLink, MessageCircle, TrendingUp, Star } from 'lucide-react';
import { IMG } from '../lib/media';

type ProfileField = keyof typeof PROFILE_FIELDS;

const PROFILE_FIELDS = {
  full_name: { label: 'Full Name', section: 'personal', weight: 2 },
  phone: { label: 'Phone Number', section: 'personal', weight: 1 },
  date_of_birth: { label: 'Date of Birth', section: 'personal', weight: 1 },
  gender: { label: 'Gender', section: 'personal', weight: 1 },
  location: { label: 'Location', section: 'personal', weight: 1 },
  professional_headline: { label: 'Professional Headline', section: 'professional', weight: 2 },
  years_of_experience: { label: 'Years of Experience', section: 'professional', weight: 1 },
  function: { label: 'Function / Industry', section: 'professional', weight: 1 },
  work_type: { label: 'Preferred Work Type', section: 'professional', weight: 1 },
  highest_qualification: { label: 'Highest Qualification', section: 'professional', weight: 1 },
  availability: { label: 'Availability', section: 'professional', weight: 1 },
  salary_expectation: { label: 'Salary Expectation', section: 'professional', weight: 1 },
  bio: { label: 'Bio / About', section: 'professional', weight: 2 },
  is_disabled: { label: 'Disability Status', section: 'inclusion', weight: 1 },
  is_displaced: { label: 'Displaced Person Status', section: 'inclusion', weight: 1 },
  specialty: { label: 'Service Specialty (Providers)', section: 'provider', weight: 2 },
  hourly_rate: { label: 'Hourly Rate (NGN)', section: 'provider', weight: 1 },
  skills: { label: 'Skills (comma-separated)', section: 'provider', weight: 1 },
};

// Mock recommendations data for the right sidebar
const MOCK_RECOMMENDATIONS = [
  {
    id: 1,
    title: 'Job Referrals!',
    description: 'A community to share strategy and seek advice on networking and building professional connections',
    image: 'https://api.dicebear.com/7.x/avataaars/svg?seed=JobBridge1',
    members: '1M'
  },
  {
    id: 2,
    title: 'The Worklife Bowl',
    description: 'A place for professionals from any industry to come together and discuss the day-to-day',
    image: 'https://api.dicebear.com/7.x/avataaars/svg?seed=JobBridge2',
    members: '12M'
  },
  {
    id: 3,
    title: 'New York City',
    description: 'To help NYC residents as well as visitors discover what the city has to offer!',
    image: 'https://api.dicebear.com/7.x/avataaars/svg?seed=JobBridge3',
    members: '248K'
  },
  {
    id: 4,
    title: 'Career Advice for Students',
    description: 'A place for students to ask questions and get advice from working professionals.',
    image: 'https://api.dicebear.com/7.x/avataaars/svg?seed=JobBridge4',
    members: '4M'
  },
  {
    id: 5,
    title: 'Personal Investment Chatter',
    description: 'Offer questions and experiences related to personal finance and investments.',
    image: 'https://api.dicebear.com/7.x/avataaars/svg?seed=JobBridge5',
    members: '546K'
  }
];

export default function Profile() {
  const { user, profile: userProfile } = useAuth();
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<Record<string, string>>({});
  const [passwordForm, setPasswordForm] = useState({ current: '', newPass: '', confirm: '' });
  const [showPasswords, setShowPasswords] = useState(false);
  const [passwordMsg, setPasswordMsg] = useState('');
  const [activeTab, setActiveTab] = useState('edit'); // 'view', 'edit', 'settings', etc.
  const [profileLoading, setProfileLoading] = useState(true);
  const profRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    async function loadProfile() {
      if (!user) { setProfileLoading(false); return; }
      setProfileLoading(true);
      const fresh = await fetchProfile(user.id);
      if (fresh) {
        const fields: Record<string, string> = {};
        Object.keys(PROFILE_FIELDS).forEach(key => {
          const val = (fresh as any)[key];
          if (key === 'skills' && Array.isArray(val)) {
            fields[key] = val.join(', ');
          } else {
            fields[key] = val || '';
          }
        });
        fields.avatar_url = (fresh as any).avatar_url || '';
        fields.email = fresh.email || user?.email || '';
        setForm(fields);
      } else {
        setForm({
          full_name: user.user_metadata?.full_name || '',
          email: user.email || '',
          phone: '', date_of_birth: '', gender: '', location: '',
          professional_headline: '', years_of_experience: '', function: '',
          work_type: '', highest_qualification: '', availability: '',
          salary_expectation: '', bio: '', specialty: '', hourly_rate: '', skills: '',
          avatar_url: '',
        });
      }
      setProfileLoading(false);
    }
    loadProfile();
  }, [user]);

  const activeFields = useMemo(() => {
    return Object.entries(PROFILE_FIELDS).filter(([key]) => {
      if (['specialty', 'hourly_rate', 'skills'].includes(key)) return userProfile?.role === 'provider';
      return true;
    });
  }, [userProfile?.role]);

  const updateField = (field: string, value: string) => setForm(prev => ({ ...prev, [field]: value }));

  const handleSave = async () => {
    if (!user) return;
    setSaving(true);
    try {
      const updates: Record<string, any> = { updated_at: new Date().toISOString() };
      activeFields.forEach(([key]) => {
        if (key === 'skills') {
          updates[key] = (form[key] || '').split(',').map((s: string) => s.trim()).filter(Boolean);
        } else {
          updates[key] = form[key] || null;
        }
      });
      if ('avatar_url' in form && form.avatar_url) updates.avatar_url = form.avatar_url;
      else if ('avatar_url' in form && !form.avatar_url) updates.avatar_url = null;
      await updateProfile(user.id, updates as any);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
      setTimeout(() => profRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 300);
    } catch (err: any) {
      console.error('Save error:', err);
      alert(err.message || 'Failed to save profile');
    } finally {
      setSaving(false);
    }
  };

  const handlePasswordChange = async () => {
    setPasswordMsg('');
    if (!passwordForm.current || !passwordForm.newPass) {
      setPasswordMsg('Fill in all password fields');
      return;
    }
    if (passwordForm.newPass !== passwordForm.confirm) {
      setPasswordMsg('Passwords do not match');
      return;
    }
    if (passwordForm.newPass.length < 6) {
      setPasswordMsg('Password must be at least 6 characters');
      return;
    }
    const { error } = await supabase.auth.updateUser({ password: passwordForm.newPass });
    if (error) {
      setPasswordMsg(error.message);
    } else {
      setPasswordMsg('Password updated successfully');
      setPasswordForm({ current: '', newPass: '', confirm: '' });
    }
  };

  const renderSelect = (field: string, label: string, options: string[]) => (
    <div className="mb-4">
      <label className="block text-sm font-medium text-gray-800 mb-1">{label}</label>
      <select value={form[field] || ''} onChange={e => updateField(field, e.target.value)}
        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-gray-500 bg-white text-sm">
        <option value="">Select...</option>
        {options.map(o => <option key={o} value={o}>{o}</option>)}
      </select>
    </div>
  );

  const renderInput = (field: string, label: string, type = 'text', placeholder?: string, readOnly?: boolean) => (
    <div className="mb-4">
      <label className="block text-sm font-medium text-gray-800 mb-1">{label}</label>
      <input type={type} value={form[field] || ''} onChange={e => updateField(field, e.target.value)}
        placeholder={placeholder} readOnly={readOnly}
        className={`w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-gray-500 text-sm ${readOnly ? 'bg-gray-50 text-gray-500' : ''}`} />
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />

      <div className="max-w-7xl mx-auto px-4 py-6">
        {/* Main 3-column layout */}
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          
          {/* Left Sidebar: Profile & Navigation */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-xl shadow-sm p-4 mb-4">
              {/* Profile Card */}
              <div className="flex items-center gap-3 mb-6">
                <div className="relative">
                  <img 
                    src={form.avatar_url || 'https://api.dicebear.com/7.x/avataaars/svg?seed=Samuel'} 
                    alt="Profile"
                    className="w-14 h-14 rounded-full object-cover"
                  />
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <h3 className="font-bold text-gray-900">{form.full_name || 'Your Name'}</h3>
                    <button className="text-gray-500 hover:text-gray-700">
                      <Pencil className="w-4 h-4" />
                    </button>
                  </div>
                  <p className="text-xs text-gray-600">{form.professional_headline || 'Senior Data Scientist'}</p>
                  <p className="text-xs text-gray-500">{form.location || 'London'}</p>
                </div>
              </div>

              {/* Navigation Links */}
              <nav className="space-y-1">
                <div className="pt-2 border-t border-gray-100">
                  <p className="text-xs font-semibold text-gray-500 mb-2 px-2">Job seeking</p>
                  <button className="w-full text-left px-2 py-2 rounded-md hover:bg-gray-50 text-sm flex items-center gap-2 text-gray-700">
                    <EyeIcon className="w-4 h-4" />
                    Hiring employers can find you
                    <ChevronRight className="w-4 h-4 ml-auto text-gray-400" />
                  </button>
                  <button className="w-full text-left px-2 py-2 rounded-md hover:bg-gray-50 text-sm flex items-center gap-2 text-gray-700">
                    Resume & experience
                  </button>
                  <button className="w-full text-left px-2 py-2 rounded-md hover:bg-gray-50 text-sm flex items-center gap-2 text-gray-700">
                    Job preferences
                  </button>
                  <button className="w-full text-left px-2 py-2 rounded-md hover:bg-gray-50 text-sm flex items-center gap-2 text-gray-700">
                    Job activity
                  </button>
                </div>

                <div className="pt-4 mt-2 border-t border-gray-100">
                  <p className="text-xs font-semibold text-gray-500 mb-2 px-2">Community & conversations</p>
                  <button className="w-full text-left px-2 py-2 rounded-md hover:bg-gray-50 text-sm flex items-center gap-2 text-gray-700">
                    Following
                  </button>
                </div>

                <div className="pt-4 mt-2 border-t border-gray-100">
                  <p className="text-xs font-semibold text-gray-500 mb-2 px-2">Help other job seekers</p>
                  <button className="w-full text-left px-2 py-2 rounded-md hover:bg-gray-50 text-sm flex items-center gap-2 text-gray-700">
                    Reviews & contributions
                  </button>
                </div>

                <div className="pt-4 mt-2 border-t border-gray-100">
                  <p className="text-xs font-semibold text-gray-500 mb-2 px-2">Manage account</p>
                  <button className="w-full text-left px-2 py-2 rounded-md hover:bg-gray-50 text-sm flex items-center gap-2 text-gray-700">
                    Account settings
                  </button>
                  <button className="w-full text-left px-2 py-2 rounded-md hover:bg-gray-50 text-sm flex items-center gap-2 text-gray-700">
                    Notifications
                  </button>
                  <button className="w-full text-left px-2 py-2 rounded-md hover:bg-gray-50 text-sm flex items-center gap-2 text-gray-700">
                    <LogOut className="w-4 h-4" />
                    Sign out
                    <ExternalLink className="w-4 h-4 ml-auto text-gray-400" />
                  </button>
                </div>

                <div className="pt-4 mt-2">
                  <button className="w-full py-2 border border-black rounded-md text-sm font-semibold hover:bg-gray-50">
                    Help Center
                  </button>
                </div>
              </nav>
            </div>
          </div>

          {/* Middle: Profile Edit Form */}
          <div className="lg:col-span-2">
            <div className="bg-white rounded-xl shadow-sm overflow-hidden">
              {/* Header with illustration */}
              <div className="bg-gray-50 p-6 flex justify-center border-b border-gray-100">
                <img 
                  src="https://illustrations.popsy.co/gray/creative-writing.svg" 
                  alt="Profile"
                  className="h-32"
                />
              </div>

              {/* Profile Avatar & Form */}
              <div className="p-6">
                <div className="flex flex-col items-center mb-8">
                  <div className="relative mb-2">
                    <img 
                      src={form.avatar_url || 'https://api.dicebear.com/7.x/avataaars/svg?seed=Samuel'} 
                      alt="Profile"
                      className="w-24 h-24 rounded-full object-cover"
                    />
                    <button className="absolute bottom-0 right-0 bg-white rounded-full p-1 shadow-sm border border-gray-100">
                      <Check className="w-4 h-4 text-gray-700" />
                    </button>
                  </div>
                </div>

                <div className="max-w-md mx-auto space-y-4">
                  {renderInput('full_name', 'First Name')}
                  {/* Last name - we'll just use the same field for now */}
                  <div className="mb-4">
                    <label className="block text-sm font-medium text-gray-800 mb-1">Last Name</label>
                    <input type="text" value={form.full_name?.split(' ')[1] || ''} onChange={e => updateField('full_name', `${form.full_name?.split(' ')[0] || ''} ${e.target.value}`)}
                      placeholder="Last Name"
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-gray-500 text-sm" />
                  </div>
                  {renderSelect('is_disabled' as any, 'Employment status', ['Not Employed', 'Employed', 'Looking for work'])}
                  {renderInput('professional_headline', 'Most recent job title')}
                  {renderInput('location', 'Location')}
                  {renderSelect('function', 'Primary industry', [
                    'Tech', 'Finance', 'Healthcare', 'Education', 'Marketing', 'Other'
                  ])}
                  {renderSelect('specialty' as any, 'Specialization', [
                    'Data Science', 'Software Engineering', 'UX Design', 'Product Management', 'Other'
                  ])}

                  <div className="pt-4">
                    <p className="text-xs text-gray-500 flex items-center justify-center gap-2 mb-4">
                      <RefreshCw className="w-3 h-3" />
                      This data syncs between JobBridge and Indeed
                    </p>
                    <button onClick={handleSave} disabled={saving}
                      className={`w-full py-3 rounded-md text-sm font-semibold transition-colors flex items-center justify-center gap-2 ${
                        Object.values(form).some(v => v?.trim()) 
                          ? 'bg-black text-white hover:bg-gray-800' 
                          : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                      }`}
                    >
                      {saving ? (
                        <><Loader className="w-4 h-4 animate-spin" /> Saving...</>
                      ) : saveSuccess ? (
                        <><Check className="w-4 h-4" /> Saved!</>
                      ) : (
                        'Save'
                      )}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Right Sidebar: Recommendations */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-xl shadow-sm p-4">
              <h3 className="font-bold text-gray-800 mb-1">Bowls for you</h3>
              <a href="#" className="text-sm text-green-600 font-semibold flex items-center gap-1 mb-4 hover:text-green-700">
                Explore all Bowls <ArrowRight className="w-3 h-3" />
              </a>

              <div className="space-y-4">
                {MOCK_RECOMMENDATIONS.map(bowl => (
                  <div key={bowl.id} className="flex gap-3">
                    <img 
                      src={bowl.image} 
                      alt={bowl.title}
                      className="w-10 h-10 rounded-full flex-shrink-0"
                    />
                    <div className="flex-1">
                      <h4 className="text-sm font-semibold text-gray-900">{bowl.title}</h4>
                      <p className="text-xs text-gray-500 line-clamp-2 mb-2">{bowl.description}</p>
                      <div className="flex items-center gap-2">
                        <button className="px-3 py-1 border border-gray-300 rounded-md text-xs font-semibold text-gray-700 hover:bg-gray-50">
                          View
                        </button>
                        <button className="px-3 py-1 bg-white border border-gray-300 rounded-md text-xs font-semibold text-gray-700 hover:bg-gray-50">
                          Join
                        </button>
                      </div>
                    </div>
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
