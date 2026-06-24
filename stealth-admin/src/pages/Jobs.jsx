import { useState, useEffect } from 'react'
import { Search, Check, X, ExternalLink } from 'lucide-react'
import Sidebar from '../components/Sidebar'
import { api } from '../api'

export default function Jobs() {
  const [jobs, setJobs] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [toast, setToast] = useState(null)

  const fetchJobs = () => {
    setLoading(true)
    api.getJobs().then(res => {
      if (res.jobs) setJobs(res.jobs)
      setLoading(false)
    }).catch(() => setLoading(false))
  }

  useEffect(() => { fetchJobs() }, [])

  const showToast = (msg) => { setToast(msg); setTimeout(() => setToast(null), 3000) }

  const filtered = jobs.filter(j => {
    const s = search.toLowerCase()
    const matchesSearch = j.title?.toLowerCase().includes(s) || j.company?.toLowerCase().includes(s)
    const matchesStatus = statusFilter === 'all' || j.status === statusFilter
    return matchesSearch && matchesStatus
  })

  const handleApprove = async (id) => {
    await api.approveJob(id)
    showToast('Job approved')
    fetchJobs()
  }

  const handleReject = async (id) => {
    await api.rejectJob(id)
    showToast('Job rejected')
    fetchJobs()
  }

  const statusBadge = (status) => {
    const colors = { approved: 'bg-green-600/20 text-green-400', pending: 'bg-amber-600/20 text-amber-400', rejected: 'bg-red-600/20 text-red-400' }
    return <span className={`text-xs px-2 py-0.5 rounded-full ${colors[status] || 'bg-slate-600/20 text-slate-400'}`}>{status || 'approved'}</span>
  }

  return (
    <div className="min-h-screen bg-slate-900 flex">
      <Sidebar />
      <main className="flex-1 p-6 overflow-y-auto">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-xl font-bold text-white">Job Postings</h1>
          <span className="text-slate-400 text-sm">{jobs.length} total</span>
        </div>

        <div className="flex gap-3 mb-4">
          <div className="relative flex-1 max-w-xs">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
            <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="Search jobs..." className="w-full pl-10 pr-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white text-sm placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="bg-slate-800 border border-slate-700 rounded-lg text-white text-sm px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500">
            <option value="all">All Status</option>
            <option value="pending">Pending</option>
            <option value="approved">Approved</option>
            <option value="rejected">Rejected</option>
          </select>
        </div>

        <div className="bg-slate-800/50 rounded-xl border border-slate-700/50 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-700">
                  <th className="text-left px-4 py-3 text-slate-400 font-medium">Title</th>
                  <th className="text-left px-4 py-3 text-slate-400 font-medium">Company</th>
                  <th className="text-left px-4 py-3 text-slate-400 font-medium">Type</th>
                  <th className="text-left px-4 py-3 text-slate-400 font-medium">Status</th>
                  <th className="text-left px-4 py-3 text-slate-400 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={5} className="text-center py-8 text-slate-500">Loading...</td></tr>
                ) : filtered.length === 0 ? (
                  <tr><td colSpan={5} className="text-center py-8 text-slate-500">No jobs found</td></tr>
                ) : filtered.map(j => (
                  <tr key={j.id} className="border-b border-slate-700/50 hover:bg-slate-700/30">
                    <td className="px-4 py-3 text-white">{j.title}</td>
                    <td className="px-4 py-3 text-slate-300">{j.company}</td>
                    <td className="px-4 py-3 text-slate-300">{j.type || '—'}</td>
                    <td className="px-4 py-3">{statusBadge(j.status)}</td>
                    <td className="px-4 py-3">
                      <div className="flex gap-1">
                        {j.status !== 'approved' && (
                          <button onClick={() => handleApprove(j.id)} className="p-1.5 rounded hover:bg-slate-700 text-green-400" title="Approve"><Check className="w-3.5 h-3.5" /></button>
                        )}
                        {j.status !== 'rejected' && (
                          <button onClick={() => handleReject(j.id)} className="p-1.5 rounded hover:bg-slate-700 text-red-400" title="Reject"><X className="w-3.5 h-3.5" /></button>
                        )}
                      </div>
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
