import { useState, useEffect } from 'react'
import { Search, Filter } from 'lucide-react'
import Sidebar from '../components/Sidebar'
import { api } from '../api'

export default function VisitorLog() {
  const [transactions, setTransactions] = useState([])
  const [applications, setApplications] = useState([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState('transactions')
  const [search, setSearch] = useState('')

  useEffect(() => {
    setLoading(true)
    Promise.all([api.getTransactions(), api.getStats()]).then(([txRes]) => {
      if (txRes.transactions) setTransactions(txRes.transactions)
      setLoading(false)
    }).catch(() => setLoading(false))
  }, [])

  const filteredTx = transactions.filter(t => {
    const s = search.toLowerCase()
    return t.reference?.toLowerCase().includes(s) || t.plan?.toLowerCase().includes(s) || t.status?.toLowerCase().includes(s) || t.user_email?.toLowerCase().includes(s)
  })

  return (
    <div className="min-h-screen bg-slate-900 flex">
      <Sidebar />
      <main className="flex-1 p-6 overflow-y-auto">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-xl font-bold text-white">Financial Log</h1>
        </div>

        <div className="flex gap-3 mb-4">
          <div className="relative flex-1 max-w-xs">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
            <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="Search transactions..." className="w-full pl-10 pr-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white text-sm placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div className="flex bg-slate-800 rounded-lg border border-slate-700 overflow-hidden">
            <button onClick={() => setTab('transactions')} className={`px-4 py-2 text-sm ${tab === 'transactions' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white'}`}>Transactions</button>
            <button onClick={() => setTab('applications')} className={`px-4 py-2 text-sm ${tab === 'applications' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white'}`}>Applications</button>
          </div>
        </div>

        {tab === 'transactions' && (
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
                  ) : filteredTx.length === 0 ? (
                    <tr><td colSpan={6} className="text-center py-8 text-slate-500">No transactions found</td></tr>
                  ) : filteredTx.map(t => (
                    <tr key={t.id} className="border-b border-slate-700/50 hover:bg-slate-700/30">
                      <td className="px-4 py-3 text-slate-300 font-mono text-xs">{t.reference}</td>
                      <td className="px-4 py-3 text-white">{t.user_email || '—'}</td>
                      <td className="px-4 py-3"><span className="text-xs px-2 py-0.5 bg-slate-700 rounded text-slate-300">{t.plan || '—'}</span></td>
                      <td className="px-4 py-3 text-white">₦{(t.amount / 100).toLocaleString()}</td>
                      <td className="px-4 py-3">
                        <span className={`text-xs px-2 py-0.5 rounded-full ${t.status === 'completed' ? 'bg-green-600/20 text-green-400' : 'bg-amber-600/20 text-amber-400'}`}>{t.status}</span>
                      </td>
                      <td className="px-4 py-3 text-slate-400 text-xs">{t.created_at ? new Date(t.created_at).toLocaleDateString() : '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {tab === 'applications' && (
          <div className="bg-slate-800/50 rounded-xl p-6 border border-slate-700/50 text-center">
            <p className="text-slate-400 text-sm">Application details available via the main JobBridge admin panel.</p>
          </div>
        )}
      </main>
    </div>
  )
}
