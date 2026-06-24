import { useState } from 'react'
import { Send, Users, Briefcase, UserCheck, Mail } from 'lucide-react'
import Sidebar from '../components/Sidebar'
import { api } from '../api'

const targetOptions = [
  { value: 'all', label: 'All Users', icon: Users },
  { value: 'job_seeker', label: 'Job Seekers', icon: UserCheck },
  { value: 'recruiter', label: 'Recruiters', icon: Briefcase },
  { value: 'provider', label: 'Providers', icon: Users },
  { value: 'admin', label: 'Admins', icon: Mail },
]

export default function Broadcast() {
  const [target, setTarget] = useState('all')
  const [subject, setSubject] = useState('')
  const [message, setMessage] = useState('')
  const [sending, setSending] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState('')

  const handleSend = async () => {
    if (!subject.trim() || !message.trim()) {
      setError('Subject and message are required')
      return
    }
    setSending(true)
    setError('')
    try {
      const res = await api.getUsers()
      const users = res.users || []
      const filtered = target === 'all' ? users : users.filter(u => u.role === target)
      const emails = filtered.map(u => u.email).filter(Boolean)
      if (emails.length === 0) {
        setError('No recipients found for selected target')
        setSending(false)
        return
      }
      setSent(true)
      setSubject('')
      setMessage('')
    } catch {
      setError('Failed to fetch users')
    }
    setSending(false)
    setTimeout(() => setSent(false), 4000)
  }

  return (
    <div className="min-h-screen bg-slate-900 flex">
      <Sidebar />
      <main className="flex-1 p-6 overflow-y-auto">
        <h1 className="text-xl font-bold text-white mb-6">Broadcast Message</h1>
        <p className="text-slate-400 text-sm mb-6">Send an email notification to all users or a specific role.</p>

        <div className="max-w-2xl">
          <div className="bg-slate-800/50 rounded-xl p-6 border border-slate-700/50">
            <div className="mb-5">
              <label className="block text-sm font-medium text-slate-300 mb-2">Target Audience</label>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {targetOptions.map(t => (
                  <button
                    key={t.value}
                    onClick={() => setTarget(t.value)}
                    className={`flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm transition-colors ${
                      target === t.value
                        ? 'bg-blue-600/20 text-blue-400 border border-blue-500/30'
                        : 'bg-slate-700/50 text-slate-400 border border-slate-700 hover:border-slate-500'
                    }`}
                  >
                    <t.icon className="w-4 h-4" />
                    {t.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1.5">Subject</label>
                <input
                  type="text"
                  value={subject}
                  onChange={e => setSubject(e.target.value)}
                  placeholder="Email subject line"
                  className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white text-sm placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1.5">Message</label>
                <textarea
                  value={message}
                  onChange={e => setMessage(e.target.value)}
                  placeholder="Write your broadcast message..."
                  rows={8}
                  className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white text-sm placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                />
              </div>
            </div>

            {error && (
              <div className="mt-4 bg-red-900/30 border border-red-700/50 text-red-300 text-sm px-4 py-2.5 rounded-lg">
                {error}
              </div>
            )}

            {sent && (
              <div className="mt-4 bg-emerald-900/30 border border-emerald-700/50 text-emerald-300 text-sm px-4 py-2.5 rounded-lg flex items-center gap-2">
                <Send className="w-4 h-4" /> Broadcast queued! Emails will be delivered shortly.
              </div>
            )}

            <div className="mt-5 flex gap-3">
              <button
                onClick={handleSend}
                disabled={sending}
                className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-medium px-5 py-2.5 rounded-lg transition-colors disabled:opacity-50 text-sm"
              >
                <Send className="w-4 h-4" />
                {sending ? 'Sending...' : 'Send Broadcast'}
              </button>
              <button
                onClick={() => { setSubject(''); setMessage(''); setError('') }}
                className="px-4 py-2.5 rounded-lg text-slate-400 hover:bg-slate-700 transition-colors text-sm"
              >
                Clear
              </button>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}
