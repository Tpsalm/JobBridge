import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../contexts/AuthContext';
import {
  adminFetchUsers, adminFetchJobs, adminFetchApplications,
  adminUpdateUserRole, adminToggleJobActive,
  adminFetchServiceProviders, adminFetchConversations,
  adminFetchMessages, adminFetchNotifications, adminFetchAdvertisements,
  adminDeleteProfile, adminUpdateProfile,
  adminDeleteJob, adminUpdateJob,
  adminDeleteApplication, adminUpdateApplication,
  adminDeleteConversation, adminDeleteMessage,
  adminDeleteNotification, adminCreateNotification,
  adminDeleteAdvertisement, adminUpdateAdvertisementStatus,
  adminVerifyProvider, adminDeleteServiceProvider,
} from '../lib/supabaseQueries';
import { supabase } from '../lib/supabase';
import {
  Shield, Users, Briefcase, CreditCard, Clock,
  Search, Ban, UserCheck, Trash2, DollarSign, Activity,
  RefreshCw, X, Check, Flag, Eye, MessageSquare, Bell,
  Megaphone, Star, Building, Mail, ChevronDown, ChevronUp,
  Download, Filter, Plus, Edit3, Loader,
} from 'lucide-react';
import Header from '../components/Header';

type TabType = 'dashboard' | 'users' | 'jobs' | 'applications' | 'providers' | 'messages' | 'ads' | 'notifications';

