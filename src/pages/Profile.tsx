import { useState, useEffect, useMemo } from 'react';
import Header from '../components/Header';
import BottomNav from '../components/BottomNav';
import { useAuth } from '../contexts/AuthContext';
import { updateProfile } from '../lib/supabaseQueries';
import { supabase } from '../lib/supabase';
import { Camera, Check, ChevronRight, Lock, Shield, AlertTriangle } from 'lucide-react';
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
  specialty: { label: 'Service Specialty (Providers)', section: 'provider', weight: 2 },
  hourly_rate: { label: 'Hourly Rate (NGN)', section: 'provider', weight: 1 },
  skills: { label: 'Skills (comma-separated)', section: 'provider', weight: 1 },
};

const TOTAL_WEIGHT = Object.values(PROFILE_FIELDS).reduce((s, f) => s + f.weight, 0);

export default function Profile() {
  const { user, profile: userProfile } = useAuth();
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<Record<string, string>>({});
  const [passwordForm, setPasswordForm] = useState({ current: '', newPass: '', confirm: '' });
  const [passwordMsg, setPasswordMsg] = useState('');
  const [connectedApps] = useState({ google: true, linkedin: true });

  useEffect(() => {
    if (userProfile) {
      const fields: Record<string, string> = {};
      Object.keys(PROFILE_FIELDS).forEach(key => {
        const val = (userProfile as any)[key];
        if (key === 'skills' && Array.isArray(val)) {
          fields[key] = val.join(', ');
        } else {
          fields[key] = val || '';
        }
      });
      fields.email = userProfile.email || user?.email || '';
      setForm(fields);
    } else if (user) {
      setForm({
        full_name: user.user_metadata?.full_name || '',
        email: user.email || '',
        phone: '', date_of_birth: '', gender: '', location: '',
        professional_headline: '', years_of_experience: '', function: '',
        work_type: '', highest_qualification: '', availability: '',
        salary_expectation: '', bio: '', specialty: '', hourly_rate: '', skills: '',
      });
    }
  }, [userProfile, user]);

  const completedWeight = useMemo(() => {
    let w = 0;
    Object.entries(PROFILE_FIELDS).forEach(([key, field]) => {
      if (form[key]?.trim()) w += field.weight;
    });
    return w;
  }, [form]);

  const completionPct = Math.round((completedWeight / TOTAL_WEIGHT) * 100);

  const incompleteFields = useMemo(() => {
    return Object.entries(PROFILE_FIELDS)
      .filter(([key]) => !form[key]?.trim())
      .map(([, field]) => field.label);
  }, [form]);

  const updateField = (field: string, value: string) => setForm(prev => ({ ...prev, [field]: value }));

  const handleSave = async () => {
    if (!user) return;
    setSaving(true);
    try {
      const updates: Record<string, any> = { updated_at: new Date().toISOString() };
      Object.keys(PROFILE_FIELDS).forEach(key => {
        if (key === 'skills') {
          updates[key] = (form[key] || '').split(',').map((s: string) => s.trim()).filter(Boolean);
        } else {
          updates[key] = form[key] || null;
        }
      });
      delete updates.email;
      await updateProfile(user.id, updates as any);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err: any) {
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

  const personalFields = Object.entries(PROFILE_FIELDS).filter(([, f]) => f.section === 'personal');
  const professionalFields = Object.entries(PROFILE_FIELDS).filter(([, f]) => f.section === 'professional');

  const renderSelect = (field: string, label: string, options: string[]) => (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
      <select value={form[field] || ''} onChange={e => updateField(field, e.target.value)}
        className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-700 bg-white text-sm">
        <option value="">Select...</option>
        {options.map(o => <option key={o} value={o}>{o}</option>)}
      </select>
    </div>
  );

  const renderInput = (field: string, label: string, type = 'text', placeholder?: string) => (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
      <input type={type} value={form[field] || ''} onChange={e => updateField(field, e.target.value)}
        placeholder={placeholder}
        className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-700 text-sm" />
    </div>
  );

  const renderToggle = (checked: boolean) => (
    <div className={`relative w-11 h-6 rounded-full transition-all ${checked ? 'bg-blue-700' : 'bg-gray-300'}`}>
      <div className={`absolute top-0.5 w-5 h-5 rounded-full bg-white transition-transform ${checked ? 'translate-x-5' : 'translate-x-0'}`} />
    </div>
  );

  return (
    <div className="min-h-screen bg-stone-50">
      <Header />

      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8 pb-24">
        {/* Cover & Avatar */}
        <div className="relative rounded-2xl overflow-hidden mb-6 h-36 sm:h-44">
          <img src={IMG.profile.cover} alt="" className="w-full h-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent" />
          <div className="absolute -bottom-10 left-6">
            <div className="relative">
              <img src={IMG.profile.default} alt="Profile" className="w-20 h-20 rounded-full object-cover border-4 border-white shadow-lg" />
              <button className="absolute bottom-0 right-0 w-7 h-7 bg-blue-700 text-white rounded-full flex items-center justify-center shadow-md hover:bg-blue-800 transition-colors">
                <Camera className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>

        {/* Completeness Meter */}
        <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm mb-6">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-bold text-gray-900">Profile Completeness</h2>
            <span className="text-2xl font-bold text-blue-700">{completionPct}%</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-3 mb-4">
            <div className="bg-blue-700 h-3 rounded-full transition-all duration-500" style={{ width: `${completionPct}%` }} />
          </div>
          {incompleteFields.length > 0 && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
              <p className="text-sm font-semibold text-amber-800 mb-2">Complete your profile — add:</p>
              <ul className="space-y-1">
                {incompleteFields.slice(0, 5).map(f => (
                  <li key={f} className="text-sm text-amber-700 flex items-center gap-2">
                    <ChevronRight className="w-3 h-3 text-amber-500" /> {f}
                  </li>
                ))}
                {incompleteFields.length > 5 && (
                  <li className="text-sm text-amber-600">+{incompleteFields.length - 5} more</li>
                )}
              </ul>
            </div>
          )}
          {completionPct === 100 && (
            <div className="flex items-center gap-2 text-emerald-700 bg-emerald-50 rounded-xl p-4">
              <Check className="w-5 h-5" />
              <span className="text-sm font-semibold">Your profile is complete!</span>
            </div>
          )}
        </div>

        {/* Personal Information */}
        <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm mb-6">
          <h2 className="text-lg font-bold text-gray-900 mb-5">Personal Information</h2>
          <div className="space-y-4">
            {renderInput('full_name', 'Full Name')}
            {renderInput('email', 'Email', 'email')}
            {form.email && <p className="text-xs text-gray-400 -mt-3">Email cannot be changed here</p>}
            {renderInput('phone', 'Phone Number', 'tel')}
            {renderInput('date_of_birth', 'Date of Birth', 'date')}
            {renderSelect('gender', 'Gender', ['Male', 'Female'])}
            {renderInput('location', 'Location', 'text', 'City, State')}
          </div>
        </div>

        {/* Professional Information */}
        <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm mb-6">
          <h2 className="text-lg font-bold text-gray-900 mb-5">Professional Information</h2>
          <div className="space-y-4">
            {renderInput('professional_headline', 'Professional Headline', 'text', 'e.g. Senior Accountant')}
            {renderSelect('years_of_experience', 'Years of Experience', ['Entry (0-1)', '1-2', '3-5', '5-7', '7-10', '10+'])}
            {renderSelect('function', 'Function / Industry', [
              'Accounting', 'Administration', 'Banking & Finance', 'Customer Service',
              'Education', 'Engineering', 'Healthcare', 'Hospitality', 'Human Resources',
              'IT & Software', 'Legal', 'Logistics', 'Marketing', 'Operations', 'Sales', 'Security', 'Other'
            ])}
            {renderSelect('work_type', 'Preferred Work Type', ['Full-time', 'Part-time', 'Contract', 'Remote', 'Hybrid', 'Freelance'])}
            {renderSelect('highest_qualification', 'Highest Qualification', [
              'SSCE / O-Level', 'OND / Diploma', 'HND / Bachelors', "Master's", 'PhD',
              'Professional Certification', 'Vocational Training'
            ])}
            {renderSelect('availability', 'Availability', ['Immediately', '2 weeks', '1 month', 'Notice period'])}
            {renderInput('salary_expectation', 'Monthly Salary Expectation (NGN)', 'number')}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Bio / About</label>
              <textarea value={form.bio || ''} onChange={e => updateField('bio', e.target.value)} rows={4}
                placeholder="Tell employers about yourself..."
                className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-700 text-sm resize-none" />
            </div>
          </div>
        </div>

        {/* Provider Section */}
        {userProfile?.role === 'provider' && (
          <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm mb-6">
            <h2 className="text-lg font-bold text-gray-900 mb-5">Service Provider Profile</h2>
            <div className="space-y-4">
              {renderSelect('specialty', 'Service Specialty', [
                'Graphic Designer', 'UI/UX Designer', 'Web Developer', 'Mobile Developer',
                'Photographer', 'Content Writer', 'Digital Marketer', 'Financial Analyst',
                'Legal Consultant', 'Business Consultant',
              ])}
              {renderInput('hourly_rate', 'Hourly Rate (NGN)', 'number')}
              {renderInput('skills', 'Skills (comma-separated)', 'text', 'e.g. React, Node.js, UI Design')}
            </div>
          </div>
        )}

        {/* Inclusion Section */}
        <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm mb-6">
          <h2 className="text-lg font-bold text-gray-900 mb-2">Inclusion & Diversity</h2>
          <p className="text-sm text-gray-500 mb-5">This information helps us promote inclusive hiring. It will not affect your application.</p>
          <div className="space-y-4">
            {renderSelect('is_disabled', 'Do you have a disability?', ['No', 'Yes'])}
            {renderSelect('is_displaced', 'Are you an internally displaced person?', ['No', 'Yes'])}
            <div className="bg-blue-50 border border-blue-100 rounded-xl p-4">
              <p className="text-sm text-blue-700"><span className="font-semibold">Note:</span> Inclusion is our culture. We champion all talent: women, men, displaced, and PWDs.</p>
            </div>
          </div>
        </div>

        {/* Save Button */}
        <button onClick={handleSave} disabled={saving}
          className="w-full bg-blue-700 text-white font-semibold py-3 rounded-xl hover:bg-blue-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 text-base mb-6">
          {saving ? (
            <><span className="animate-spin w-5 h-5 border-2 border-white border-t-transparent rounded-full" /> Saving...</>
          ) : saveSuccess ? (
            <><Check className="w-5 h-5" /> Saved!</>
          ) : (
            'Save Profile'
          )}
        </button>

        {/* Account Settings */}
        <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm mb-6">
          <h2 className="text-lg font-bold text-gray-900 mb-5 flex items-center gap-2">
            <Lock className="w-5 h-5 text-gray-400" /> Account Security
          </h2>

          {/* Password Change */}
          <div className="space-y-4 mb-6 pb-6 border-b border-gray-100">
            <h3 className="font-semibold text-gray-800">Change Password</h3>
            <input type="password" value={passwordForm.current} onChange={e => setPasswordForm({ ...passwordForm, current: e.target.value })}
              placeholder="Current password" className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-700 text-sm" />
            <input type="password" value={passwordForm.newPass} onChange={e => setPasswordForm({ ...passwordForm, newPass: e.target.value })}
              placeholder="New password" className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-700 text-sm" />
            <input type="password" value={passwordForm.confirm} onChange={e => setPasswordForm({ ...passwordForm, confirm: e.target.value })}
              placeholder="Confirm new password" className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-700 text-sm" />
            {passwordMsg && (
              <p className={`text-sm font-medium ${passwordMsg.includes('success') ? 'text-emerald-600' : 'text-red-600'}`}>{passwordMsg}</p>
            )}
            <button onClick={handlePasswordChange}
              className="w-full bg-blue-700 text-white font-semibold py-2.5 rounded-lg hover:bg-blue-800 transition-colors text-sm">
              Update Password
            </button>
          </div>

          {/* 2FA */}
          <div className="mb-6 pb-6 border-b border-gray-100">
            <h3 className="font-semibold text-gray-800 mb-2 flex items-center gap-2">
              <Shield className="w-4 h-4 text-gray-400" /> Two-Factor Authentication (2FA)
            </h3>
            <p className="text-sm text-gray-500">2FA is managed by Supabase. Enable it in the Supabase dashboard under Authentication &gt; Providers &gt; MFA.</p>
          </div>

          {/* Connected Apps */}
          <div>
            <h3 className="font-semibold text-gray-800 mb-3">Connected Apps</h3>
            <div className="space-y-3">
              {connectedApps.google && (
                <div className="flex items-center justify-between p-4 border border-gray-200 rounded-lg">
                  <div>
                    <p className="font-medium text-gray-900">Google</p>
                    <p className="text-xs text-gray-500 mt-0.5">{user?.email}</p>
                  </div>
                  <span className="px-3 py-1 text-red-600 text-sm font-medium">Connected</span>
                </div>
              )}
              {connectedApps.linkedin && (
                <div className="flex items-center justify-between p-4 border border-gray-200 rounded-lg">
                  <div>
                    <p className="font-medium text-gray-900">LinkedIn</p>
                    <p className="text-xs text-gray-500 mt-0.5">Connected</p>
                  </div>
                  <span className="px-3 py-1 text-red-600 text-sm font-medium">Connected</span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Danger Zone */}
        <div className="border-2 border-red-200 bg-red-50 rounded-2xl p-6">
          <div className="flex items-start gap-3 mb-4">
            <AlertTriangle className="w-6 h-6 text-red-600 mt-0.5 shrink-0" />
            <div>
              <h3 className="font-bold text-red-900">Delete Account</h3>
              <p className="text-sm text-red-700 mt-1">Permanently delete your account and all associated data. This action cannot be undone.</p>
            </div>
          </div>
          <p className="text-sm text-red-600">Contact <span className="font-semibold">jobbridgeesupport@gmail.com</span> to request account deletion.</p>
        </div>
      </div>

      <BottomNav />
    </div>
  );
}
