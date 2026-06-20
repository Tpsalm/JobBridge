import { useState } from 'react';
import Header from '../components/Header';
import BottomNav from '../components/BottomNav';
import { useModal } from '../contexts/ModalContext';
import { Menu, Check, AlertTriangle, Download, Eye, Lock, Bell, Shield, Crown, Trash2, LogOut, Camera } from 'lucide-react';
import { IMG } from '../lib/media';

export default function Settings() {
  const { openModal } = useModal();
  const [activeSection, setActiveSection] = useState('profile');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Profile form state
  const [profile, setProfile] = useState({
    name: 'John Doe',
    email: 'john@example.com',
    phone: '+1 (555) 123-4567',
    title: 'Senior Product Manager',
    location: 'San Francisco, CA',
    bio: 'Passionate about building products that solve real problems. 10+ years in tech.',
  });

  // Notification toggles
  const [notifications, setNotifications] = useState({
    jobMatches: true,
    applicationUpdates: true,
    messages: true,
    weeklyDigest: false,
    marketingEmails: false,
    smsAlerts: false,
  });

  // Privacy settings
  const [privacy, setPrivacy] = useState({
    visibility: 'connections',
    searchVisibility: true,
    recruiterContact: true,
    activityStatus: false,
  });

  // Connected apps
  const [connectedApps, setConnectedApps] = useState({
    google: true,
    linkedin: true,
  });

  // Dark mode state (persisted to localStorage)
  const [darkMode, setDarkMode] = useState<boolean>(() => {
    try {
      return localStorage.getItem('darkMode') === 'true';
    } catch (e) {
      return false;
    }
  });

  const sections = [
    { id: 'profile', label: 'Profile', icon: '👤' },
    { id: 'account', label: 'Account', icon: '🔐' },
    { id: 'notifications', label: 'Notifications', icon: '🔔' },
    { id: 'privacy', label: 'Privacy', icon: '🛡️' },
    { id: 'premium', label: 'Premium', icon: '👑' },
    { id: 'danger', label: 'Danger Zone', icon: '⚠️' },
  ];

  const handleSaveProfile = () => {
    setSaveSuccess(true);
    setTimeout(() => setSaveSuccess(false), 3000);
  };

  const toggleNotification = (key: keyof typeof notifications) => {
    setNotifications(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const togglePrivacy = (key: keyof typeof privacy) => {
    if (key === 'visibility') return;
    setPrivacy(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const disconnectApp = (app: 'google' | 'linkedin') => {
    setConnectedApps(prev => ({ ...prev, [app]: false }));
  };

  const renderToggle = (checked: boolean, onChange: () => void) => (
    <button
      onClick={onChange}
      className={`relative w-11 h-6 rounded-full transition-all ${checked ? 'bg-blue-700' : 'bg-gray-300'}`}
    >
      <div
        className={`absolute top-0.5 w-5 h-5 rounded-full bg-white transition-transform ${checked ? 'translate-x-5' : 'translate-x-0'}`}
      />
    </button>
  );

  return (
    <div className="min-h-screen bg-stone-50">
      <Header />

      <div className="flex flex-1 max-w-7xl mx-auto w-full">
        {/* Sidebar */}
        <div
          className={`fixed inset-0 z-30 bg-black/50 lg:hidden transition-opacity ${
            sidebarOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'
          }`}
          onClick={() => setSidebarOpen(false)}
        />

        <div
          className={`fixed lg:relative left-0 top-0 h-screen z-40 w-64 bg-white border-r border-gray-200 overflow-y-auto transition-transform lg:translate-x-0 ${
            sidebarOpen ? 'translate-x-0' : '-translate-x-full'
          }`}
        >
          <div className="p-6 lg:pt-0">
            {/* Mobile close button */}
            <button
              onClick={() => setSidebarOpen(false)}
              className="lg:hidden absolute top-4 right-4 text-gray-500 hover:text-gray-700"
            >
              ✕
            </button>

            <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-4 mt-8 lg:mt-0">Settings</h3>
            <nav className="space-y-1">
              {sections.map(section => (
                <button
                  key={section.id}
                  onClick={() => {
                    setActiveSection(section.id);
                    setSidebarOpen(false);
                  }}
                  className={`w-full text-left px-4 py-3 rounded-lg font-medium transition-all ${
                    activeSection === section.id
                      ? 'bg-blue-50 text-blue-700 border-l-4 border-blue-700'
                      : 'text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  <span className="mr-2">{section.icon}</span>
                  {section.label}
                </button>
              ))}
            </nav>
          </div>
        </div>

        {/* Main Content */}
        <div className="flex-1 px-4 sm:px-6 py-8 w-full lg:w-auto">
          {/* Mobile sidebar toggle */}
          <button
            onClick={() => setSidebarOpen(true)}
            className="lg:hidden flex items-center gap-2 text-gray-700 font-medium mb-6 bg-white px-4 py-2 rounded-lg border border-gray-200"
          >
            <Menu className="w-4 h-4" /> Sections
          </button>

          {/* Profile Section */}
          {activeSection === 'profile' && (
            <div>
              {/* Profile cover & avatar */}
              <div className="relative rounded-2xl overflow-hidden mb-8 h-40 sm:h-48">
                <img src={IMG.profile.cover} alt="" className="w-full h-full object-cover" />
                <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent" />
                <div className="absolute -bottom-10 left-6">
                  <div className="relative">
                    <img
                      src={IMG.profile.default}
                      alt="Profile"
                      className="w-20 h-20 rounded-full object-cover border-4 border-white shadow-lg"
                    />
                    <button className="absolute bottom-0 right-0 w-7 h-7 bg-blue-700 text-white rounded-full flex items-center justify-center shadow-md hover:bg-blue-800 transition-colors">
                      <Camera className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>

              <div className="mb-8 pt-6">
                <h1 className="text-3xl font-bold text-gray-900">Profile Settings</h1>
                <p className="text-gray-500 mt-1">Update your personal information</p>
              </div>

              <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm space-y-5">
                {saveSuccess && (
                  <div className="flex items-center gap-3 bg-emerald-50 border border-emerald-200 rounded-lg px-4 py-3">
                    <Check className="w-5 h-5 text-emerald-600" />
                    <span className="text-sm font-medium text-emerald-700">Changes saved successfully!</span>
                  </div>
                )}

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Full Name</label>
                  <input
                    type="text"
                    value={profile.name}
                    onChange={e => setProfile({ ...profile, name: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-700"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                  <input
                    type="email"
                    value={profile.email}
                    onChange={e => setProfile({ ...profile, email: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-700"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
                  <input
                    type="tel"
                    value={profile.phone}
                    onChange={e => setProfile({ ...profile, phone: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-700"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Job Title</label>
                  <input
                    type="text"
                    value={profile.title}
                    onChange={e => setProfile({ ...profile, title: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-700"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Location</label>
                  <input
                    type="text"
                    value={profile.location}
                    onChange={e => setProfile({ ...profile, location: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-700"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Bio</label>
                  <textarea
                    value={profile.bio}
                    onChange={e => setProfile({ ...profile, bio: e.target.value })}
                    rows={4}
                    className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-700"
                  />
                </div>

                <button
                  onClick={handleSaveProfile}
                  className="w-full bg-blue-700 text-white font-semibold py-2 rounded-lg hover:bg-blue-800 transition-colors"
                >
                  Save Changes
                </button>
              </div>
            </div>
          )}

          {/* Account Section */}
          {activeSection === 'account' && (
            <div>
              <div className="mb-8">
                <h1 className="text-3xl font-bold text-gray-900">Account Settings</h1>
                <p className="text-gray-500 mt-1">Manage your password and connected apps</p>
              </div>

              {/* Password Change */}
              <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm mb-6">
                <h2 className="text-lg font-bold text-gray-900 mb-5">Change Password</h2>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Current Password</label>
                    <input
                      type="password"
                      placeholder="••••••••"
                      className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-700"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">New Password</label>
                    <input
                      type="password"
                      placeholder="••••••••"
                      className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-700"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Confirm New Password</label>
                    <input
                      type="password"
                      placeholder="••••••••"
                      className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-700"
                    />
                  </div>
                  <button className="w-full bg-blue-700 text-white font-semibold py-2 rounded-lg hover:bg-blue-800 transition-colors">
                    Update Password
                  </button>
                </div>
              </div>

              {/* Connected Apps */}
              <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm">
                <h2 className="text-lg font-bold text-gray-900 mb-5">Connected Apps</h2>
                <div className="space-y-3">
                  {connectedApps.google && (
                    <div className="flex items-center justify-between p-4 border border-gray-200 rounded-lg">
                      <div>
                        <p className="font-medium text-gray-900">Google</p>
                        <p className="text-xs text-gray-500 mt-0.5">john@gmail.com</p>
                      </div>
                      <button
                        onClick={() => disconnectApp('google')}
                        className="px-4 py-1.5 text-red-600 hover:bg-red-50 rounded-lg transition-colors text-sm font-medium"
                      >
                        Disconnect
                      </button>
                    </div>
                  )}
                  {connectedApps.linkedin && (
                    <div className="flex items-center justify-between p-4 border border-gray-200 rounded-lg">
                      <div>
                        <p className="font-medium text-gray-900">LinkedIn</p>
                        <p className="text-xs text-gray-500 mt-0.5">john-doe</p>
                      </div>
                      <button
                        onClick={() => disconnectApp('linkedin')}
                        className="px-4 py-1.5 text-red-600 hover:bg-red-50 rounded-lg transition-colors text-sm font-medium"
                      >
                        Disconnect
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Notifications Section */}
          {activeSection === 'notifications' && (
            <div>
              <div className="mb-8">
                <h1 className="text-3xl font-bold text-gray-900">Notification Preferences</h1>
                <p className="text-gray-500 mt-1">Choose what notifications you want to receive</p>
              </div>

              <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm space-y-5">
                <div className="flex items-center justify-between pb-5 border-b border-gray-100">
                  <div>
                    <p className="font-medium text-gray-900">Job Matches</p>
                    <p className="text-sm text-gray-500 mt-0.5">Get notified when new jobs match your profile</p>
                  </div>
                  {renderToggle(notifications.jobMatches, () => toggleNotification('jobMatches'))}
                </div>

                <div className="flex items-center justify-between pb-5 border-b border-gray-100">
                  <div>
                    <p className="font-medium text-gray-900">Application Updates</p>
                    <p className="text-sm text-gray-500 mt-0.5">Updates on your submitted applications</p>
                  </div>
                  {renderToggle(notifications.applicationUpdates, () => toggleNotification('applicationUpdates'))}
                </div>

                <div className="flex items-center justify-between pb-5 border-b border-gray-100">
                  <div>
                    <p className="font-medium text-gray-900">Messages</p>
                    <p className="text-sm text-gray-500 mt-0.5">New messages from employers</p>
                  </div>
                  {renderToggle(notifications.messages, () => toggleNotification('messages'))}
                </div>

                <div className="flex items-center justify-between pb-5 border-b border-gray-100">
                  <div>
                    <p className="font-medium text-gray-900">Weekly Digest</p>
                    <p className="text-sm text-gray-500 mt-0.5">Weekly summary of opportunities</p>
                  </div>
                  {renderToggle(notifications.weeklyDigest, () => toggleNotification('weeklyDigest'))}
                </div>

                <div className="flex items-center justify-between pb-5 border-b border-gray-100">
                  <div>
                    <p className="font-medium text-gray-900">Marketing Emails</p>
                    <p className="text-sm text-gray-500 mt-0.5">Updates about new features and promotions</p>
                  </div>
                  {renderToggle(notifications.marketingEmails, () => toggleNotification('marketingEmails'))}
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium text-gray-900">SMS Alerts</p>
                    <p className="text-sm text-gray-500 mt-0.5">Urgent notifications via SMS</p>
                  </div>
                  {renderToggle(notifications.smsAlerts, () => toggleNotification('smsAlerts'))}
                </div>
              </div>
            </div>
          )}

          {/* Privacy Section */}
          {activeSection === 'privacy' && (
            <div>
              <div className="mb-8">
                <h1 className="text-3xl font-bold text-gray-900">Privacy Settings</h1>
                <p className="text-gray-500 mt-1">Control who can see your profile and information</p>
              </div>

              <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm space-y-6">
                <div className="pb-6 border-b border-gray-100">
                  <p className="font-medium text-gray-900 mb-4">Profile Visibility</p>
                  <div className="space-y-3">
                    {[
                      { value: 'public', label: 'Public', desc: 'Anyone can see your profile' },
                      { value: 'connections', label: 'Connections Only', desc: 'Only your connections can see your profile' },
                      { value: 'private', label: 'Private', desc: 'No one can see your profile' },
                    ].map(option => (
                      <label key={option.value} className="flex items-start gap-3 cursor-pointer">
                        <input
                          type="radio"
                          name="visibility"
                          value={option.value}
                          checked={privacy.visibility === option.value}
                          onChange={e => setPrivacy({ ...privacy, visibility: e.target.value })}
                          className="mt-1 w-4 h-4 text-blue-700 accent-blue-700"
                        />
                        <div>
                          <p className="font-medium text-gray-900">{option.label}</p>
                          <p className="text-sm text-gray-500">{option.desc}</p>
                        </div>
                      </label>
                    ))}
                  </div>
                </div>

                <div className="flex items-center justify-between pb-6 border-b border-gray-100">
                  <div>
                    <p className="font-medium text-gray-900">Show in Talent Search</p>
                    <p className="text-sm text-gray-500 mt-0.5">Appear in recruiter searches</p>
                  </div>
                  {renderToggle(privacy.searchVisibility, () => togglePrivacy('searchVisibility'))}
                </div>

                <div className="flex items-center justify-between pb-6 border-b border-gray-100">
                  <div>
                    <p className="font-medium text-gray-900">Allow Recruiters to Contact Me</p>
                    <p className="text-sm text-gray-500 mt-0.5">Recruiters can reach out through the platform</p>
                  </div>
                  {renderToggle(privacy.recruiterContact, () => togglePrivacy('recruiterContact'))}
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium text-gray-900">Share Activity Status</p>
                    <p className="text-sm text-gray-500 mt-0.5">Let others see when you're online</p>
                  </div>
                  {renderToggle(privacy.activityStatus, () => togglePrivacy('activityStatus'))}
                </div>
              </div>
            </div>
          )}

          {/* Premium Section */}
          {activeSection === 'premium' && (
            <div>
              <div className="mb-8">
                <h1 className="text-3xl font-bold text-gray-900">Premium Plan</h1>
                <p className="text-gray-500 mt-1">Upgrade your account for more features</p>
              </div>

              <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-2xl p-8 border border-blue-200 mb-8">
                <div className="flex items-center gap-3 mb-4">
                  <Crown className="w-8 h-8 text-blue-700" />
                  <div>
                    <p className="text-sm font-medium text-blue-700">CURRENT PLAN</p>
                    <h2 className="text-2xl font-bold text-blue-900">Free</h2>
                  </div>
                </div>
                <p className="text-blue-700 text-sm mb-6">You're currently using the free plan with basic features.</p>
                <button
                  onClick={() => openModal('premium')}
                  className="w-full bg-blue-700 text-white font-semibold py-3 rounded-xl hover:bg-blue-800 transition-colors"
                >
                  Upgrade to Premium
                </button>
              </div>

              <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm">
                <h3 className="font-bold text-lg text-gray-900 mb-6">Feature Comparison</h3>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-200">
                        <th className="text-left py-3 px-4 font-semibold text-gray-900">Feature</th>
                        <th className="text-center py-3 px-4 font-semibold text-gray-900">Free</th>
                        <th className="text-center py-3 px-4 font-semibold text-gray-900">Premium</th>
                      </tr>
                    </thead>
                    <tbody>
                      {[
                        { feature: 'Job Applications', free: '5/mo', premium: 'Unlimited' },
                        { feature: 'AI Job Matching', free: 'No', premium: 'Yes' },
                        { feature: 'Priority Support', free: 'No', premium: 'Yes' },
                        { feature: 'Advanced Analytics', free: 'No', premium: 'Yes' },
                        { feature: 'Profile Highlights', free: 'No', premium: 'Yes' },
                      ].map((row, i) => (
                        <tr key={i} className="border-b border-gray-100">
                          <td className="py-3 px-4 text-gray-700">{row.feature}</td>
                          <td className="text-center py-3 px-4 text-gray-500">{row.free}</td>
                          <td className="text-center py-3 px-4 font-medium text-blue-700">{row.premium}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* Danger Zone Section */}
          {activeSection === 'danger' && (
            <div>
              <div className="mb-8">
                <h1 className="text-3xl font-bold text-gray-900">Danger Zone</h1>
                <p className="text-gray-500 mt-1">Irreversible actions</p>
              </div>

              <div className="border-2 border-red-200 bg-red-50 rounded-2xl p-6 space-y-4">
                <div className="flex items-start gap-3">
                  <AlertTriangle className="w-6 h-6 text-red-600 mt-0.5 shrink-0" />
                  <div>
                    <h3 className="font-bold text-red-900">Delete Account</h3>
                    <p className="text-sm text-red-700 mt-1">
                      Permanently delete your account and all associated data. This action cannot be undone.
                    </p>
                  </div>
                </div>
                <button
                  onClick={() =>
                    openModal('info', {
                      title: 'Delete Account',
                      content:
                        'This action is permanent and cannot be undone. All your data, applications, and profile information will be permanently deleted. Please contact support@jobbridge.io if you need assistance.',
                    })
                  }
                  className="w-full flex items-center justify-center gap-2 bg-red-600 text-white font-semibold py-2 rounded-lg hover:bg-red-700 transition-colors"
                >
                  <Trash2 className="w-4 h-4" /> Delete Account
                </button>
              </div>
              
              {/* Dark mode toggle */}
              <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm mt-6">
                <div className="flex items-start gap-3">
                  <div>
                    <h3 className="font-bold text-gray-900">Theme</h3>
                    <p className="text-sm text-gray-500 mt-1">Switch between light and dark mode for the app.</p>
                  </div>
                </div>
                <div className="mt-4">
                  <button
                    onClick={() => {
                      const next = !darkMode;
                      setDarkMode(next);
                      try {
                        if (next) document.documentElement.classList.add('dark');
                        else document.documentElement.classList.remove('dark');
                        localStorage.setItem('darkMode', next ? 'true' : 'false');
                      } catch (e) {
                        // ignore
                      }
                    }}
                    className="w-full flex items-center justify-center gap-2 bg-blue-700 text-white font-semibold py-2 rounded-lg hover:bg-blue-800 transition-colors"
                  >
                    {darkMode ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
                  </button>
                </div>
              </div>

              <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm mt-6">
                <div className="flex items-start gap-3">
                  <Download className="w-6 h-6 text-blue-700 mt-0.5 shrink-0" />
                  <div>
                    <h3 className="font-bold text-gray-900">Export Data</h3>
                    <p className="text-sm text-gray-500 mt-1">Download a copy of your personal data in a portable format.</p>
                  </div>
                </div>
                <button className="w-full mt-4 flex items-center justify-center gap-2 bg-blue-700 text-white font-semibold py-2 rounded-lg hover:bg-blue-800 transition-colors">
                  <Download className="w-4 h-4" /> Export Data
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      <BottomNav />
    </div>
  );
}
