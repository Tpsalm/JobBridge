import { FormEvent, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import Header from '../components/Header';
import BottomNav from '../components/BottomNav';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { ArrowLeft, Flag, Loader2, CheckCircle2 } from 'lucide-react';

const REASONS = ['Scam or fraudulent job', 'Spam or misleading content', 'Harassment or abuse', 'Discrimination', 'Unsafe request', 'Other'];

export default function ReportContent() {
  const { user } = useAuth();
  const [params] = useSearchParams();
  const [reason, setReason] = useState(REASONS[0]);
  const [details, setDetails] = useState('');
  const [status, setStatus] = useState<'idle' | 'saving' | 'success' | 'error'>('idle');
  const [error, setError] = useState('');
  const jobId = params.get('jobId');
  const title = params.get('title') || 'a JobBridge listing';

  const submit = async (event: FormEvent) => {
    event.preventDefault(); setStatus('saving'); setError('');
    const { error: insertError } = await supabase.from('content_reports').insert({ reporter_id: user?.id || null, content_type: jobId ? 'job' : 'other', content_id: jobId || null, reason, details: details.trim() || null });
    if (insertError) { setStatus('error'); setError('We could not submit the report automatically. Please email jobbridgesupport@gmail.com with the listing and reason.'); return; }
    setStatus('success');
  };

  return <div className="min-h-screen bg-gray-50 pb-24"><Header /><main className="max-w-2xl mx-auto px-4 py-8"><Link to="/jobs" className="inline-flex items-center gap-2 text-sm font-medium text-blue-700 hover:text-blue-800 mb-6"><ArrowLeft className="w-4 h-4" />Back to jobs</Link><div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 sm:p-8"><div className="w-12 h-12 rounded-xl bg-amber-50 text-amber-700 flex items-center justify-center mb-4"><Flag className="w-6 h-6" /></div><h1 className="text-2xl font-bold text-gray-900">Report content</h1><p className="text-sm text-gray-600 mt-2">Help us review {title}. Reports are confidential and investigated by the JobBridge team.</p>{status === 'success' ? <div className="mt-6 rounded-xl border border-emerald-200 bg-emerald-50 p-5"><CheckCircle2 className="w-6 h-6 text-emerald-700 mb-2" /><h2 className="font-semibold text-emerald-950">Report received</h2><p className="text-sm text-emerald-900 mt-1">Thank you. We will review this content and take action when appropriate.</p></div> : <form onSubmit={submit} className="mt-6 space-y-4"><div><label htmlFor="report-reason" className="block text-sm font-medium text-gray-800 mb-1">Reason</label><select id="report-reason" value={reason} onChange={e => setReason(e.target.value)} className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:border-blue-600 focus:outline-none">{REASONS.map(item => <option key={item}>{item}</option>)}</select></div><div><label htmlFor="report-details" className="block text-sm font-medium text-gray-800 mb-1">Details</label><textarea id="report-details" required value={details} onChange={e => setDetails(e.target.value)} rows={5} placeholder="Tell us what happened and include any useful context." className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-100" /></div>{error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}<button type="submit" disabled={status === 'saving'} className="inline-flex items-center gap-2 rounded-lg bg-amber-700 px-5 py-3 text-sm font-semibold text-white hover:bg-amber-800 disabled:opacity-60">{status === 'saving' && <Loader2 className="w-4 h-4 animate-spin" />}Submit report</button></form>}</div><p className="text-xs text-gray-500 mt-5">For urgent safety concerns, contact <a className="text-blue-700 hover:underline" href="mailto:jobbridgesupport@gmail.com">jobbridgesupport@gmail.com</a>.</p></main><BottomNav /></div>;
}
