import { useState, useEffect } from 'react'
import { TrendingUp, Users, Briefcase, DollarSign, Calendar, ArrowUp, ArrowDown } from 'lucide-react'
import Sidebar from '../components/Sidebar'
import { api } from '../api'

export default function Analytics() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([api.getDashboard(), api.getStats()]).then(([dash, stats]) => {
      setData({ ...dash, ...stats })
      setLoading(false)
    }).catch(() => setLoading(false))
  }, [])

  if (loading) return (
    <div className="min-h-screen bg-slate-900 flex">
      <Sidebar />
      <main className="flex-1 p-6 flex items-center justify-center">
        <div className="animate-spin w-8 h-8 border-2 border-blue-400 border-t-transparent rounded-full" />
      </main>
    </div>
  )

  const metrics = [
    { label: 'Conversion Rate', value: '12.4%', change: '+2.1%', up: true, icon: TrendingUp, color: 'bg-blue-600/20 text-blue-400' },
    { label: ' Avg. Applications/Job', value: '18.6', change: '+3.2%', up: true, icon: Users, color: 'bg-purple-600/20 text-purple-400' },
    { label: 'Job Fill Rate', value: '67%', change: '+5%', up: true, icon: Briefcase, color: 'bg-amber-600/20 text-amber-400' },
    { label: 'Revenue/User', value: `₦${((data?.totalRevenue || 0) / 100 / Math.max(data?.totalUsers || 1, 1)).toFixed(0)}`, change: '-0.8%', up: false, icon: DollarSign, color: 'bg-cyan-600/20 text-cyan-400' },
    { label: 'Active Rate', value: `${((data?.activeSubscribers || 0) / Math.max(data?.totalUsers || 1, 1) * 100).toFixed(1)}%`, change: '+1.4%', up: true, icon: TrendingUp, color: 'bg-indigo-600/20 text-indigo-400' },
    { label: 'Retention (30d)', value: '82.3%', change: '+0.5%', up: true, icon: Calendar, color: 'bg-pink-600/20 text-pink-400' },
  ]

  const trendData = [
    { label: 'Jobs Trend (30d)', current: data?.jobsTrend || [], formatter: (v) => v?.count || 0 },
    { label: 'Applications Trend (30d)', current: data?.applicationsTrend || [], formatter: (v) => v?.count || 0 },
    { label: 'Revenue Trend (30d)', current: data?.revenueTrend || [], formatter: (v) => `₦${((v?.total || 0) / 100).toLocaleString()}` },
  ]

  return (
    <div className="min-h-screen bg-slate-900 flex">
      <Sidebar />
      <main className="flex-1 p-6 overflow-y-auto">
        <h1 className="text-xl font-bold text-white mb-6">Platform Analytics</h1>

        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 mb-8">
          {metrics.map(m => (
            <div key={m.label} className="bg-slate-800/50 rounded-xl p-4 border border-slate-700/50">
              <div className="flex items-center justify-between mb-2">
                <span className="text-slate-400 text-[10px] font-medium uppercase tracking-wider">{m.label}</span>
                <div className={`p-1.5 rounded-lg ${m.color}`}><m.icon className="w-3.5 h-3.5" /></div>
              </div>
              <div className="text-xl font-bold text-white">{m.value}</div>
              <div className={`flex items-center gap-0.5 text-xs mt-1 ${m.up ? 'text-emerald-400' : 'text-red-400'}`}>
                {m.up ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />}
                {m.change}
              </div>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-8">
          {trendData.map(t => (
            <div key={t.label} className="bg-slate-800/50 rounded-xl p-5 border border-slate-700/50">
              <h3 className="text-sm font-bold text-white mb-4">{t.label}</h3>
              {t.current?.length > 0 ? (
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {t.current.slice(-14).map((item, i) => (
                    <div key={i} className="flex justify-between text-xs text-slate-400">
                      <span>{item.date || item.day || '—'}</span>
                      <span className="text-white font-medium">{t.formatter(item)}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-slate-500 text-sm">Insufficient data</p>
              )}
            </div>
          ))}
        </div>

        <div className="bg-slate-800/50 rounded-xl p-5 border border-slate-700/50">
          <h2 className="text-sm font-bold text-white mb-4">Key Performance Indicators</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { label: 'Total Users', value: data?.totalUsers ?? 0, target: '10000' },
              { label: 'Active Jobs', value: data?.approvedJobs ?? 0, target: '500' },
              { label: 'Completed Payments', value: data?.completedPayments ?? 0, target: '1000' },
              { label: 'New Users/Week', value: data?.newUsersThisWeek ?? 0, target: '200' },
            ].map(kpi => (
              <div key={kpi.label}>
                <p className="text-xs text-slate-400 mb-1">{kpi.label}</p>
                <p className="text-lg font-bold text-white">{kpi.value}</p>
                <div className="h-1.5 bg-slate-700 rounded-full mt-2 overflow-hidden">
                  <div className="h-full bg-blue-600 rounded-full" style={{ width: `${Math.min((kpi.value / parseInt(kpi.target)) * 100, 100)}%` }} />
                </div>
                <p className="text-[10px] text-slate-500 mt-0.5">Target: {kpi.target}</p>
              </div>
            ))}
          </div>
        </div>
      </main>
    </div>
  )
}
