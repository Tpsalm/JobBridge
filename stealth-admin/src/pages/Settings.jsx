import { useState } from 'react'
import { Shield, Key, Eye, EyeOff, Save } from 'lucide-react'
import Sidebar from '../components/Sidebar'

export default function Settings() {
  const [adminId, setAdminId] = useState('superadmin')
  const [password, setPassword] = useState('••••••••••••••••')
  const [showPw, setShowPw] = useState(false)
  const [saved, setSaved] = useState(false)

  const handleSave = () => {
    setSaved(true)
    setTimeout(() => setSaved(false), 3000)
  }

  return (
    <div className="min-h-screen bg-slate-900 flex">
      <Sidebar />
      <main className="flex-1 p-6 overflow-y-auto">
        <h1 className="text-xl font-bold text-white mb-6">Settings</h1>

        <div className="max-w-2xl space-y-6">
          <div className="bg-slate-800/50 rounded-xl p-6 border border-slate-700/50">
            <h2 className="text-sm font-bold text-white mb-4 flex items-center gap-2">
              <Shield className="w-4 h-4 text-blue-400" /> Admin Credentials
            </h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1.5">Admin ID</label>
                <div className="relative">
                  <Key className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                  <input
                    type="text"
                    value={adminId}
                    onChange={e => setAdminId(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1.5">Password</label>
                <div className="relative">
                  <Key className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                  <input
                    type={showPw ? 'text' : 'password'}
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    className="w-full pl-10 pr-10 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <button type="button" onClick={() => setShowPw(!showPw)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300">
                    {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                <p className="text-xs text-slate-500 mt-1.5">Changes take effect after server restart (update .env file)</p>
              </div>
            </div>
            <button
              onClick={handleSave}
              className="mt-4 flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-medium px-4 py-2 rounded-lg transition-colors text-sm"
            >
              <Save className="w-4 h-4" />
              Save Changes
            </button>
            {saved && (
              <p className="mt-2 text-emerald-400 text-xs">Settings noted. Update .env file and restart server for changes to take effect.</p>
            )}
          </div>

          <div className="bg-slate-800/50 rounded-xl p-6 border border-slate-700/50">
            <h2 className="text-sm font-bold text-white mb-4">Platform Info</h2>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between text-slate-400">
                <span>Server</span>
                <span className="text-white">localhost:5050</span>
              </div>
              <div className="flex justify-between text-slate-400">
                <span>Admin Console</span>
                <span className="text-white">v1.0.0</span>
              </div>
              <div className="flex justify-between text-slate-400">
                <span>Environment</span>
                <span className="text-white">Development</span>
              </div>
              <div className="flex justify-between text-slate-400">
                <span>Database</span>
                <span className="text-white">SQLite / JSON</span>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}