export default function AdminDashboard() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<TabType>('dashboard');
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  // Data states
  const [allUsers, setAllUsers] = useState<any[]>([]);
  const [jobs, setJobs] = useState<any[]>([]);
  const [applications, setApplications] = useState<any[]>([]);
  const [providers, setProviders] = useState<any[]>([]);
  const [conversations, setConversations] = useState<any[]>([]);
  const [messages, setMessages] = useState<any[]>([]);
  const [selectedConv, setSelectedConv] = useState<string | null>(null);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [advertisements, setAdvertisements] = useState<any[]>([]);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [sortField, setSortField] = useState('created_at');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');

  // Modals
  const [showUserModal, setShowUserModal] = useState<any>(null);
  const [showJobModal, setShowJobModal] = useState<any>(null);
  const [showAppModal, setShowAppModal] = useState<any>(null);
  const [showNotifModal, setShowNotifModal] = useState(false);
  const [notifForm, setNotifForm] = useState({ user_id: '', type: 'system', title: '', content: '' });
  const [confirmAction, setConfirmAction] = useState<{ title: string; message: string; action: () => Promise<void> } | null>(null);

  const notify = (message: string, type: 'success' | 'error' = 'success') => {
    const el = document.createElement('div');
    el.className = `fixed top-4 right-4 z-50 px-4 py-3 rounded-xl shadow-lg text-white text-sm font-medium transition-all duration-300 ${type === 'success' ? 'bg-emerald-600' : 'bg-red-600'}`;
    el.textContent = message;
    document.body.appendChild(el);
    setTimeout(() => { el.style.opacity = '0'; setTimeout(() => el.remove(), 300); }, 2500);
  };

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const [usersData, jobsData, appsData, providersData, convsData, notifsData, adsData] = await Promise.all([
        adminFetchUsers().catch(() => []),
        adminFetchJobs().catch(() => []),
        adminFetchApplications().catch(() => []),
        adminFetchServiceProviders().catch(() => []),
        adminFetchConversations().catch(() => []),
        adminFetchNotifications().catch(() => []),
        adminFetchAdvertisements().catch(() => []),
      ]);
      setAllUsers(usersData);
      setJobs(jobsData);
      setApplications(appsData);
      setProviders(providersData);
      setConversations(convsData);
      setNotifications(notifsData);
      setAdvertisements(adsData);
    } catch (e: any) {
      notify(e.message || 'Failed to fetch data', 'error');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const doAction = async (key: string, fn: () => Promise<void>, msg: string) => {
    setActionLoading(key);
    try { await fn(); notify(msg); await fetchAll(); } catch (e: any) { notify(e.message || 'Action failed', 'error'); }
    finally { setActionLoading(null); }
  };

  const stats = {
    totalUsers: allUsers.length,
    totalJobs: jobs.length,
    totalApps: applications.length,
    totalProviders: providers.length,
    activeJobs: jobs.filter(j => j.is_active).length,
    pendingAds: advertisements.filter(a => a.status === 'pending').length,
    totalConversations: conversations.length,
    recruiters: allUsers.filter(u => u.role === 'recruiter').length,
    jobSeekers: allUsers.filter(u => u.role === 'job_seeker').length,
    providers_count: allUsers.filter(u => u.role === 'provider').length,
  };

  const filteredUsers = allUsers
    .filter(u => !searchQuery || u.full_name?.toLowerCase().includes(searchQuery.toLowerCase()) || u.email?.toLowerCase().includes(searchQuery.toLowerCase()))
    .filter(u => roleFilter === 'all' || u.role === roleFilter);

  const filteredJobs = jobs
    .filter(j => !searchQuery || j.title?.toLowerCase().includes(searchQuery.toLowerCase()) || j.company?.toLowerCase().includes(searchQuery.toLowerCase()))
    .filter(j => statusFilter === 'all' || (statusFilter === 'active' && j.is_active) || (statusFilter === 'inactive' && !j.is_active));

  const filteredApps = applications
    .filter(a => !searchQuery || a.job?.title?.toLowerCase().includes(searchQuery.toLowerCase()) || a.applicant?.full_name?.toLowerCase().includes(searchQuery.toLowerCase()))
    .filter(a => statusFilter === 'all' || a.status === statusFilter);

  const downloadCSV = (data: any[], filename: string) => {
    if (!data.length) return;
    const keys = Object.keys(data[0]);
    const csv = [keys.join(','), ...data.map(row => keys.map(k => JSON.stringify(row[k] ?? '')).join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = filename; a.click();
    URL.revokeObjectURL(url);
  };

  const renderSortIcon = (field: string) => {
    if (sortField !== field) return null;
    return sortDir === 'desc' ? <ChevronDown className="w-3 h-3" /> : <ChevronUp className="w-3 h-3" />;
  };

  const toggleSort = (field: string) => {
    if (sortField === field) setSortDir(d => d === 'desc' ? 'asc' : 'desc');
    else { setSortField(field); setSortDir('desc'); }
  };

  const inputClass = "w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none";
  const btnClass = "px-3 py-1.5 rounded-lg text-xs font-medium transition flex items-center gap-1.5";
  const blueBtn = `${btnClass} bg-blue-600 text-white hover:bg-blue-700`;
  const redBtn = `${btnClass} bg-red-50 text-red-600 hover:bg-red-100 border border-red-200`;
  const greenBtn = `${btnClass} bg-emerald-50 text-emerald-600 hover:bg-emerald-100 border border-emerald-200`;
  const grayBtn = `${btnClass} bg-gray-100 text-gray-600 hover:bg-gray-200`;

  const tabs: { id: TabType; label: string; icon: any; count?: number }[] = [
    { id: 'dashboard', label: 'Dashboard', icon: Shield },
    { id: 'users', label: 'Users', icon: Users, count: allUsers.length },
    { id: 'jobs', label: 'Jobs', icon: Briefcase, count: jobs.length },
    { id: 'applications', label: 'Applications', icon: Flag, count: applications.length },
    { id: 'providers', label: 'Providers', icon: Building, count: providers.length },
    { id: 'messages', label: 'Messages', icon: MessageSquare, count: conversations.length },
    { id: 'ads', label: 'Ads', icon: Megaphone, count: advertisements.length },
    { id: 'notifications', label: 'Notifications', icon: Bell, count: notifications.length },
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />
      <div className="max-w-7xl mx-auto px-4 py-6">
        {/* Confirm Modal */}
        {confirmAction && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setConfirmAction(null)}>
            <div className="bg-white rounded-xl p-6 max-w-sm w-full mx-4 shadow-xl" onClick={e => e.stopPropagation()}>
              <h3 className="text-lg font-bold text-gray-900 mb-2">{confirmAction.title}</h3>
              <p className="text-sm text-gray-600 mb-6">{confirmAction.message}</p>
              <div className="flex gap-3">
                <button onClick={() => setConfirmAction(null)} className="flex-1 py-2.5 border border-gray-200 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50">Cancel</button>
                <button onClick={async () => { await confirmAction.action(); setConfirmAction(null); }} className="flex-1 py-2.5 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-700">Confirm</button>
              </div>
            </div>
          </div>
        )}

        {/* Tabs */}
        <div className="flex flex-wrap gap-1 mb-6 bg-white rounded-xl p-1.5 border border-gray-200 shadow-sm">
          {tabs.map(t => (
            <button key={t.id} onClick={() => setActiveTab(t.id)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all ${activeTab === t.id ? 'bg-blue-600 text-white shadow-md' : 'text-gray-600 hover:bg-gray-100'}`}>
              <t.icon className="w-4 h-4" />
              <span className="hidden sm:inline">{t.label}</span>
              {t.count !== undefined && (
                <span className={`text-xs px-1.5 py-0.5 rounded-full ${activeTab === t.id ? 'bg-white/20 text-white' : 'bg-gray-100 text-gray-500'}`}>{t.count}</span>
              )}
            </button>
          ))}
        </div>

        {/* ──────── DASHBOARD ──────── */}
        {activeTab === 'dashboard' && (
          <div className="space-y-6">
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
              {[
                { label: 'Total Users', value: stats.totalUsers, icon: Users, color: 'from-blue-500 to-blue-600' },
                { label: 'Job Seekers', value: stats.jobSeekers, icon: Users, color: 'from-cyan-500 to-cyan-600' },
                { label: 'Recruiters', value: stats.recruiters, icon: Building, color: 'from-violet-500 to-violet-600' },
                { label: 'Providers', value: stats.providers_count, icon: Star, color: 'from-amber-500 to-amber-600' },
                { label: 'Jobs', value: stats.totalJobs, icon: Briefcase, color: 'from-emerald-500 to-emerald-600' },
                { label: 'Active Jobs', value: stats.activeJobs, icon: Briefcase, color: 'from-green-500 to-green-600' },
                { label: 'Applications', value: stats.totalApps, icon: Flag, color: 'from-rose-500 to-rose-600' },
                { label: 'Providers Listed', value: stats.totalProviders, icon: Building, color: 'from-orange-500 to-orange-600' },
                { label: 'Conversations', value: stats.totalConversations, icon: MessageSquare, color: 'from-teal-500 to-teal-600' },
                { label: 'Pending Ads', value: stats.pendingAds, icon: Megaphone, color: 'from-purple-500 to-purple-600' },
                { label: 'Notifications', value: notifications.length, icon: Bell, color: 'from-pink-500 to-pink-600' },
                { label: 'Advertisements', value: advertisements.length, icon: CreditCard, color: 'from-indigo-500 to-indigo-600' },
              ].map(s => (
                <div key={s.label} className={`bg-gradient-to-br ${s.color} rounded-xl p-4 text-white`}>
                  <s.icon className="w-5 h-5 mb-2 opacity-80" />
                  <p className="text-2xl font-bold">{s.value}</p>
                  <p className="text-xs opacity-80">{s.label}</p>
                </div>
              ))}
            </div>

            {/* Recent Activity */}
            <div className="bg-white rounded-xl border border-gray-200 p-4">
              <h3 className="text-sm font-bold text-gray-900 mb-4 flex items-center gap-2"><Activity className="w-4 h-4" /> Recent Activity</h3>
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {[...notifications].slice(0, 20).map(n => (
                  <div key={n.id} className="flex items-start gap-3 p-2 hover:bg-gray-50 rounded-lg">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs ${n.is_read ? 'bg-gray-100 text-gray-400' : 'bg-blue-100 text-blue-600'}`}>
                      {n.type === 'system' ? '🔧' : n.type === 'message' ? '💬' : n.type === 'job_application' ? '📄' : '📢'}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">{n.title}</p>
                      <p className="text-xs text-gray-500 truncate">{n.content || n.type} · {new Date(n.created_at).toLocaleDateString()}</p>
                    </div>
                    <span className="text-[10px] text-gray-400">{new Date(n.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                  </div>
                ))}
                {notifications.length === 0 && <p className="text-sm text-gray-400 text-center py-4">No recent activity</p>}
              </div>
            </div>
          </div>
        )}

        {/* ──────── USERS ──────── */}
        {activeTab === 'users' && (
          <div className="bg-white rounded-xl border border-gray-200">
            <div className="p-4 border-b border-gray-100 flex flex-wrap gap-3 items-center justify-between">
              <div className="flex items-center gap-3 flex-1 min-w-[200px]">
                <Search className="w-4 h-4 text-gray-400" />
                <input value={searchQuery} onChange={e => setSearchQuery(e.target.value)} placeholder="Search users..." className={inputClass} />
                <select value={roleFilter} onChange={e => setRoleFilter(e.target.value)} className={`${inputClass} w-auto`}>
                  <option value="all">All Roles</option>
                  <option value="job_seeker">Job Seeker</option>
                  <option value="recruiter">Recruiter</option>
                  <option value="provider">Provider</option>
                  <option value="admin">Admin</option>
                </select>
              </div>
              <button onClick={() => downloadCSV(filteredUsers, 'users.csv')} className={grayBtn}><Download className="w-3.5 h-3.5" /> Export</button>
              <button onClick={fetchAll} className={grayBtn}><RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} /> Refresh</button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100 bg-gray-50">
                    <th className="text-left p-3 font-medium text-gray-500 cursor-pointer" onClick={() => toggleSort('full_name')}>Name {renderSortIcon('full_name')}</th>
                    <th className="text-left p-3 font-medium text-gray-500">Email</th>
                    <th className="text-left p-3 font-medium text-gray-500 cursor-pointer" onClick={() => toggleSort('role')}>Role {renderSortIcon('role')}</th>
                    <th className="text-left p-3 font-medium text-gray-500">Joined</th>
                    <th className="text-right p-3 font-medium text-gray-500">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredUsers.map(u => (
                    <tr key={u.id} className="border-b border-gray-50 hover:bg-gray-50">
                      <td className="p-3">
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-xs font-bold text-blue-600">
                            {(u.full_name || 'U').split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase()}
                          </div>
                          <span className="font-medium text-gray-900">{u.full_name || 'Unnamed'}</span>
                        </div>
                      </td>
                      <td className="p-3 text-gray-500">{u.email}</td>
                      <td className="p-3">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                          u.role === 'admin' ? 'bg-purple-100 text-purple-700' :
                          u.role === 'recruiter' ? 'bg-blue-100 text-blue-700' :
                          u.role === 'provider' ? 'bg-amber-100 text-amber-700' :
                          'bg-gray-100 text-gray-700'
                        }`}>{u.role || 'job_seeker'}</span>
                      </td>
                      <td className="p-3 text-gray-400 text-xs">{new Date(u.created_at).toLocaleDateString()}</td>
                      <td className="p-3 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <button onClick={() => setShowUserModal(u)} className={blueBtn}><Eye className="w-3 h-3" /> View</button>
                          <select value={u.role || 'job_seeker'} onChange={e => doAction('role-' + u.id, () => adminUpdateUserRole(u.id, e.target.value), 'Role updated')}
                            className={`${inputClass} w-auto text-xs py-1`} disabled={actionLoading === 'role-' + u.id}>
                            <option value="job_seeker">Job Seeker</option>
                            <option value="recruiter">Recruiter</option>
                            <option value="provider">Provider</option>
                            <option value="admin">Admin</option>
                          </select>
                          <button onClick={() => setConfirmAction({ title: 'Delete User', message: `Delete ${u.full_name || u.email}? This cannot be undone.`, action: () => doAction('del-' + u.id, () => adminDeleteProfile(u.id), 'User deleted') })} className={redBtn} disabled={actionLoading === 'del-' + u.id}>
                            {actionLoading === 'del-' + u.id ? <Loader className="w-3 h-3 animate-spin" /> : <Trash2 className="w-3 h-3" />}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {filteredUsers.length === 0 && <p className="text-center text-gray-400 py-8">No users found</p>}
          </div>
        )}

        {/* ──────── User Detail Modal ──────── */}
        {showUserModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setShowUserModal(null)}>
            <div className="bg-white rounded-xl p-6 max-w-lg w-full mx-4 shadow-xl max-h-[80vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-bold text-gray-900">User Details</h3>
                <button onClick={() => setShowUserModal(null)} className="text-gray-400 hover:text-gray-600">&times;</button>
              </div>
              <div className="space-y-3">
                {Object.entries(showUserModal).filter(([k]) => !['id', 'skills'].includes(k)).map(([k, v]) => (
                  <div key={k} className="flex justify-between text-sm">
                    <span className="text-gray-500 capitalize">{k.replace(/_/g, ' ')}</span>
                    <span className="font-medium text-gray-900 text-right max-w-[60%]">{v === null || v === undefined ? '—' : String(v)}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ──────── JOBS ──────── */}
        {activeTab === 'jobs' && (
          <div className="bg-white rounded-xl border border-gray-200">
            <div className="p-4 border-b border-gray-100 flex flex-wrap gap-3 items-center justify-between">
              <div className="flex items-center gap-3 flex-1 min-w-[200px]">
                <Search className="w-4 h-4 text-gray-400" />
                <input value={searchQuery} onChange={e => setSearchQuery(e.target.value)} placeholder="Search jobs..." className={inputClass} />
                <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className={`${inputClass} w-auto`}>
                  <option value="all">All Status</option>
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                </select>
              </div>
              <button onClick={() => downloadCSV(filteredJobs, 'jobs.csv')} className={grayBtn}><Download className="w-3.5 h-3.5" /> Export</button>
              <button onClick={fetchAll} className={grayBtn}><RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} /></button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100 bg-gray-50">
                    <th className="text-left p-3 font-medium text-gray-500">Title</th>
                    <th className="text-left p-3 font-medium text-gray-500">Company</th>
                    <th className="text-left p-3 font-medium text-gray-500">Recruiter</th>
                    <th className="text-left p-3 font-medium text-gray-500">Status</th>
                    <th className="text-left p-3 font-medium text-gray-500">Created</th>
                    <th className="text-right p-3 font-medium text-gray-500">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredJobs.map(j => (
                    <tr key={j.id} className="border-b border-gray-50 hover:bg-gray-50">
                      <td className="p-3 font-medium text-gray-900">{j.title}</td>
                      <td className="p-3 text-gray-600">{j.company}</td>
                      <td className="p-3 text-gray-500 text-xs">{j.recruiter?.full_name || j.recruiter_id?.slice(0, 8) || '—'}</td>
                      <td className="p-3">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${j.is_active ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>
                          {j.is_active ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td className="p-3 text-gray-400 text-xs">{new Date(j.created_at).toLocaleDateString()}</td>
                      <td className="p-3 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <button onClick={() => setShowJobModal(j)} className={blueBtn}><Eye className="w-3 h-3" /> View</button>
                          <button onClick={() => doAction('toggle-' + j.id, () => adminToggleJobActive(j.id, !j.is_active), `Job ${j.is_active ? 'deactivated' : 'activated'}`)} className={j.is_active ? redBtn : greenBtn} disabled={actionLoading === 'toggle-' + j.id}>
                            {j.is_active ? 'Deactivate' : 'Activate'}
                          </button>
                          <button onClick={() => setConfirmAction({ title: 'Delete Job', message: `Delete "${j.title}"?`, action: () => doAction('delj-' + j.id, () => adminDeleteJob(j.id), 'Job deleted') })} className={redBtn} disabled={actionLoading === 'delj-' + j.id}>
                            {actionLoading === 'delj-' + j.id ? <Loader className="w-3 h-3 animate-spin" /> : <Trash2 className="w-3 h-3" />}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {filteredJobs.length === 0 && <p className="text-center text-gray-400 py-8">No jobs found</p>}
          </div>
        )}

        {/* ──────── Job Detail Modal ──────── */}
        {showJobModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setShowJobModal(null)}>
            <div className="bg-white rounded-xl p-6 max-w-2xl w-full mx-4 shadow-xl max-h-[80vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-bold text-gray-900">{showJobModal.title}</h3>
                <button onClick={() => setShowJobModal(null)} className="text-gray-400 hover:text-gray-600">&times;</button>
              </div>
              <div className="space-y-3">
                {Object.entries(showJobModal).filter(([k]) => !['id', 'recruiter'].includes(k)).map(([k, v]) => (
                  <div key={k} className="flex justify-between text-sm">
                    <span className="text-gray-500 capitalize">{k.replace(/_/g, ' ')}</span>
                    <span className="font-medium text-gray-900 text-right max-w-[70%]">{Array.isArray(v) ? v.join(', ') : v === null || v === undefined ? '—' : String(v)}</span>
                  </div>
                ))}
                {showJobModal.recruiter && (
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">Recruiter</span>
                    <span className="font-medium text-gray-900">{showJobModal.recruiter.full_name || showJobModal.recruiter.email}</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ──────── APPLICATIONS ──────── */}
        {activeTab === 'applications' && (
          <div className="bg-white rounded-xl border border-gray-200">
            <div className="p-4 border-b border-gray-100 flex flex-wrap gap-3 items-center justify-between">
              <div className="flex items-center gap-3 flex-1 min-w-[200px]">
                <Search className="w-4 h-4 text-gray-400" />
                <input value={searchQuery} onChange={e => setSearchQuery(e.target.value)} placeholder="Search applications..." className={inputClass} />
                <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className={`${inputClass} w-auto`}>
                  <option value="all">All Status</option>
                  <option value="pending">Pending</option>
                  <option value="reviewed">Reviewed</option>
                  <option value="shortlisted">Shortlisted</option>
                  <option value="rejected">Rejected</option>
                  <option value="hired">Hired</option>
                </select>
              </div>
              <button onClick={fetchAll} className={grayBtn}><RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} /></button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100 bg-gray-50">
                    <th className="text-left p-3 font-medium text-gray-500">Applicant</th>
                    <th className="text-left p-3 font-medium text-gray-500">Job</th>
                    <th className="text-left p-3 font-medium text-gray-500">Status</th>
                    <th className="text-left p-3 font-medium text-gray-500">Applied</th>
                    <th className="text-right p-3 font-medium text-gray-500">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredApps.map(a => (
                    <tr key={a.id} className="border-b border-gray-50 hover:bg-gray-50">
                      <td className="p-3 font-medium text-gray-900">{a.applicant?.full_name || 'Unknown'}</td>
                      <td className="p-3 text-gray-600 text-xs max-w-[200px] truncate">{a.job?.title || '—'}</td>
                      <td className="p-3">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                          a.status === 'hired' ? 'bg-emerald-100 text-emerald-700' :
                          a.status === 'shortlisted' ? 'bg-blue-100 text-blue-700' :
                          a.status === 'reviewed' ? 'bg-amber-100 text-amber-700' :
                          a.status === 'rejected' ? 'bg-red-100 text-red-700' :
                          'bg-gray-100 text-gray-700'
                        }`}>{a.status || 'pending'}</span>
                      </td>
                      <td className="p-3 text-gray-400 text-xs">{new Date(a.created_at).toLocaleDateString()}</td>
                      <td className="p-3 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <select value={a.status || 'pending'} onChange={e => doAction('app-' + a.id, () => adminUpdateApplication(a.id, { status: e.target.value }), 'Status updated')}
                            className={`${inputClass} w-auto text-xs py-1`} disabled={actionLoading === 'app-' + a.id}>
                            <option value="pending">Pending</option>
                            <option value="reviewed">Reviewed</option>
                            <option value="shortlisted">Shortlisted</option>
                            <option value="rejected">Rejected</option>
                            <option value="hired">Hired</option>
                          </select>
                          <button onClick={() => setConfirmAction({ title: 'Delete Application', message: 'Delete this application?', action: () => doAction('dela-' + a.id, () => adminDeleteApplication(a.id), 'Application deleted') })} className={redBtn} disabled={actionLoading === 'dela-' + a.id}>
                            {actionLoading === 'dela-' + a.id ? <Loader className="w-3 h-3 animate-spin" /> : <Trash2 className="w-3 h-3" />}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {filteredApps.length === 0 && <p className="text-center text-gray-400 py-8">No applications found</p>}
          </div>
        )}

        {/* ──────── PROVIDERS ──────── */}
        {activeTab === 'providers' && (
          <div className="bg-white rounded-xl border border-gray-200">
            <div className="p-4 border-b border-gray-100 flex items-center justify-between">
              <h3 className="text-sm font-bold text-gray-900">Service Providers ({providers.length})</h3>
              <button onClick={fetchAll} className={grayBtn}><RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} /></button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100 bg-gray-50">
                    <th className="text-left p-3 font-medium text-gray-500">Business Name</th>
                    <th className="text-left p-3 font-medium text-gray-500">Specialty</th>
                    <th className="text-left p-3 font-medium text-gray-500">Verified</th>
                    <th className="text-left p-3 font-medium text-gray-500">Active</th>
                    <th className="text-left p-3 font-medium text-gray-500">Rating</th>
                    <th className="text-right p-3 font-medium text-gray-500">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {providers.map(p => (
                    <tr key={p.id} className="border-b border-gray-50 hover:bg-gray-50">
                      <td className="p-3 font-medium text-gray-900">{p.business_name || p.profile?.full_name || '—'}</td>
                      <td className="p-3 text-gray-500">{p.specialty || '—'}</td>
                      <td className="p-3">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${p.is_verified ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-500'}`}>
                          {p.is_verified ? 'Verified' : 'Unverified'}
                        </span>
                      </td>
                      <td className="p-3">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${p.is_active !== false ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                          {p.is_active !== false ? 'Active' : 'Suspended'}
                        </span>
                      </td>
                      <td className="p-3 text-gray-500">{p.rating ? `${p.rating}⭐` : '—'}</td>
                      <td className="p-3 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <button onClick={() => doAction('ver-' + p.id, () => adminVerifyProvider(p.id, !p.is_verified), `Provider ${p.is_verified ? 'unverified' : 'verified'}`)}
                            className={p.is_verified ? redBtn : greenBtn} disabled={actionLoading === 'ver-' + p.id}>
                            {p.is_verified ? 'Unverify' : 'Verify'}
                          </button>
                          <button onClick={() => setConfirmAction({ title: 'Delete Provider', message: `Delete ${p.business_name || 'this provider'}?`, action: () => doAction('delp-' + p.id, () => adminDeleteServiceProvider(p.id), 'Provider deleted') })}
                            className={redBtn} disabled={actionLoading === 'delp-' + p.id}>
                            {actionLoading === 'delp-' + p.id ? <Loader className="w-3 h-3 animate-spin" /> : <Trash2 className="w-3 h-3" />}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {providers.length === 0 && <p className="text-center text-gray-400 py-8">No providers found</p>}
          </div>
        )}

        {/* ──────── MESSAGES ──────── */}
        {activeTab === 'messages' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="bg-white rounded-xl border border-gray-200">
              <div className="p-4 border-b border-gray-100 flex items-center justify-between">
                <h3 className="text-sm font-bold text-gray-900">Conversations ({conversations.length})</h3>
                <button onClick={fetchAll} className={grayBtn}><RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} /></button>
              </div>
              <div className="max-h-[60vh] overflow-y-auto">
                {conversations.map(c => (
                  <div key={c.id} onClick={() => { setSelectedConv(c.id); adminFetchMessages(c.id).then(setMessages).catch(() => {}); }}
                    className={`p-3 border-b border-gray-50 cursor-pointer hover:bg-gray-50 transition ${selectedConv === c.id ? 'bg-blue-50' : ''}`}>
                    <p className="text-sm font-medium text-gray-900">
                      {c.participant1?.full_name || c.participant1_id?.slice(0, 8)} ↔ {c.participant2?.full_name || c.participant2_id?.slice(0, 8)}
                    </p>
                    <p className="text-xs text-gray-500">{new Date(c.last_message_at || c.created_at).toLocaleString()}</p>
                    <button onClick={e => { e.stopPropagation(); setConfirmAction({ title: 'Delete Conversation', message: 'Delete this conversation?', action: () => doAction('delc-' + c.id, () => adminDeleteConversation(c.id), 'Conversation deleted') }); }}
                      className="text-xs text-red-500 hover:text-red-700 mt-1" disabled={actionLoading === 'delc-' + c.id}>Delete</button>
                  </div>
                ))}
                {conversations.length === 0 && <p className="text-center text-gray-400 py-8">No conversations</p>}
              </div>
            </div>
            <div className="bg-white rounded-xl border border-gray-200">
              <div className="p-4 border-b border-gray-100">
                <h3 className="text-sm font-bold text-gray-900">Messages {selectedConv ? '' : '(select a conversation)'}</h3>
              </div>
              <div className="max-h-[60vh] overflow-y-auto p-4 space-y-3">
                {messages.map(m => (
                  <div key={m.id} className="flex items-start gap-2">
                    <div className="w-6 h-6 rounded-full bg-gray-200 flex items-center justify-center text-[10px] font-bold text-gray-600 flex-shrink-0">
                      {(m.sender?.full_name || 'U')[0] || '?'}
                    </div>
                    <div className="flex-1">
                      <p className="text-xs font-medium text-gray-700">{m.sender?.full_name || 'Unknown'} · <span className="text-gray-400">{new Date(m.created_at).toLocaleTimeString()}</span></p>
                      <p className="text-sm text-gray-600 mt-0.5">{m.content}</p>
                    </div>
                    <button onClick={() => doAction('delm-' + m.id, () => adminDeleteMessage(m.id), 'Message deleted')} className="text-gray-300 hover:text-red-500" disabled={actionLoading === 'delm-' + m.id}>
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                ))}
                {selectedConv && messages.length === 0 && <p className="text-center text-gray-400 py-4">No messages in this conversation</p>}
              </div>
            </div>
          </div>
        )}

        {/* ──────── ADS ──────── */}
        {activeTab === 'ads' && (
          <div className="bg-white rounded-xl border border-gray-200">
            <div className="p-4 border-b border-gray-100 flex items-center justify-between">
              <h3 className="text-sm font-bold text-gray-900">Advertisements ({advertisements.length})</h3>
              <button onClick={fetchAll} className={grayBtn}><RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} /></button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100 bg-gray-50">
                    <th className="text-left p-3 font-medium text-gray-500">Business</th>
                    <th className="text-left p-3 font-medium text-gray-500">Title</th>
                    <th className="text-left p-3 font-medium text-gray-500">Package</th>
                    <th className="text-left p-3 font-medium text-gray-500">Status</th>
                    <th className="text-left p-3 font-medium text-gray-500">Paid</th>
                    <th className="text-right p-3 font-medium text-gray-500">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {advertisements.map(a => (
                    <tr key={a.id} className="border-b border-gray-50 hover:bg-gray-50">
                      <td className="p-3 font-medium text-gray-900">{a.business_name || a.owner?.full_name || '—'}</td>
                      <td className="p-3 text-gray-600 max-w-[200px] truncate">{a.title}</td>
                      <td className="p-3"><span className="px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100">{a.package || '—'}</span></td>
                      <td className="p-3">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                          a.status === 'active' ? 'bg-emerald-100 text-emerald-700' :
                          a.status === 'pending' ? 'bg-amber-100 text-amber-700' :
                          a.status === 'rejected' ? 'bg-red-100 text-red-700' :
                          'bg-gray-100 text-gray-500'
                        }`}>{a.status || 'pending'}</span>
                      </td>
                      <td className="p-3 text-gray-500">{a.payment_status === 'paid' ? '✅' : '❌'}</td>
                      <td className="p-3 text-right">
                        <div className="flex items-center justify-end gap-1">
                          {a.status === 'pending' && (
                            <>
                              <button onClick={() => doAction('apprad-' + a.id, () => adminUpdateAdvertisementStatus(a.id, 'active'), 'Ad approved')} className={greenBtn} disabled={actionLoading === 'apprad-' + a.id}>Approve</button>
                              <button onClick={() => doAction('rejad-' + a.id, () => adminUpdateAdvertisementStatus(a.id, 'rejected'), 'Ad rejected')} className={redBtn} disabled={actionLoading === 'rejad-' + a.id}>Reject</button>
                            </>
                          )}
                          <button onClick={() => setConfirmAction({ title: 'Delete Ad', message: 'Delete this advertisement?', action: () => doAction('delad-' + a.id, () => adminDeleteAdvertisement(a.id), 'Ad deleted') })}
                            className={redBtn} disabled={actionLoading === 'delad-' + a.id}>
                            {actionLoading === 'delad-' + a.id ? <Loader className="w-3 h-3 animate-spin" /> : <Trash2 className="w-3 h-3" />}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {advertisements.length === 0 && <p className="text-center text-gray-400 py-8">No advertisements</p>}
          </div>
        )}

        {/* ──────── NOTIFICATIONS ──────── */}
        {activeTab === 'notifications' && (
          <div className="space-y-4">
            <div className="bg-white rounded-xl border border-gray-200">
              <div className="p-4 border-b border-gray-100 flex items-center justify-between">
                <h3 className="text-sm font-bold text-gray-900">All Notifications ({notifications.length})</h3>
                <div className="flex gap-2">
                  <button onClick={() => setShowNotifModal(true)} className={blueBtn}><Plus className="w-3.5 h-3.5" /> Create</button>
                  <button onClick={fetchAll} className={grayBtn}><RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} /></button>
                </div>
              </div>
              <div className="max-h-[60vh] overflow-y-auto">
                {notifications.map(n => (
                  <div key={n.id} className="flex items-start gap-3 p-4 border-b border-gray-50 hover:bg-gray-50">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm ${n.is_read ? 'bg-gray-100' : 'bg-blue-100'}`}>
                      {n.type === 'system' ? '⚙️' : n.type === 'message' ? '💬' : n.type === 'job_application' ? '📄' : n.type === 'payment' ? '💰' : '📢'}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className={`text-sm ${n.is_read ? 'text-gray-600' : 'font-semibold text-gray-900'}`}>{n.title}</p>
                        {!n.is_read && <span className="w-2 h-2 rounded-full bg-blue-600" />}
                      </div>
                      <p className="text-xs text-gray-500">{n.content || n.type} · {n.user?.full_name || n.user_id?.slice(0, 8) || 'All'}</p>
                      <p className="text-[10px] text-gray-400 mt-0.5">{new Date(n.created_at).toLocaleString()}</p>
                    </div>
                    <button onClick={() => setConfirmAction({ title: 'Delete Notification', message: 'Delete this notification?', action: () => doAction('deln-' + n.id, () => adminDeleteNotification(n.id), 'Notification deleted') })}
                      className="text-gray-300 hover:text-red-500" disabled={actionLoading === 'deln-' + n.id}>
                      {actionLoading === 'deln-' + n.id ? <Loader className="w-3 h-3 animate-spin" /> : <X className="w-4 h-4" />}
                    </button>
                  </div>
                ))}
                {notifications.length === 0 && <p className="text-center text-gray-400 py-8">No notifications</p>}
              </div>
            </div>
          </div>
        )}

        {/* ──────── Create Notification Modal ──────── */}
        {showNotifModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setShowNotifModal(false)}>
            <div className="bg-white rounded-xl p-6 max-w-md w-full mx-4 shadow-xl" onClick={e => e.stopPropagation()}>
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-bold text-gray-900">Create Notification</h3>
                <button onClick={() => setShowNotifModal(false)} className="text-gray-400 hover:text-gray-600">&times;</button>
              </div>
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">User ID (leave empty for all)</label>
                  <input value={notifForm.user_id} onChange={e => setNotifForm(f => ({ ...f, user_id: e.target.value }))} placeholder="user-uuid or empty" className={inputClass} />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Type</label>
                  <select value={notifForm.type} onChange={e => setNotifForm(f => ({ ...f, type: e.target.value }))} className={inputClass}>
                    <option value="system">System</option>
                    <option value="message">Message</option>
                    <option value="job_application">Job Application</option>
                    <option value="payment">Payment</option>
                    <option value="advert">Advertisement</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Title *</label>
                  <input value={notifForm.title} onChange={e => setNotifForm(f => ({ ...f, title: e.target.value }))} placeholder="Notification title" className={inputClass} />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Content</label>
                  <textarea value={notifForm.content} onChange={e => setNotifForm(f => ({ ...f, content: e.target.value }))} placeholder="Optional content" className={`${inputClass} h-20 resize-none`} />
                </div>
                <button onClick={async () => {
                  if (!notifForm.title) return notify('Title is required', 'error');
                  await doAction('create-notif', () => adminCreateNotification({
                    user_id: notifForm.user_id || allUsers[0]?.id || '',
                    type: notifForm.type,
                    title: notifForm.title,
                    content: notifForm.content || undefined,
                    data: {},
                  }), 'Notification created');
                  setShowNotifModal(false);
                  setNotifForm({ user_id: '', type: 'system', title: '', content: '' });
                }} disabled={actionLoading === 'create-notif'} className="w-full py-2.5 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition flex items-center justify-center gap-2">
                  {actionLoading === 'create-notif' ? <Loader className="w-4 h-4 animate-spin" /> : null} Create Notification
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
