import { useState, useEffect } from 'react'
import { Search, Filter, DollarSign } from 'lucide-react'
import Sidebar from '../components/Sidebar'
import { api } from '../api'

export default function Transactions() {
  const [transactions, setTransactions] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')

  useEffect(() => {
    api.getTransactions().then(res => {
      if (res.transactions) setTransactions(res.transactions)
      setLoading(false)
    }).catch(() => setLoading(false))
  }, [])

  const filtered = transactions.filter(t => {
    const s = search.toLowerCase()
    const matchesSearch = t.reference?.toLowerCase().includes(s) || t.plan?.toLowerCase().includes(s) || t.user_email?.toLowerCase().includes(s)
    const matchesStatus = statusFilter === 'all' || t.status === statusFilter
    return matchesSearch && matchesStatus
  })

  const totalRevenue = filtered.reduce((sum, t) => sum + (t.status === 'completed' ? (t.amount || 0) : 0), 0)

  return (
    <div className="min-h-screen bg-slate-900 flex">
      <Sidebar />
      <main className="flex-1 p-6 overflow-y-auto">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-xl font-bold text-white">Transactions</h1>
          <div className="flex items-center gap-3">
            <div className="bg-blue-600/20 text-blue-400 px-3 py-1.5 rounded-lg text-sm font-medium">
              Revenue: ₦{(totalRevenue / 100).toLocaleString()}
            </div>
            <span className="text-slate-400 text-sm">{transactions.length} total</span>
          </div>
        </div>

        <div className="flex gap-3 mb-4">
          <div className="relative flex-1 max-w-xs">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
            <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="Search transactions..." className="w-full pl-10 pr-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white text-sm placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="bg-slate-800 border border-slate-700 rounded-lg text-white text-sm px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500">
            <option value="all">All Status</option>
            <option value="completed">Completed</option>
            <option value="pending">Pending</option>
          </select>
        </div>

        <div className="bg-slate-800/50 rounded-xl border border-slate-700/50 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-700">
                  <th className="text-left px-4 py-3 text-slate-400 font-medium">Reference</th>
                  <th className="text-left px-4 py-3 text-slate-400 font-medium">User</th>
                  <th className="text-left px-4 py-3 text-slate-400 font-medium">Plan</th>
                  <th className="text-left px-4 py-3 text-slate-400 font-medium">Amount</th>
                  <th className="text-left px-4 py-3 text-slate-400 font-medium">Status</th>
                  <th className="text-left px-4 py-3 text-slate-400 font-medium">Date</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={6} className="text-center py-8 text-slate-500">Loading...</td></tr>
                ) : filtered.length === 0 ? (
                  <tr><td colSpan={6} className="text-center py-8 text-slate-500">No transactions</td></tr>
                ) : filtered.map(t => (
                  <tr key={t.id} className="border-b border-slate-700/50 hover:bg-slate-700/30">
                    <td className="px-4 py-3 text-slate-300 font-mono text-xs">{t.reference?.slice(0, 16)}...</td>
                    <td className="px-4 py-3 text-white">{t.user_email || '—'}</td>
                    <td className="px-4 py-3"><span className="text-xs px-2 py-0.5 bg-slate-700 rounded text-slate-300">{t.plan || '—'}</span></td>
                    <td className="px-4 py-3 text-white font-medium">₦{((t.amount || 0) / 100).toLocaleString()}</td>
                    <td className="px-4 py-3">
                      <span className={`text-xs px-2 py-0.5 rounded-full ${t.status === 'completed' ? 'bg-emerald-600/20 text-emerald-400' : 'bg-amber-600/20 text-amber-400'}`}>{t.status}</span>
                    </td>
                    <td className="px-4 py-3 text-slate-400 text-xs">{t.created_at ? new Date(t.created_at).toLocaleDateString() : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </main>
    </div>
  )
}
