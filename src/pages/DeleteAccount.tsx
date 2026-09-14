import { FormEvent, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import Header from '../components/Header';
import BottomNav from '../components/BottomNav';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { ArrowLeft, CheckCircle2, Loader2, Trash2 } from 'lucide-react';

export default function DeleteAccount() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState(user?.email || '');
  const [reason, setReason] = useState('');
  const [confirmed, setConfirmed] = useState(false);
  const [status, setStatus] = useState<'idle' | 'saving' | 'success' | 'error'>('idle');
  const [error, setError] = useState('');

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!confirmed) { setError('Please confirm that you want your account and personal data deleted.'); return; }
    if (!email.trim()) { setError('Enter the email address associated with your account.'); return; }
    setStatus('saving'); setError('');
    const { error: insertError } = await supabase.from('data_deletion_requests').insert({ email: email.trim(), user_id: user?.id || null, reason: reason.trim() || null });
    if (insertError) { setStatus('error'); setError('We could not submit the request automatically. Email jobbridgesupport@gmail.com from your account address so we can verify and process it.'); return; }
    setStatus('success');
  };

  return <div className="min-h-screen bg-gray-50 pb-24"><Header /><main className="max-w-2xl mx-auto px-4 py-8">
    <Link to={user ? '/profile' : '/'} className="inline-flex items-center gap-2 text-sm font-medium text-blue-700 hover:text-blue-800 mb-6"><ArrowLeft className="w-4 h-4" />Back</Link>
    <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 sm:p-8"><div className="w-12 h-12 rounded-xl bg-red-50 text-red-700 flex items-center justify-center mb-4"><Trash2 className="w-6 h-6" /></div><h1 className="text-2xl font-bold text-gray-900">Delete your JobBridge account</h1><p className="text-sm leading-relaxed text-gray-600 mt-3">This request starts deletion of your account, profile, resumes, applications, and other personal data. Some records may be retained when required by law. This action cannot be undone.</p>
      {status === 'success' ? <div className="mt-6 rounded-xl border border-emerald-200 bg-emerald-50 p-5"><CheckCircle2 className="w-6 h-6 text-emerald-700 mb-2" /><h2 className="font-semibold text-emerald-950">Request received</h2><p className="text-sm text-emerald-900 mt-1">We will verify the request and contact you at the address provided. You may sign out while it is processed.</p><button onClick={() => { signOut(); navigate('/'); }} className="mt-4 rounded-lg bg-emerald-700 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-800">Sign out</button></div> : <form onSubmit={submit} className="mt-6 space-y-4"><div><label htmlFor="deletion-email" className="block text-sm font-medium text-gray-800 mb-1">Account email</label><input id="deletion-email" type="email" required value={email} onChange={e => setEmail(e.target.value)} className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-100" /></div><div><label htmlFor="deletion-reason" className="block text-sm font-medium text-gray-800 mb-1">Reason (optional)</label><textarea id="deletion-reason" value={reason} onChange={e => setReason(e.target.value)} rows={3} className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-100" /></div><label className="flex items-start gap-3 text-sm text-gray-700"><input type="checkbox" checked={confirmed} onChange={e => setConfirmed(e.target.checked)} className="mt-1 h-4 w-4" />I understand that my account and personal data will be permanently deleted after verification.</label>{error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}<button type="submit" disabled={status === 'saving'} className="inline-flex items-center justify-center gap-2 rounded-lg bg-red-700 px-5 py-3 text-sm font-semibold text-white hover:bg-red-800 disabled:opacity-60">{status === 'saving' && <Loader2 className="w-4 h-4 animate-spin" />}Submit deletion request</button></form>}
    </div><p className="text-xs text-gray-500 mt-5">You can also request deletion by emailing <a className="text-blue-700 hover:underline" href="mailto:jobbridgesupport@gmail.com">jobbridgesupport@gmail.com</a>. See our <Link to="/privacy" className="text-blue-700 hover:underline">Privacy Policy</Link>.</p>
  </main><BottomNav /></div>;
}
