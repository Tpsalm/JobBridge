import { useState, useEffect } from 'react'
import { History, Shield, LogIn, UserCheck, XCircle } from 'lucide-react'
import Sidebar from '../components/Sidebar'
import { api } from '../api'

const seedLogs = [
  { id: 1, action: 'Admin login', admin: 'superadmin', target: '—', timestamp: new Date(Date.now() - 60000).toISOString(), type: 'login' },
  { id: 2, action: 'Approved job posting', admin: 'superadmin', target: 'Senior Developer at TechCorp', timestamp: new Date(Date.now() - 120000).toISOString(), type: 'approve' },
  { id: 3, action: 'Suspended user account', admin: 'superadmin', target: 'user@example.com', timestamp: new Date(Date.now() - 300000).toISOString(), type: 'suspend' },
  { id: 4, action: 'Activated provider', admin: 'superadmin', target: 'Grace Media', timestamp: new Date(Date.now() - 600000).toISOString(), type: 'activate' },
  { id: 5, action: 'Rejected job', admin: 'superadmin', target: 'Junior Designer at ABC', timestamp: new Date(Date.now() - 900000).toISOString(), type: 'reject' },
]

const actionIcons = {
  login: LogIn,
  approve: Shield,
  suspend: XCircle,
  activate: UserCheck,
  reject: XCircle,
}

const actionColors = {
  login: 'text-blue-400',
  approve: 'text-emerald-400',
  suspend: 'text-red-400',
  activate: 'text-green-400',
  reject: 'text-red-400',
}

export default function AuditLog() {
  const [logs, setLogs] = useState(seedLogs)
  const [filter, setFilter] = useState('all')

  const filtered = filter === 'all' ? logs : logs.filter(l => l.type === filter)

  return (
    <div className="min-h-screen bg-slate-900 flex">
      <Sidebar />
      <main className="flex-1 p-6 overflow-y-auto">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-xl font-bold text-white">Audit Log</h1>
          <span className="text-slate-400 text-sm">{logs.length} entries</span>
        </div>

        <div className="flex gap-2 mb-4 flex-wrap">
          {['all', 'login', 'approve', 'suspend', 'activate', 'reject'].map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors capitalize ${
                filter === f
                  ? 'bg-blue-600/20 text-blue-400'
                  : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
              }`}
            >
              {f === 'all' ? 'All Actions' : f}
            </button>
          ))}
        </div>

        <div className="bg-slate-800/50 rounded-xl border border-slate-700/50 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-700">
                  <th className="text-left px-4 py-3 text-slate-400 font-medium">Action</th>
                  <th className="text-left px-4 py-3 text-slate-400 font-medium">Admin</th>
                  <th className="text-left px-4 py-3 text-slate-400 font-medium">Target</th>
                  <th className="text-left px-4 py-3 text-slate-400 font-medium">Time</th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr><td colSpan={4} className="text-center py-8 text-slate-500">No audit entries</td></tr>
                ) : filtered.map(log => {
                  const Icon = actionIcons[log.type] || Shield
                  return (
                    <tr key={log.id} className="border-b border-slate-700/50 hover:bg-slate-700/30">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <Icon className={`w-4 h-4 ${actionColors[log.type] || 'text-slate-400'}`} />
                          <span className="text-white">{log.action}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-slate-300">{log.admin}</td>
                      <td className="px-4 py-3 text-slate-300">{log.target}</td>
                      <td className="px-4 py-3 text-slate-400 text-xs">
                        {new Date(log.timestamp).toLocaleString()}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      </main>
    </div>
  )
}
