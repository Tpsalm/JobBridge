import { useState, useEffect } from 'react'
import { Search, Shield, X, Check, AlertTriangle, Trash2 } from 'lucide-react'
import Sidebar from '../components/Sidebar'
import { api } from '../api'

export default function Users() {
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [roleFilter, setRoleFilter] = useState('all')
  const [editUser, setEditUser] = useState(null)
  const [confirmAction, setConfirmAction] = useState(null)
  const [toast, setToast] = useState(null)
  const [editForm, setEditForm] = useState({ full_name: '', role: '', company: '', phone: '', notes: '' })

  const fetchUsers = () => {
    setLoading(true)
    api.getUsers().then(res => {
      if (res.users) setUsers(res.users)
      setLoading(false)
    }).catch(() => setLoading(false))
  }

  useEffect(() => { fetchUsers() }, [])

  const showToast = (msg) => { setToast(msg); setTimeout(() => setToast(null), 3000) }

  const filtered = users.filter(u => {
    const s = search.toLowerCase()
    const matchesSearch = u.full_name?.toLowerCase().includes(s) || u.email?.toLowerCase().includes(s) || u.company?.toLowerCase().includes(s)
    const matchesRole = roleFilter === 'all' || u.role === roleFilter
    return matchesSearch && matchesRole
  })

  const handleEdit = (u) => {
    setEditUser(u)
    setEditForm({ full_name: u.full_name || '', role: u.role || '', company: u.company || '', phone: u.phone || '', notes: u.notes || '' })
  }

  const saveEdit = async () => {
    if (!editUser) return
    await api.updateUser(editUser.id, editForm)
    setEditUser(null)
    showToast('User updated')
    fetchUsers()
  }

  const handleSuspend = async (id) => {
    await api.suspendUser(id)
    setConfirmAction(null)
    showToast('User suspended')
    fetchUsers()
  }

  const handleActivate = async (id) => {
    await api.activateUser(id)
    setConfirmAction(null)
    showToast('User activated')
    fetchUsers()
  }

  const handleDelete = async (id) => {
    await api.deleteUser(id)
    setConfirmAction(null)
    showToast('User revoked')
    fetchUsers()
  }

  const roleBadge = (role) => {
    const colors = { admin: 'bg-red-600/20 text-red-400', recruiter: 'bg-blue-600/20 text-blue-400', 'job_seeker': 'bg-green-600/20 text-green-400', provider: 'bg-purple-600/20 text-purple-400' }
    return <span className={`text-xs px-2 py-0.5 rounded-full ${colors[role] || 'bg-slate-600/20 text-slate-400'}`}>{role}</span>
  }

  return (
    <div className="min-h-screen bg-slate-900 flex">
      <Sidebar />
      <main className="flex-1 p-6 overflow-y-auto">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-xl font-bold text-white">Users</h1>
          <span className="text-slate-400 text-sm">{users.length} total</span>
        </div>

        <div className="flex gap-3 mb-4">
          <div className="relative flex-1 max-w-xs">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
            <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="Search users..." className="w-full pl-10 pr-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white text-sm placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <select value={roleFilter} onChange={e => setRoleFilter(e.target.value)} className="bg-slate-800 border border-slate-700 rounded-lg text-white text-sm px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500">
            <option value="all">All Roles</option>
            <option value="admin">Admin</option>
            <option value="recruiter">Recruiter</option>
            <option value="job_seeker">Job Seeker</option>
            <option value="provider">Provider</option>
          </select>
        </div>

        <div className="bg-slate-800/50 rounded-xl border border-slate-700/50 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-700">
                  <th className="text-left px-4 py-3 text-slate-400 font-medium">Name</th>
                  <th className="text-left px-4 py-3 text-slate-400 font-medium">Email</th>
                  <th className="text-left px-4 py-3 text-slate-400 font-medium">Role</th>
                  <th className="text-left px-4 py-3 text-slate-400 font-medium">Company</th>
                  <th className="text-left px-4 py-3 text-slate-400 font-medium">Status</th>
                  <th className="text-left px-4 py-3 text-slate-400 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={6} className="text-center py-8 text-slate-500">Loading...</td></tr>
                ) : filtered.length === 0 ? (
                  <tr><td colSpan={6} className="text-center py-8 text-slate-500">No users found</td></tr>
                ) : filtered.map(u => (
                  <tr key={u.id} className="border-b border-slate-700/50 hover:bg-slate-700/30">
                    <td className="px-4 py-3 text-white">{u.full_name || '—'}</td>
                    <td className="px-4 py-3 text-slate-300">{u.email}</td>
                    <td className="px-4 py-3">{roleBadge(u.role)}</td>
                    <td className="px-4 py-3 text-slate-300">{u.company || '—'}</td>
                    <td className="px-4 py-3">
                      <span className={`text-xs px-2 py-0.5 rounded-full ${u.status === 'suspended' ? 'bg-red-600/20 text-red-400' : 'bg-green-600/20 text-green-400'}`}>
                        {u.status || 'active'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex gap-1">
                        <button onClick={() => handleEdit(u)} className="p-1.5 rounded hover:bg-slate-700 text-slate-400 hover:text-white" title="Edit"><Shield className="w-3.5 h-3.5" /></button>
                        {u.status === 'suspended' ? (
                          <button onClick={() => setConfirmAction({ action: 'activate', id: u.id, name: u.full_name })} className="p-1.5 rounded hover:bg-slate-700 text-green-400 hover:text-green-300" title="Activate"><Check className="w-3.5 h-3.5" /></button>
                        ) : (
                          <button onClick={() => setConfirmAction({ action: 'suspend', id: u.id, name: u.full_name })} className="p-1.5 rounded hover:bg-slate-700 text-amber-400 hover:text-amber-300" title="Suspend"><AlertTriangle className="w-3.5 h-3.5" /></button>
                        )}
                        <button onClick={() => setConfirmAction({ action: 'delete', id: u.id, name: u.full_name })} className="p-1.5 rounded hover:bg-slate-700 text-red-400 hover:text-red-300" title="Revoke"><Trash2 className="w-3.5 h-3.5" /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {editUser && (
          <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50" onClick={() => setEditUser(null)}>
            <div className="bg-slate-800 rounded-xl p-6 w-full max-w-md mx-4 border border-slate-700" onClick={e => e.stopPropagation()}>
              <h2 className="text-white font-bold mb-4">Edit User</h2>
              <div className="space-y-3">
                <input value={editForm.full_name} onChange={e => setEditForm({...editForm, full_name: e.target.value})} placeholder="Full name" className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white text-sm" />
                <input value={editForm.company} onChange={e => setEditForm({...editForm, company: e.target.value})} placeholder="Company" className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white text-sm" />
                <input value={editForm.phone} onChange={e => setEditForm({...editForm, phone: e.target.value})} placeholder="Phone" className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white text-sm" />
                <select value={editForm.role} onChange={e => setEditForm({...editForm, role: e.target.value})} className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white text-sm">
                  <option value="job_seeker">Job Seeker</option>
                  <option value="recruiter">Recruiter</option>
                  <option value="provider">Provider</option>
                  <option value="admin">Admin</option>
                </select>
                <textarea value={editForm.notes} onChange={e => setEditForm({...editForm, notes: e.target.value})} placeholder="Admin notes" className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white text-sm resize-none h-20" />
              </div>
              <div className="flex gap-2 mt-4">
                <button onClick={() => setEditUser(null)} className="flex-1 px-4 py-2 rounded-lg text-slate-300 hover:bg-slate-700 text-sm">Cancel</button>
                <button onClick={saveEdit} className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium">Save</button>
              </div>
            </div>
          </div>
        )}

        {confirmAction && (
          <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50" onClick={() => setConfirmAction(null)}>
            <div className="bg-slate-800 rounded-xl p-6 w-full max-w-sm mx-4 border border-slate-700" onClick={e => e.stopPropagation()}>
              <h2 className="text-white font-bold mb-2 capitalize">{confirmAction.action} User</h2>
              <p className="text-slate-400 text-sm mb-4">Are you sure you want to {confirmAction.action} <strong className="text-white">{confirmAction.name}</strong>?</p>
              <div className="flex gap-2">
                <button onClick={() => setConfirmAction(null)} className="flex-1 px-4 py-2 rounded-lg text-slate-300 hover:bg-slate-700 text-sm">Cancel</button>
                <button
                  onClick={() => {
                    if (confirmAction.action === 'suspend') handleSuspend(confirmAction.id)
                    else if (confirmAction.action === 'activate') handleActivate(confirmAction.id)
                    else if (confirmAction.action === 'delete') handleDelete(confirmAction.id)
                  }}
                  className={`flex-1 px-4 py-2 rounded-lg text-white text-sm font-medium ${confirmAction.action === 'delete' ? 'bg-red-600 hover:bg-red-500' : confirmAction.action === 'suspend' ? 'bg-amber-600 hover:bg-amber-500' : 'bg-blue-600 hover:bg-blue-700'}`}
                >
                  Confirm
                </button>
              </div>
            </div>
          </div>
        )}

        {toast && (
          <div className="fixed bottom-6 right-6 bg-slate-800 border border-slate-700 text-white px-4 py-2.5 rounded-lg shadow-xl text-sm z-50">
            {toast}
          </div>
        )}
      </main>
    </div>
  )
}
