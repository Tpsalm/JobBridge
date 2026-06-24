import { useState, useEffect } from 'react'
import { Search, Check, X, Plus } from 'lucide-react'
import Sidebar from '../components/Sidebar'
import { api } from '../api'

export default function Activities() {
  const [activities, setActivities] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [showCreate, setShowCreate] = useState(false)
  const [toast, setToast] = useState(null)
  const [createForm, setCreateForm] = useState({ employee_name: '', department: '', entry_type: 'task', week_label: '', description: '', category: '' })

  const fetchActivities = () => {
    setLoading(true)
    api.getActivities().then(res => {
      if (res.activities) setActivities(res.activities)
      setLoading(false)
    }).catch(() => setLoading(false))
  }

  useEffect(() => { fetchActivities() }, [])

  const showToast = (msg) => { setToast(msg); setTimeout(() => setToast(null), 3000) }

  const filtered = activities.filter(a => {
    const s = search.toLowerCase()
    const matchesSearch = a.employee_name?.toLowerCase().includes(s) || a.department?.toLowerCase().includes(s) || a.description?.toLowerCase().includes(s)
    const matchesStatus = statusFilter === 'all' || a.status === statusFilter
    return matchesSearch && matchesStatus
  })

  const handleApprove = async (id) => {
    await api.approveActivity(id)
    showToast('Activity approved')
    fetchActivities()
  }

  const handleReject = async (id) => {
    await api.rejectActivity(id, 'Rejected by admin')
    showToast('Activity rejected')
    fetchActivities()
  }

  const handleCreate = async () => {
    if (!createForm.employee_name || !createForm.description) return
    await api.createActivity(createForm)
    setShowCreate(false)
    setCreateForm({ employee_name: '', department: '', entry_type: 'task', week_label: '', description: '', category: '' })
    showToast('Activity created')
    fetchActivities()
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
          <h1 className="text-xl font-bold text-white">Employee Activities</h1>
          <button onClick={() => setShowCreate(true)} className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors">
            <Plus className="w-4 h-4" /> New Activity
          </button>
        </div>

        <div className="flex gap-3 mb-4">
          <div className="relative flex-1 max-w-xs">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
            <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="Search activities..." className="w-full pl-10 pr-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white text-sm placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500" />
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
                  <th className="text-left px-4 py-3 text-slate-400 font-medium">Employee</th>
                  <th className="text-left px-4 py-3 text-slate-400 font-medium">Department</th>
                  <th className="text-left px-4 py-3 text-slate-400 font-medium">Type</th>
                  <th className="text-left px-4 py-3 text-slate-400 font-medium">Description</th>
                  <th className="text-left px-4 py-3 text-slate-400 font-medium">Week</th>
                  <th className="text-left px-4 py-3 text-slate-400 font-medium">Status</th>
                  <th className="text-left px-4 py-3 text-slate-400 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={7} className="text-center py-8 text-slate-500">Loading...</td></tr>
                ) : filtered.length === 0 ? (
                  <tr><td colSpan={7} className="text-center py-8 text-slate-500">No activities found</td></tr>
                ) : filtered.map(a => (
                  <tr key={a.id} className="border-b border-slate-700/50 hover:bg-slate-700/30">
                    <td className="px-4 py-3 text-white">{a.employee_name}</td>
                    <td className="px-4 py-3 text-slate-300">{a.department || '—'}</td>
                    <td className="px-4 py-3"><span className="text-xs px-2 py-0.5 bg-slate-700 rounded text-slate-300">{a.entry_type}</span></td>
                    <td className="px-4 py-3 text-slate-300 max-w-xs truncate">{a.description}</td>
                    <td className="px-4 py-3 text-slate-300">{a.week_label || '—'}</td>
                    <td className="px-4 py-3">{statusBadge(a.status)}</td>
                    <td className="px-4 py-3">
                      <div className="flex gap-1">
                        {a.status !== 'approved' && (
                          <button onClick={() => handleApprove(a.id)} className="p-1.5 rounded hover:bg-slate-700 text-green-400" title="Approve"><Check className="w-3.5 h-3.5" /></button>
                        )}
                        {a.status !== 'rejected' && (
                          <button onClick={() => handleReject(a.id)} className="p-1.5 rounded hover:bg-slate-700 text-red-400" title="Reject"><X className="w-3.5 h-3.5" /></button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {showCreate && (
          <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50" onClick={() => setShowCreate(false)}>
            <div className="bg-slate-800 rounded-xl p-6 w-full max-w-lg mx-4 border border-slate-700" onClick={e => e.stopPropagation()}>
              <h2 className="text-white font-bold mb-4">New Activity Entry</h2>
              <div className="space-y-3">
                <input value={createForm.employee_name} onChange={e => setCreateForm({...createForm, employee_name: e.target.value})} placeholder="Employee name *" className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white text-sm" />
                <div className="grid grid-cols-2 gap-3">
                  <input value={createForm.department} onChange={e => setCreateForm({...createForm, department: e.target.value})} placeholder="Department" className="px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white text-sm" />
                  <select value={createForm.entry_type} onChange={e => setCreateForm({...createForm, entry_type: e.target.value})} className="px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white text-sm">
                    <option value="task">Task</option>
                    <option value="meeting">Meeting</option>
                    <option value="project">Project</option>
                    <option value="milestone">Milestone</option>
                    <option value="other">Other</option>
                  </select>
                </div>
                <input value={createForm.week_label} onChange={e => setCreateForm({...createForm, week_label: e.target.value})} placeholder="Week label (e.g. JUNE 1st-5th)" className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white text-sm" />
                <input value={createForm.category} onChange={e => setCreateForm({...createForm, category: e.target.value})} placeholder="Category" className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white text-sm" />
                <textarea value={createForm.description} onChange={e => setCreateForm({...createForm, description: e.target.value})} placeholder="Description *" className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white text-sm resize-none h-24" />
              </div>
              <div className="flex gap-2 mt-4">
                <button onClick={() => setShowCreate(false)} className="flex-1 px-4 py-2 rounded-lg text-slate-300 hover:bg-slate-700 text-sm">Cancel</button>
                <button onClick={handleCreate} className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium">Create</button>
              </div>
            </div>
          </div>
        )}

        {toast && (
          <div className="fixed bottom-6 right-6 bg-slate-800 border border-slate-700 text-white px-4 py-2.5 rounded-lg shadow-xl text-sm z-50">{toast}</div>
        )}
      </main>
    </div>
  )
}
