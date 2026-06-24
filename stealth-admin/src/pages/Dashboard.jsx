import { useState, useEffect } from 'react'
import { Users, Briefcase, FileText, DollarSign, TrendingUp, Calendar, Clock, Activity } from 'lucide-react'
import Sidebar from '../components/Sidebar'
import { api } from '../api'

export default function Dashboard() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([api.getDashboard(), api.getStats()])
      .then(([dash, stats]) => { setData({ ...dash, ...stats }); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  if (loading) return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center">
      <div className="animate-spin w-8 h-8 border-2 border-blue-400 border-t-transparent rounded-full" />
    </div>
  )

  const cards = [
    { label: 'Total Users', value: data?.totalUsers ?? 0, icon: Users, color: 'bg-blue-600/20 text-blue-400' },
    { label: 'Total Jobs', value: data?.totalJobs ?? 0, icon: Briefcase, color: 'bg-purple-600/20 text-purple-400' },
    { label: 'Applications', value: data?.totalApplications ?? 0, icon: FileText, color: 'bg-amber-600/20 text-amber-400' },
    { label: 'Revenue', value: data?.totalRevenue ? `₦${(data.totalRevenue / 100).toLocaleString()}` : '₦0', icon: DollarSign, color: 'bg-blue-600/20 text-blue-400' },
    { label: 'Pending Jobs', value: data?.pendingJobs ?? 0, icon: Clock, color: 'bg-red-600/20 text-red-400' },
    { label: 'Jobs Today', value: data?.jobsToday ?? 0, icon: Calendar, color: 'bg-cyan-600/20 text-cyan-400' },
    { label: 'Active Subscribers', value: data?.activeSubscribers ?? 0, icon: TrendingUp, color: 'bg-indigo-600/20 text-indigo-400' },
    { label: 'New Users/Week', value: data?.newUsersThisWeek ?? 0, icon: Activity, color: 'bg-pink-600/20 text-pink-400' },
  ]

  return (
    <div className="min-h-screen bg-slate-900 flex">
      <Sidebar />
      <main className="flex-1 p-6 overflow-y-auto">
        <h1 className="text-xl font-bold text-white mb-6">Dashboard Overview</h1>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          {cards.map(card => (
            <div key={card.label} className="bg-slate-800/50 rounded-xl p-4 border border-slate-700/50">
              <div className="flex items-center justify-between mb-3">
                <span className="text-slate-400 text-xs font-medium">{card.label}</span>
                <div className={`p-2 rounded-lg ${card.color}`}>
                  <card.icon className="w-4 h-4" />
                </div>
              </div>
              <div className="text-2xl font-bold text-white">{card.value}</div>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          <div className="bg-slate-800/50 rounded-xl p-5 border border-slate-700/50">
            <h2 className="text-sm font-bold text-white mb-4">Role Distribution</h2>
            {data?.roleCounts?.length > 0 ? (
              <div className="space-y-3">
                {data.roleCounts.map(r => (
                  <div key={r.role}>
                    <div className="flex justify-between text-xs text-slate-400 mb-1">
                      <span className="capitalize">{r.role}</span>
                      <span>{r.count}</span>
                    </div>
                    <div className="h-2 bg-slate-700 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-blue-600 rounded-full transition-all"
                        style={{ width: `${(r.count / Math.max(...data.roleCounts.map(x => x.count))) * 100}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            ) : <p className="text-slate-500 text-sm">No data</p>}
          </div>

          <div className="bg-slate-800/50 rounded-xl p-5 border border-slate-700/50">
            <h2 className="text-sm font-bold text-white mb-4">Application Status</h2>
            {data?.applicationStatusCounts?.length > 0 ? (
              <div className="space-y-3">
                {data.applicationStatusCounts.map(s => (
                  <div key={s.status}>
                    <div className="flex justify-between text-xs text-slate-400 mb-1">
                      <span className="capitalize">{s.status}</span>
                      <span>{s.count}</span>
                    </div>
                    <div className="h-2 bg-slate-700 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-amber-500 rounded-full transition-all"
                        style={{ width: `${(s.count / Math.max(...data.applicationStatusCounts.map(x => x.count))) * 100}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            ) : <p className="text-slate-500 text-sm">No data</p>}
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="bg-slate-800/50 rounded-xl p-5 border border-slate-700/50">
            <h2 className="text-sm font-bold text-white mb-4">Category Distribution</h2>
            {data?.categoryDistribution?.length > 0 ? (
              <div className="space-y-2">
                {data.categoryDistribution.map(c => (
                  <div key={c.category || 'uncategorized'} className="flex justify-between text-xs text-slate-400">
                    <span>{c.category || 'Uncategorized'}</span>
                    <span className="text-white font-medium">{c.count}</span>
                  </div>
                ))}
              </div>
            ) : <p className="text-slate-500 text-sm">No data</p>}
          </div>

          <div className="bg-slate-800/50 rounded-xl p-5 border border-slate-700/50">
            <h2 className="text-sm font-bold text-white mb-4">Plan Distribution</h2>
            {data?.planDistribution?.length > 0 ? (
              <div className="space-y-2">
                {data.planDistribution.map(p => (
                  <div key={p.plan || 'unknown'} className="flex justify-between text-xs text-slate-400">
                    <span>{p.plan || 'Unknown'}</span>
                    <span className="text-white font-medium">{p.count}</span>
                  </div>
                ))}
              </div>
            ) : <p className="text-slate-500 text-sm">No data</p>}
          </div>

          <div className="bg-slate-800/50 rounded-xl p-5 border border-slate-700/50">
            <h2 className="text-sm font-bold text-white mb-4">Quick Stats</h2>
            <div className="space-y-3 text-xs">
              <div className="flex justify-between text-slate-400">
                <span>Completed Payments</span>
                <span className="text-white">{data?.completedPayments ?? 0}</span>
              </div>
              <div className="flex justify-between text-slate-400">
                <span>Active AI Subscribers</span>
                <span className="text-white">{data?.activeAiSubscribers ?? 0}</span>
              </div>
              <div className="flex justify-between text-slate-400">
                <span>New Recruiters/Week</span>
                <span className="text-white">{data?.newRecruitersThisWeek ?? 0}</span>
              </div>
              <div className="flex justify-between text-slate-400">
                <span>Applications Today</span>
                <span className="text-white">{data?.applicationsToday ?? 0}</span>
              </div>
              <div className="flex justify-between text-slate-400">
                <span>Active Users</span>
                <span className="text-white">{data?.totalUsers ? data.totalUsers - (data?.roleCounts?.find(r => r.role === 'suspended')?.count || 0) : 0}</span>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}
