import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../contexts/AuthContext';
import {
  adminFetchUsers, adminFetchJobs, adminFetchApplications,
  adminUpdateUserRole, adminToggleJobActive,
} from '../lib/supabaseQueries';
import {
  Shield, Users, Briefcase, CreditCard, Clock,
  Search, Ban, UserCheck, Trash2, DollarSign, Activity,
  RefreshCw, X, Check, Flag,
} from 'lucide-react';
import PageHero from '../components/PageHero';

type TabType = 'overview' | 'jobs' | 'providers' | 'users' | 'activities';
type StatusFilter = 'all' | 'pending' | 'approved' | 'rejected' | 'active' | 'suspended';

interface DashboardData {
  totalUsers: number; totalJobs: number; pendingJobs: number;
  approvedJobs: number; rejectedJobs: number; totalApplications: number;
  totalRevenue: number; completedPayments: number; newUsersThisWeek: number;
  newRecruitersThisWeek: number; jobsToday: number; applicationsToday: number;
  roleCounts: { role: string; count: number }[];
  activeSubscribers: number; activeAiSubscribers: number;
}

export default function AdminDashboard() {
  const { user } = useAuth();

  const [activeTab, setActiveTab] = useState<TabType>('overview');
  const [dashboard, setDashboard] = useState<DashboardData | null>(null);
  const [jobs, setJobs] = useState<any[]>([]);
  const [providers, setProviders] = useState<any[]>([]);
  const [allUsers, setAllUsers] = useState<any[]>([]);
  const [activities, setActivities] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [roleFilter, setRoleFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [confirmModal, setConfirmModal] = useState<{ title: string; message: string; action: () => Promise<void> } | null>(null);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const [jobsData, usersData, appsData] = await Promise.all([
        adminFetchJobs(),
        adminFetchUsers(),
        adminFetchApplications(),
      ]);
      setJobs(jobsData);
      setAllUsers(usersData);
      // Use apps for dashboard count / providers as placeholder
      setDashboard({
        totalUsers: usersData.length,
        totalJobs: jobsData.length,
        pendingJobs: jobsData.filter(j => !j.is_active).length,
        approvedJobs: jobsData.filter(j => j.is_active).length,
        rejectedJobs: 0,
        totalApplications: appsData.length,
        totalRevenue: 0,
        completedPayments: 0,
        newUsersThisWeek: usersData.filter(u => {
          const d = new Date(u.created_at);
          const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
          return d > weekAgo;
        }).length,
        newRecruitersThisWeek: 0,
        jobsToday: jobsData.filter(j => {
          const d = new Date(j.created_at);
          const today = new Date();
          return d.toDateString() === today.toDateString();
        }).length,
        applicationsToday: appsData.filter(a => {
          const d = new Date(a.created_at);
          const today = new Date();
          return d.toDateString() === today.toDateString();
        }).length,
        roleCounts: [],
        activeSubscribers: 0,
        activeAiSubscribers: 0,
      });
    } catch (e) {
      console.error('admin fetch error', e);
    }
    setLoading(false);
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const notify = (message: string, type: 'success' | 'error' = 'success') => {
    window.dispatchEvent(new CustomEvent('jobbridge:toast', { detail: { message, type } }));
  };

  const approveJob = async (id: string) => {
    setActionLoading(id);
    await adminToggleJobActive(id, true);
    setJobs(prev => prev.map(j => j.id === id ? { ...j, is_active: true } : j));
    setActionLoading(null);
    notify('Job approved');
  };

  const rejectJob = async (id: string) => {
    setActionLoading(id);
    await adminToggleJobActive(id, false);
    setJobs(prev => prev.map(j => j.id === id ? { ...j, is_active: false } : j));
    setActionLoading(null);
    notify('Job rejected');
  };

  const approveProvider = async (id: string) => {
    setActionLoading(id);
    await adminUpdateUserRole(id, 'provider');
    setProviders(prev => prev.map(p => p.id === id ? { ...p, role: 'provider' } : p));
    setActionLoading(null);
    notify('Provider approved');
  };

  const rejectProvider = async (id: string) => {
    setActionLoading(id);
    await adminUpdateUserRole(id, 'job_seeker');
    setProviders(prev => prev.map(p => p.id === id ? { ...p, role: 'job_seeker' } : p));
    setActionLoading(null);
    notify('Provider rejected');
  };

  const suspendUser = async (id: string) => {
    setActionLoading(id);
    await adminUpdateUserRole(id, 'suspended');
    setAllUsers(prev => prev.map(u => u.id === id ? { ...u, role: 'suspended' } : u));
    setActionLoading(null);
    notify('User suspended');
  };

  const activateUser = async (id: string) => {
    setActionLoading(id);
    await adminUpdateUserRole(id, 'active');
    setAllUsers(prev => prev.map(u => u.id === id ? { ...u, role: 'active' } : u));
    setActionLoading(null);
    notify('User activated');
  };

  const deleteUser = async (id: string) => {
    setActionLoading(id);
    await api(`/admin/users/${id}`, { method: 'DELETE' });
    setAllUsers(prev => prev.filter(u => u.id !== id));
    setConfirmModal(null);
    setActionLoading(null);
    notify('User revoked');
  };

  const approveActivity = async (id: string) => {
    setActionLoading(id);
    await api(`/api/activities/${id}/approve`, { method: 'PUT' });
    setActivities(prev => prev.map(a => a.id === id ? { ...a, status: 'approved' } : a));
    setActionLoading(null);
    notify('Activity approved');
  };

  const rejectActivity = async (id: string) => {
    setActionLoading(id);
    await api(`/api/activities/${id}/reject`, { method: 'PUT', body: JSON.stringify({ reason: 'Flagged by admin' }) });
    setActivities(prev => prev.map(a => a.id === id ? { ...a, status: 'rejected' } : a));
    setActionLoading(null);
    notify('Activity rejected');
  };

  // Stats cards
  const statCards = dashboard ? [
    { label: 'Total Users', value: dashboard.totalUsers, icon: Users, color: 'blue' },
    { label: 'Total Jobs', value: dashboard.totalJobs, icon: Briefcase, color: 'indigo' },
    { label: 'Applications', value: dashboard.totalApplications, icon: Activity, color: 'purple' },
    { label: 'Revenue', value: `₦${(dashboard.totalRevenue || 0).toLocaleString()}`, icon: DollarSign, color: 'emerald' },
    { label: 'Pending Jobs', value: dashboard.pendingJobs, icon: Clock, color: 'amber' },
    { label: 'Active Subs', value: dashboard.activeSubscribers, icon: CreditCard, color: 'cyan' },
  ] : [];

  const tabs: { key: TabType; label: string; icon: any; count?: number }[] = [
    { key: 'overview', label: 'Overview', icon: Shield },
    { key: 'jobs', label: 'Jobs', icon: Briefcase, count: dashboard?.pendingJobs },
    { key: 'providers', label: 'Providers', icon: Users, count: providers.filter(p => p.provider_status !== 'approved').length },
    { key: 'users', label: 'Users', icon: UserCheck },
    { key: 'activities', label: 'Activities', icon: Activity, count: activities.filter(a => a.status === 'pending').length },
  ];

  // Filter helpers
  const filteredJobs = jobs.filter(j => {
    if (statusFilter !== 'all' && j.status !== statusFilter) return false;
    if (searchQuery && !j.title?.toLowerCase().includes(searchQuery.toLowerCase()) && !j.company?.toLowerCase().includes(searchQuery.toLowerCase())) return false;
    return true;
  });

  const filteredProviders = providers.filter(p => {
    if (statusFilter !== 'all') {
      if (statusFilter === 'pending' && p.provider_status !== 'pending' && p.provider_status !== undefined) return false;
      if (statusFilter === 'approved' && p.provider_status !== 'approved') return false;
      if (statusFilter === 'rejected' && p.provider_status !== 'rejected') return false;
      if (statusFilter === 'active' && p.provider_status !== undefined && p.provider_status !== 'approved') return false;
    }
    if (searchQuery && !p.full_name?.toLowerCase().includes(searchQuery.toLowerCase()) && !p.company?.toLowerCase().includes(searchQuery.toLowerCase())) return false;
    return true;
  });

  const filteredUsers = allUsers.filter(u => {
    if (statusFilter !== 'all' && (u.status || 'active') !== statusFilter) return false;
    if (roleFilter !== 'all' && u.role !== roleFilter) return false;
    if (searchQuery && !u.full_name?.toLowerCase().includes(searchQuery.toLowerCase()) && !u.email?.toLowerCase().includes(searchQuery.toLowerCase())) return false;
    return true;
  });

  const filteredActivities = activities.filter(a => {
    if (statusFilter !== 'all' && a.status !== statusFilter) return false;
    if (searchQuery && !a.employeeName?.toLowerCase().includes(searchQuery.toLowerCase()) && !a.summary?.toLowerCase().includes(searchQuery.toLowerCase())) return false;
    return true;
  });

  const ConfirmModal = () => {
    if (!confirmModal) return null;
    return (
      <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6">
          <h3 className="text-lg font-bold text-gray-900 mb-2">{confirmModal.title}</h3>
          <p className="text-sm text-gray-600 mb-6">{confirmModal.message}</p>
          <div className="flex gap-3 justify-end">
            <button onClick={() => setConfirmModal(null)} className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200">Cancel</button>
            <button onClick={async () => { await confirmModal.action(); }} className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700">Confirm</button>
          </div>
        </div>
      </div>
    );
  };

  const StatusBadge = ({ status }: { status: string }) => {
    const colors: Record<string, string> = {
      pending: 'bg-amber-100 text-amber-800',
      approved: 'bg-emerald-100 text-emerald-800',
      rejected: 'bg-red-100 text-red-800',
      active: 'bg-emerald-100 text-emerald-800',
      suspended: 'bg-red-100 text-red-800',
    };
    return (
      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${colors[status] || 'bg-gray-100 text-gray-800'}`}>
        {status}
      </span>
    );
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <PageHero
        title="Admin Dashboard"
        subtitle="Platform moderation and management"
        variant="slide3d"
      />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 -mt-8 relative z-10 pb-12">
        {/* Tab Navigation */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-1 mb-6 flex flex-wrap gap-1">
          {tabs.map(({ key, label, icon: Icon, count }) => (
            <button
              key={key}
              onClick={() => setActiveTab(key)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-all ${
                activeTab === key
                  ? 'bg-blue-600 text-white shadow-md'
                  : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
              }`}
            >
              <Icon className="w-4 h-4" />
              {label}
              {count && count > 0 ? (
                <span className={`ml-1 px-1.5 py-0.5 rounded-full text-[10px] font-bold ${
                  activeTab === key ? 'bg-white/20 text-white' : 'bg-amber-100 text-amber-800'
                }`}>
                  {count}
                </span>
              ) : null}
            </button>
          ))}
        </div>

        {/* Loading */}
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <RefreshCw className="w-8 h-8 text-blue-600 animate-spin" />
          </div>
        ) : (
          <>
            {/* ===== OVERVIEW TAB ===== */}
            {activeTab === 'overview' && (
              <div className="space-y-6">
                {/* Stats Grid */}
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
                  {statCards.map(({ label, value, icon: Icon, color }) => {
                    const colorMap: Record<string, string> = {
                      blue: 'bg-blue-50 text-blue-600 border-blue-200',
                      indigo: 'bg-indigo-50 text-indigo-600 border-indigo-200',
                      purple: 'bg-purple-50 text-purple-600 border-purple-200',
                      emerald: 'bg-emerald-50 text-emerald-600 border-emerald-200',
                      amber: 'bg-amber-50 text-amber-600 border-amber-200',
                      cyan: 'bg-cyan-50 text-cyan-600 border-cyan-200',
                    };
                    return (
                      <div key={label} className="bg-white rounded-xl border border-gray-200 p-4 hover:shadow-md transition-shadow">
                        <div className="flex items-center justify-between mb-3">
                          <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">{label}</span>
                          <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${colorMap[color]}`}>
                            <Icon className="w-4 h-4" />
                          </div>
                        </div>
                        <p className="text-2xl font-bold text-gray-900">{value}</p>
                      </div>
                    );
                  })}
                </div>

                {/* Role distribution + quick stats */}
                <div className="grid md:grid-cols-2 gap-6">
                  <div className="bg-white rounded-xl border border-gray-200 p-6">
                    <h3 className="text-sm font-semibold text-gray-900 mb-4">User Distribution by Role</h3>
                    <div className="space-y-3">
                      {(dashboard?.roleCounts || []).map(({ role, count }) => (
                        <div key={role} className="flex items-center justify-between">
                          <span className="text-sm text-gray-600 capitalize">{role?.replace('_', ' ') || 'Unknown'}</span>
                          <div className="flex items-center gap-2">
                            <div className="w-32 bg-gray-100 rounded-full h-2">
                              <div
                                className="bg-blue-600 h-2 rounded-full"
                                style={{ width: `${Math.min(100, (count / Math.max(1, dashboard!.totalUsers)) * 100)}%` }}
                              />
                            </div>
                            <span className="text-sm font-medium text-gray-900 w-8 text-right">{count}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="bg-white rounded-xl border border-gray-200 p-6">
                    <h3 className="text-sm font-semibold text-gray-900 mb-4">Activity Summary</h3>
                    <div className="grid grid-cols-2 gap-4">
                      {[
                        { label: 'Jobs Today', value: dashboard?.jobsToday || 0, icon: Briefcase },
                        { label: 'Apps Today', value: dashboard?.applicationsToday || 0, icon: Activity },
                        { label: 'New Users/Week', value: dashboard?.newUsersThisWeek || 0, icon: Users },
                        { label: 'New Recruiters/Week', value: dashboard?.newRecruitersThisWeek || 0, icon: UserCheck },
                      ].map(({ label, value, icon: Icon }) => (
                        <div key={label} className="bg-gray-50 rounded-lg p-3">
                          <div className="flex items-center gap-2 text-gray-500 mb-1">
                            <Icon className="w-3.5 h-3.5" />
                            <span className="text-xs">{label}</span>
                          </div>
                          <p className="text-lg font-bold text-gray-900">{value}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Recent pending items */}
                <div className="grid md:grid-cols-2 gap-6">
                  <div className="bg-white rounded-xl border border-gray-200 p-6">
                    <h3 className="text-sm font-semibold text-gray-900 mb-4">Pending Jobs ({jobs.filter(j => j.status === 'pending').length})</h3>
                    <div className="space-y-2 max-h-64 overflow-y-auto">
                      {jobs.filter(j => j.status === 'pending').slice(0, 5).map(job => (
                        <div key={job.id} className="flex items-center justify-between p-2 bg-amber-50 rounded-lg">
                          <div>
                            <p className="text-sm font-medium text-gray-900">{job.title}</p>
                            <p className="text-xs text-gray-500">{job.company} &middot; {new Date(job.created_at).toLocaleDateString()}</p>
                          </div>
                          <div className="flex gap-1">
                            <button onClick={() => approveJob(job.id)} className="p-1.5 bg-emerald-100 text-emerald-700 rounded-lg hover:bg-emerald-200" title="Approve">
                              <Check className="w-3.5 h-3.5" />
                            </button>
                            <button onClick={() => rejectJob(job.id)} className="p-1.5 bg-red-100 text-red-700 rounded-lg hover:bg-red-200" title="Reject">
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      ))}
                      {jobs.filter(j => j.status === 'pending').length === 0 && (
                        <p className="text-sm text-gray-400 text-center py-4">No pending jobs</p>
                      )}
                    </div>
                  </div>
                  <div className="bg-white rounded-xl border border-gray-200 p-6">
                    <h3 className="text-sm font-semibold text-gray-900 mb-4">Pending Activities ({activities.filter(a => a.status === 'pending').length})</h3>
                    <div className="space-y-2 max-h-64 overflow-y-auto">
                      {activities.filter(a => a.status === 'pending').slice(0, 5).map(act => (
                        <div key={act.id} className="flex items-center justify-between p-2 bg-amber-50 rounded-lg">
                          <div>
                            <p className="text-sm font-medium text-gray-900">{act.employeeName}</p>
                            <p className="text-xs text-gray-500">{act.summary?.slice(0, 50)}...</p>
                          </div>
                          <div className="flex gap-1">
                            <button onClick={() => approveActivity(act.id)} className="p-1.5 bg-emerald-100 text-emerald-700 rounded-lg hover:bg-emerald-200" title="Approve">
                              <Check className="w-3.5 h-3.5" />
                            </button>
                            <button onClick={() => rejectActivity(act.id)} className="p-1.5 bg-red-100 text-red-700 rounded-lg hover:bg-red-200" title="Reject">
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      ))}
                      {activities.filter(a => a.status === 'pending').length === 0 && (
                        <p className="text-sm text-gray-400 text-center py-4">No pending activities</p>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* ===== JOBS MODERATION TAB ===== */}
            {activeTab === 'jobs' && (
              <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
                <div className="p-4 sm:p-6 border-b border-gray-100">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                    <h3 className="text-lg font-bold text-gray-900">Job Moderation</h3>
                    <div className="flex items-center gap-3">
                      <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                        <input
                          type="text"
                          placeholder="Search jobs..."
                          value={searchQuery}
                          onChange={e => setSearchQuery(e.target.value)}
                          className="pl-9 pr-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none w-48"
                        />
                      </div>
                      <select
                        value={statusFilter}
                        onChange={e => setStatusFilter(e.target.value as StatusFilter)}
                        className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                      >
                        <option value="all">All Status</option>
                        <option value="pending">Pending</option>
                        <option value="approved">Approved</option>
                        <option value="rejected">Rejected</option>
                      </select>
                    </div>
                  </div>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Title</th>
                        <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Company</th>
                        <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Recruiter</th>
                        <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
                        <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                        <th className="text-right px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {filteredJobs.map(job => (
                        <tr key={job.id} className="hover:bg-gray-50 transition-colors">
                          <td className="px-4 py-3 text-sm font-medium text-gray-900">{job.title}</td>
                          <td className="px-4 py-3 text-sm text-gray-600">{job.company}</td>
                          <td className="px-4 py-3 text-sm text-gray-500">{job.recruiter_id?.slice(0, 8)}...</td>
                          <td className="px-4 py-3 text-sm text-gray-500">{new Date(job.created_at).toLocaleDateString()}</td>
                          <td className="px-4 py-3"><StatusBadge status={job.status || 'pending'} /></td>
                          <td className="px-4 py-3 text-right">
                            <div className="flex items-center justify-end gap-1">
                              {job.status !== 'approved' && (
                                <button
                                  onClick={() => approveJob(job.id)}
                                  disabled={actionLoading === job.id}
                                  className="p-1.5 bg-emerald-50 text-emerald-700 rounded-lg hover:bg-emerald-100 disabled:opacity-50"
                                  title="Approve"
                                >
                                  <Check className="w-4 h-4" />
                                </button>
                              )}
                              {job.status !== 'rejected' && (
                                <button
                                  onClick={() => rejectJob(job.id)}
                                  disabled={actionLoading === job.id}
                                  className="p-1.5 bg-red-50 text-red-700 rounded-lg hover:bg-red-100 disabled:opacity-50"
                                  title="Reject"
                                >
                                  <X className="w-4 h-4" />
                                </button>
                              )}
                              <button className="p-1.5 bg-gray-50 text-gray-500 rounded-lg hover:bg-gray-100" title="Flag">
                                <Flag className="w-4 h-4" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                      {filteredJobs.length === 0 && (
                        <tr><td colSpan={6} className="px-4 py-12 text-center text-sm text-gray-400">No jobs found</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* ===== PROVIDERS TAB ===== */}
            {activeTab === 'providers' && (
              <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
                <div className="p-4 sm:p-6 border-b border-gray-100">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                    <h3 className="text-lg font-bold text-gray-900">Provider Moderation</h3>
                    <div className="flex items-center gap-3">
                      <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                        <input
                          type="text"
                          placeholder="Search providers..."
                          value={searchQuery}
                          onChange={e => setSearchQuery(e.target.value)}
                          className="pl-9 pr-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none w-48"
                        />
                      </div>
                      <select
                        value={statusFilter}
                        onChange={e => setStatusFilter(e.target.value as StatusFilter)}
                        className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                      >
                        <option value="all">All</option>
                        <option value="pending">Pending</option>
                        <option value="approved">Approved</option>
                        <option value="rejected">Rejected</option>
                      </select>
                    </div>
                  </div>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Name</th>
                        <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Email</th>
                        <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Company</th>
                        <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Joined</th>
                        <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Status</th>
                        <th className="text-right px-4 py-3 text-xs font-medium text-gray-500 uppercase">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {filteredProviders.map(p => (
                        <tr key={p.id} className="hover:bg-gray-50 transition-colors">
                          <td className="px-4 py-3 text-sm font-medium text-gray-900">{p.full_name || 'N/A'}</td>
                          <td className="px-4 py-3 text-sm text-gray-600">{p.email}</td>
                          <td className="px-4 py-3 text-sm text-gray-500">{p.company || '-'}</td>
                          <td className="px-4 py-3 text-sm text-gray-500">{p.created_at ? new Date(p.created_at).toLocaleDateString() : '-'}</td>
                          <td className="px-4 py-3"><StatusBadge status={p.provider_status || 'pending'} /></td>
                          <td className="px-4 py-3 text-right">
                            <div className="flex items-center justify-end gap-1">
                              {(p.provider_status || 'pending') !== 'approved' && (
                                <button onClick={() => approveProvider(p.id)} disabled={actionLoading === p.id} className="p-1.5 bg-emerald-50 text-emerald-700 rounded-lg hover:bg-emerald-100 disabled:opacity-50" title="Approve">
                                  <Check className="w-4 h-4" />
                                </button>
                              )}
                              {(p.provider_status || 'pending') !== 'rejected' && (
                                <button onClick={() => rejectProvider(p.id)} disabled={actionLoading === p.id} className="p-1.5 bg-red-50 text-red-700 rounded-lg hover:bg-red-100 disabled:opacity-50" title="Reject">
                                  <X className="w-4 h-4" />
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}
                      {filteredProviders.length === 0 && (
                        <tr><td colSpan={6} className="px-4 py-12 text-center text-sm text-gray-400">No providers found</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* ===== USERS TAB ===== */}
            {activeTab === 'users' && (
              <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
                <div className="p-4 sm:p-6 border-b border-gray-100">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                    <h3 className="text-lg font-bold text-gray-900">User Management</h3>
                    <div className="flex items-center gap-3">
                      <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                        <input
                          type="text"
                          placeholder="Search users..."
                          value={searchQuery}
                          onChange={e => setSearchQuery(e.target.value)}
                          className="pl-9 pr-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none w-48"
                        />
                      </div>
                      <select
                        value={roleFilter}
                        onChange={e => setRoleFilter(e.target.value)}
                        className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                      >
                        <option value="all">All Roles</option>
                        <option value="job_seeker">Job Seeker</option>
                        <option value="recruiter">Recruiter</option>
                        <option value="provider">Provider</option>
                        <option value="admin">Admin</option>
                      </select>
                      <select
                        value={statusFilter}
                        onChange={e => setStatusFilter(e.target.value as StatusFilter)}
                        className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                      >
                        <option value="all">All Status</option>
                        <option value="active">Active</option>
                        <option value="suspended">Suspended</option>
                      </select>
                    </div>
                  </div>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">User</th>
                        <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Email</th>
                        <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Role</th>
                        <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Joined</th>
                        <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Status</th>
                        <th className="text-right px-4 py-3 text-xs font-medium text-gray-500 uppercase">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {filteredUsers.map(u => (
                        <tr key={u.id} className="hover:bg-gray-50 transition-colors">
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center text-xs font-bold text-gray-600">
                                {(u.full_name || u.email || '?').charAt(0).toUpperCase()}
                              </div>
                              <span className="text-sm font-medium text-gray-900">{u.full_name || 'N/A'}</span>
                            </div>
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-600">{u.email}</td>
                          <td className="px-4 py-3">
                            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-50 text-blue-700 capitalize">
                              {u.role?.replace('_', ' ') || 'job seeker'}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-500">{u.created_at ? new Date(u.created_at).toLocaleDateString() : '-'}</td>
                          <td className="px-4 py-3"><StatusBadge status={u.status || 'active'} /></td>
                          <td className="px-4 py-3 text-right">
                            <div className="flex items-center justify-end gap-1">
                              {(u.status || 'active') === 'active' ? (
                                <button
                                  onClick={() => suspendUser(u.id)}
                                  disabled={actionLoading === u.id}
                                  className="p-1.5 bg-amber-50 text-amber-700 rounded-lg hover:bg-amber-100 disabled:opacity-50"
                                  title="Suspend"
                                >
                                  <Ban className="w-4 h-4" />
                                </button>
                              ) : (
                                <button
                                  onClick={() => activateUser(u.id)}
                                  disabled={actionLoading === u.id}
                                  className="p-1.5 bg-emerald-50 text-emerald-700 rounded-lg hover:bg-emerald-100 disabled:opacity-50"
                                  title="Activate"
                                >
                                  <UserCheck className="w-4 h-4" />
                                </button>
                              )}
                              <button
                                onClick={() => setConfirmModal({
                                  title: 'Revoke User',
                                  message: `Permanently revoke access for ${u.full_name || u.email}? This action cannot be undone.`,
                                  action: () => deleteUser(u.id),
                                })}
                                disabled={actionLoading === u.id}
                                className="p-1.5 bg-red-50 text-red-700 rounded-lg hover:bg-red-100 disabled:opacity-50"
                                title="Revoke"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                      {filteredUsers.length === 0 && (
                        <tr><td colSpan={6} className="px-4 py-12 text-center text-sm text-gray-400">No users found</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* ===== ACTIVITIES TAB ===== */}
            {activeTab === 'activities' && (
              <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
                <div className="p-4 sm:p-6 border-b border-gray-100">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                    <h3 className="text-lg font-bold text-gray-900">Employee Activities</h3>
                    <div className="flex items-center gap-3">
                      <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                        <input
                          type="text"
                          placeholder="Search activities..."
                          value={searchQuery}
                          onChange={e => setSearchQuery(e.target.value)}
                          className="pl-9 pr-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none w-48"
                        />
                      </div>
                      <select
                        value={statusFilter}
                        onChange={e => setStatusFilter(e.target.value as StatusFilter)}
                        className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                      >
                        <option value="all">All Status</option>
                        <option value="pending">Pending</option>
                        <option value="approved">Approved</option>
                        <option value="rejected">Rejected</option>
                      </select>
                    </div>
                  </div>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Employee</th>
                        <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Department</th>
                        <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Summary</th>
                        <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Date</th>
                        <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Type</th>
                        <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Status</th>
                        <th className="text-right px-4 py-3 text-xs font-medium text-gray-500 uppercase">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {filteredActivities.map(a => (
                        <tr key={a.id} className="hover:bg-gray-50 transition-colors">
                          <td className="px-4 py-3 text-sm font-medium text-gray-900">{a.employeeName}</td>
                          <td className="px-4 py-3 text-sm text-gray-600">{a.department}</td>
                          <td className="px-4 py-3 text-sm text-gray-500 max-w-xs truncate">{a.summary}</td>
                          <td className="px-4 py-3 text-sm text-gray-500">{a.date}</td>
                          <td className="px-4 py-3">
                            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-purple-50 text-purple-700 capitalize">
                              {a.entryType}
                            </span>
                          </td>
                          <td className="px-4 py-3"><StatusBadge status={a.status || 'pending'} /></td>
                          <td className="px-4 py-3 text-right">
                            <div className="flex items-center justify-end gap-1">
                              {a.status !== 'approved' && (
                                <button onClick={() => approveActivity(a.id)} disabled={actionLoading === a.id} className="p-1.5 bg-emerald-50 text-emerald-700 rounded-lg hover:bg-emerald-100 disabled:opacity-50" title="Approve">
                                  <Check className="w-4 h-4" />
                                </button>
                              )}
                              {a.status !== 'rejected' && (
                                <button onClick={() => rejectActivity(a.id)} disabled={actionLoading === a.id} className="p-1.5 bg-red-50 text-red-700 rounded-lg hover:bg-red-100 disabled:opacity-50" title="Reject">
                                  <X className="w-4 h-4" />
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}
                      {filteredActivities.length === 0 && (
                        <tr><td colSpan={7} className="px-4 py-12 text-center text-sm text-gray-400">No activities found</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </>
        )}
      </div>
      <ConfirmModal />
    </div>
  );
}
