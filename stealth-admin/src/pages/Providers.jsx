import { useState, useEffect } from 'react'
import { Search, Check, X } from 'lucide-react'
import Sidebar from '../components/Sidebar'
import { api } from '../api'

export default function Providers() {
  const [providers, setProviders] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [toast, setToast] = useState(null)

  const fetchAll = () => {
    setLoading(true)
    api.getProviders().then(res => {
      if (res.providers) setProviders(res.providers)
      setLoading(false)
    }).catch(() => setLoading(false))
  }

  useEffect(() => { fetchAll() }, [])

  const showToast = (msg) => { setToast(msg); setTimeout(() => setToast(null), 3000) }

  const filtered = providers.filter(p => {
    const s = search.toLowerCase()
    return p.full_name?.toLowerCase().includes(s) || p.company?.toLowerCase().includes(s) || p.email?.toLowerCase().includes(s)
  })

  const handleApprove = async (id) => {
    await api.approveProvider(id)
    showToast('Provider approved')
    fetchAll()
  }

  const handleReject = async (id) => {
    await api.rejectProvider(id, 'Rejected by admin')
    showToast('Provider rejected')
    fetchAll()
  }

  const statusBadge = (status) => {
    const colors = { approved: 'bg-green-600/20 text-green-400', pending: 'bg-amber-600/20 text-amber-400', rejected: 'bg-red-600/20 text-red-400' }
    return <span className={`text-xs px-2 py-0.5 rounded-full ${colors[status] || 'bg-slate-600/20 text-slate-400'}`}>{status || 'pending'}</span>
  }

  return (
    <div className="min-h-screen bg-slate-900 flex">
      <Sidebar />
      <main className="flex-1 p-6 overflow-y-auto">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-xl font-bold text-white">Service Providers</h1>
          <span className="text-slate-400 text-sm">{providers.length} total</span>
        </div>

        <div className="relative max-w-xs mb-4">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
          <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="Search providers..." className="w-full pl-10 pr-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white text-sm placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500" />
        </div>

        <div className="bg-slate-800/50 rounded-xl border border-slate-700/50 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-700">
                  <th className="text-left px-4 py-3 text-slate-400 font-medium">Name</th>
                  <th className="text-left px-4 py-3 text-slate-400 font-medium">Email</th>
                  <th className="text-left px-4 py-3 text-slate-400 font-medium">Company</th>
                  <th className="text-left px-4 py-3 text-slate-400 font-medium">Status</th>
                  <th className="text-left px-4 py-3 text-slate-400 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={5} className="text-center py-8 text-slate-500">Loading...</td></tr>
                ) : filtered.length === 0 ? (
                  <tr><td colSpan={5} className="text-center py-8 text-slate-500">No providers found</td></tr>
                ) : filtered.map(p => (
                  <tr key={p.id} className="border-b border-slate-700/50 hover:bg-slate-700/30">
                    <td className="px-4 py-3 text-white">{p.full_name || '—'}</td>
                    <td className="px-4 py-3 text-slate-300">{p.email}</td>
                    <td className="px-4 py-3 text-slate-300">{p.company || '—'}</td>
                    <td className="px-4 py-3">{statusBadge(p.provider_status)}</td>
                    <td className="px-4 py-3">
                      {p.provider_status !== 'approved' && (
                        <button onClick={() => handleApprove(p.id)} className="p-1.5 rounded hover:bg-slate-700 text-green-400" title="Approve"><Check className="w-3.5 h-3.5" /></button>
                      )}
                      {p.provider_status !== 'rejected' && (
                        <button onClick={() => handleReject(p.id)} className="p-1.5 rounded hover:bg-slate-700 text-red-400" title="Reject"><X className="w-3.5 h-3.5" /></button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {toast && (
          <div className="fixed bottom-6 right-6 bg-slate-800 border border-slate-700 text-white px-4 py-2.5 rounded-lg shadow-xl text-sm z-50">{toast}</div>
        )}
      </main>
    </div>
  )
}
