import React, { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { getSupabaseFunctionsUrl } from '../lib/supabaseHelpers';
import { useAuth } from '../contexts/AuthContext';

type EmailLog = {
  id: number;
  email: string;
  type: string;
  subject?: string;
  resend_id?: string;
  status?: string;
  meta?: any;
  created_at?: string;
};

type EmailQueueItem = {
  id: number;
  email: string;
  type?: string;
  attempts?: number;
  last_error?: string;
  status?: string;
  last_attempted_at?: string;
  created_at?: string;
};

type ContentReport = {
  id: string;
  reporter_id?: string | null;
  content_type?: string | null;
  content_id?: string | null;
  reason?: string | null;
  details?: string | null;
  status?: string | null;
  created_at?: string | null;
};

type AdminSubscription = {
  id: string;
  user_id: string;
  plan_key: string;
  product_line: string;
  status: string;
  current_period_end: string;
  auto_renew: boolean;
  canceled_at?: string | null;
  created_at?: string;
};

type BackendCheck = {
  name: string;
  status: 'ready' | 'not_configured' | 'disabled';
  detail: string;
};

export default function EmailLogsAdmin() {
  const { profile, isAuthenticated } = useAuth();
  const [searchParams] = useSearchParams();
  const [tab, setTab] = useState<'logs' | 'queue' | 'reports' | 'subscriptions' | 'health'>(() =>
    searchParams.get('tab') === 'reports'
      ? 'reports'
      : searchParams.get('tab') === 'subscriptions'
        ? 'subscriptions'
        : searchParams.get('tab') === 'health'
          ? 'health'
        : 'logs',
  );
  const [logs, setLogs] = useState<EmailLog[]>([]);
  const [queue, setQueue] = useState<EmailQueueItem[]>([]);
  const [reports, setReports] = useState<ContentReport[]>([]);
  const [subscriptions, setSubscriptions] = useState<AdminSubscription[]>([]);
  const [healthChecks, setHealthChecks] = useState<BackendCheck[]>([]);
  const [healthCheckedAt, setHealthCheckedAt] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [queueError, setQueueError] = useState<string | null>(null);
  const [adminError, setAdminError] = useState<string | null>(null);

  const functionsBase = getSupabaseFunctionsUrl();

  useEffect(() => {
    if (!isAuthenticated) return;
    if (!profile || profile.role !== 'admin') {
      setAdminError('You do not have permission to access this page.');
      return;
    }
    setAdminError(null);
    if (tab === 'logs') {
      loadLogs();
    } else if (tab === 'queue') {
      loadQueue();
    } else if (tab === 'reports') {
      loadReports();
    } else if (tab === 'health') {
      loadHealth();
    } else {
      loadSubscriptions();
    }
  }, [isAuthenticated, profile, tab]);

  async function loadLogs() {
    setLoading(true);
    setError(null);
    try {
      const { data, error } = await supabase
        .from('email_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(200);
      if (error) throw error;
      setLogs((data || []) as EmailLog[]);
    } catch (e: any) {
      setError(e.message || String(e));
    } finally {
      setLoading(false);
    }
  }

  async function loadQueue() {
    setLoading(true);
    setQueueError(null);
    try {
      const { data, error } = await supabase
        .from('email_queue')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(200);
      if (error) throw error;
      setQueue((data || []) as EmailQueueItem[]);
    } catch (e: any) {
      setQueueError(e.message || String(e));
    } finally {
      setLoading(false);
    }
  }

  async function loadReports() {
    setLoading(true);
    setError(null);
    try {
      const { data, error } = await supabase
        .from('content_reports')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(200);
      if (error) throw error;
      setReports((data || []) as ContentReport[]);
    } catch (e: any) {
      setError(e.message || String(e));
    } finally {
      setLoading(false);
    }
  }

  async function loadSubscriptions() {
    setLoading(true);
    setError(null);
    try {
      const { data, error } = await supabase
        .from('subscriptions')
        .select('id, user_id, plan_key, product_line, status, current_period_end, auto_renew, canceled_at, created_at')
        .order('created_at', { ascending: false })
        .limit(200);
      if (error) throw error;
      setSubscriptions((data || []) as AdminSubscription[]);
    } catch (e: any) {
      setError(e.message || String(e));
    } finally {
      setLoading(false);
    }
  }

  async function loadHealth() {
    setLoading(true);
    setError(null);
    try {
      const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
      if (sessionError) throw sessionError;
      if (!sessionData.session?.access_token) throw new Error('Your administrator session has expired. Sign in again.');
      const response = await fetch('/api/admin-health', {
        headers: { Authorization: `Bearer ${sessionData.session.access_token}` },
      });
      const result = await response.json().catch(() => null) as { checks?: BackendCheck[]; checkedAt?: string; error?: string } | null;
      if (!response.ok || !result?.checks) throw new Error(result?.error || 'Could not load backend health.');
      setHealthChecks(result.checks);
      setHealthCheckedAt(result.checkedAt || null);
    } catch (healthError) {
      setError(healthError instanceof Error ? healthError.message : 'Could not load backend health.');
    } finally {
      setLoading(false);
    }
  }

  async function handleResend(log: EmailLog) {
    if (!functionsBase) return alert('Functions URL not configured. Set VITE_SUPABASE_FUNCTIONS_URL');
    const payload: any = { type: log.type, email: log.email };
    if (log.meta?.name) payload.name = log.meta.name;
    if (log.meta?.jobTitle) payload.jobTitle = log.meta.jobTitle;
    if (log.meta?.company) payload.company = log.meta.company;

    try {
      const r = await fetch(`${functionsBase}/send-email`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j?.error || 'Failed to resend');
      await loadLogs();
      alert('Resend queued/sent');
    } catch (e: any) {
      alert('Resend failed: ' + (e?.message || String(e)));
    }
  }

  async function handleDeleteQueueItem(item: EmailQueueItem) {
    try {
      const { error } = await supabase.from('email_queue').delete().eq('id', item.id);
      if (error) throw error;
      await loadQueue();
    } catch (e: any) {
      setQueueError(e.message || String(e));
    }
  }

  async function handleProcessQueue(queueItemId?: number) {
    if (!functionsBase) return alert('Functions URL not configured');
    try {
      const r = await fetch(`${functionsBase}/process-email-queue`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(queueItemId ? { queue_item_id: queueItemId } : {}),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j?.error || 'Failed to process queue');
      await loadQueue();
      alert(`Processed ${j?.processed?.length ?? 0} queue item(s).`);
    } catch (e: any) {
      alert('Process queue failed: ' + (e?.message || String(e)));
    }
  }

  if (!isAuthenticated) {
    return (
      <div className="p-6">
        <h2 className="text-2xl font-bold mb-4">Email Admin</h2>
        <p className="text-red-600">Please sign in to access the email admin dashboard.</p>
      </div>
    );
  }

  if (adminError) {
    return (
      <div className="p-6">
        <h2 className="text-2xl font-bold mb-4">Email Admin</h2>
        <p className="text-red-600">{adminError}</p>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <h2 className="text-2xl font-bold">Email Logs Admin</h2>
        <button
          type="button"
          onClick={() => setTab('logs')}
          className={`px-3 py-2 rounded ${tab === 'logs' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700'}`}
        >
          Logs
        </button>
        <button
          type="button"
          onClick={() => setTab('queue')}
          className={`px-3 py-2 rounded ${tab === 'queue' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700'}`}
        >
          Queue
        </button>
        <button
          type="button"
          onClick={() => setTab('reports')}
          className={`px-3 py-2 rounded ${tab === 'reports' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700'}`}
        >
          Reports
        </button>
        <button
          type="button"
          onClick={() => setTab('subscriptions')}
          className={`px-3 py-2 rounded ${tab === 'subscriptions' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700'}`}
        >
          Subscriptions
        </button>
        <button
          type="button"
          onClick={() => setTab('health')}
          className={`px-3 py-2 rounded ${tab === 'health' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700'}`}
        >
          API Health
        </button>
        <button type="button" onClick={() => (tab === 'logs' ? loadLogs() : tab === 'queue' ? loadQueue() : tab === 'reports' ? loadReports() : tab === 'health' ? loadHealth() : loadSubscriptions())} className="px-3 py-2 bg-gray-100 rounded">
          Refresh
        </button>
        <button type="button" onClick={() => handleProcessQueue()} className="px-3 py-2 bg-gray-100 rounded">
          Process Queue
        </button>
      </div>

      {loading && <div className="text-sm text-gray-500 mb-4">Loading…</div>}
      {tab === 'logs' && error && <div className="text-red-600 mb-4">Error: {error}</div>}
      {tab === 'queue' && queueError && <div className="text-red-600 mb-4">Error: {queueError}</div>}
      {tab === 'reports' && error && <div className="text-red-600 mb-4">Error: {error}</div>}
      {tab === 'subscriptions' && error && <div className="text-red-600 mb-4">Error: {error}</div>}
      {tab === 'health' && error && <div role="alert" className="text-red-700 mb-4">Error: {error}</div>}

      {tab === 'health' ? (
        <section aria-label="Backend API health" className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm text-gray-600">Configuration status only; provider delivery is not simulated or triggered.</p>
            {healthCheckedAt && <p className="text-xs text-gray-500">Checked {new Date(healthCheckedAt).toLocaleString()}</p>}
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {healthChecks.map((check) => (
              <article key={check.name} className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
                <div className="flex items-start justify-between gap-3">
                  <h3 className="font-semibold text-gray-900">{check.name}</h3>
                  <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold ${
                    check.status === 'ready' ? 'bg-emerald-100 text-emerald-800' :
                    check.status === 'disabled' ? 'bg-slate-100 text-slate-700' : 'bg-amber-100 text-amber-800'
                  }`}>
                    {check.status === 'ready' ? 'Ready' : check.status === 'disabled' ? 'Disabled' : 'Not configured'}
                  </span>
                </div>
                <p className="mt-2 text-sm text-gray-600">{check.detail}</p>
              </article>
            ))}
          </div>
        </section>
      ) : tab === 'subscriptions' ? (
        <div className="overflow-auto border rounded">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="p-2 text-left">User ID</th>
                <th className="p-2 text-left">Product</th>
                <th className="p-2 text-left">Plan</th>
                <th className="p-2 text-left">Status</th>
                <th className="p-2 text-left">Next charge / period end</th>
                <th className="p-2 text-left">Auto-renew</th>
                <th className="p-2 text-left">Created</th>
              </tr>
            </thead>
            <tbody>
              {subscriptions.length === 0 ? (
                <tr><td colSpan={7} className="p-4 text-gray-500">No subscriptions yet.</td></tr>
              ) : subscriptions.map((item) => (
                <tr key={item.id} className="border-t">
                  <td className="p-2 align-top font-mono text-xs">{item.user_id}</td>
                  <td className="p-2 align-top capitalize">{item.product_line}</td>
                  <td className="p-2 align-top">{item.plan_key.replace(/_/g, ' ')}</td>
                  <td className="p-2 align-top capitalize">{item.status.replace(/_/g, ' ')}</td>
                  <td className="p-2 align-top">{item.current_period_end ? new Date(item.current_period_end).toLocaleString() : '—'}</td>
                  <td className="p-2 align-top">{item.auto_renew ? 'Yes' : 'No'}</td>
                  <td className="p-2 align-top">{item.created_at ? new Date(item.created_at).toLocaleString() : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : tab === 'reports' ? (
        <div className="overflow-auto border rounded">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="p-2 text-left">ID</th>
                <th className="p-2 text-left">Content Type</th>
                <th className="p-2 text-left">Reason</th>
                <th className="p-2 text-left">Status</th>
                <th className="p-2 text-left">Details</th>
                <th className="p-2 text-left">Created</th>
              </tr>
            </thead>
            <tbody>
              {reports.length === 0 ? (
                <tr><td colSpan={6} className="p-4 text-gray-500">No reports yet.</td></tr>
              ) : reports.map((report) => (
                <tr key={report.id} className="border-t">
                  <td className="p-2 align-top">{report.id.slice(0, 8)}</td>
                  <td className="p-2 align-top">{report.content_type || 'n/a'}</td>
                  <td className="p-2 align-top">{report.reason || '—'}</td>
                  <td className="p-2 align-top"><span className="rounded-full bg-amber-100 px-2 py-1 text-[11px] font-semibold text-amber-700">{report.status || 'pending'}</span></td>
                  <td className="p-2 align-top max-w-md whitespace-pre-wrap">{report.details || '—'}</td>
                  <td className="p-2 align-top">{report.created_at ? new Date(report.created_at).toLocaleString() : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : tab === 'logs' ? (
        <div className="overflow-auto border rounded">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="p-2 text-left">ID</th>
                <th className="p-2 text-left">Email</th>
                <th className="p-2 text-left">Type</th>
                <th className="p-2 text-left">Subject</th>
                <th className="p-2 text-left">Status</th>
                <th className="p-2 text-left">Resend ID</th>
                <th className="p-2 text-left">Created</th>
                <th className="p-2 text-left">Actions</th>
              </tr>
            </thead>
            <tbody>
              {logs.map((log) => (
                <tr key={log.id} className="border-t hover:bg-gray-50">
                  <td className="p-2">{log.id}</td>
                  <td className="p-2 max-w-xs truncate">{log.email}</td>
                  <td className="p-2">{log.type}</td>
                  <td className="p-2 max-w-xs truncate">{log.subject || ''}</td>
                  <td className="p-2">{log.status || ''}</td>
                  <td className="p-2 max-w-xs truncate">{log.resend_id || ''}</td>
                  <td className="p-2">{log.created_at?.replace('T', ' ').replace('Z', '') || ''}</td>
                  <td className="p-2">
                    <button onClick={() => handleResend(log)} className="px-2 py-1 bg-green-600 text-white rounded">
                      Resend
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="overflow-auto border rounded">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="p-2 text-left">ID</th>
                <th className="p-2 text-left">Email</th>
                <th className="p-2 text-left">Type</th>
                <th className="p-2 text-left">Attempts</th>
                <th className="p-2 text-left">Status</th>
                <th className="p-2 text-left">Last Error</th>
                <th className="p-2 text-left">Last Attempted</th>
                <th className="p-2 text-left">Created</th>
                <th className="p-2 text-left">Actions</th>
              </tr>
            </thead>
            <tbody>
              {queue.map((item) => (
                <tr key={item.id} className="border-t hover:bg-gray-50">
                  <td className="p-2">{item.id}</td>
                  <td className="p-2 max-w-xs truncate">{item.email}</td>
                  <td className="p-2">{item.type || ''}</td>
                  <td className="p-2">{item.attempts ?? 0}</td>
                  <td className="p-2">{item.status || 'pending'}</td>
                  <td className="p-2 max-w-xs truncate">{item.last_error || ''}</td>
                  <td className="p-2">{item.last_attempted_at?.replace('T', ' ').replace('Z', '') || ''}</td>
                  <td className="p-2">{item.created_at?.replace('T', ' ').replace('Z', '') || ''}</td>
                  <td className="p-2 flex flex-col gap-2">
                    <button
                      onClick={() => handleProcessQueue(item.id)}
                      className="px-2 py-1 bg-blue-600 text-white rounded"
                    >
                      Retry
                    </button>
                    <button
                      onClick={() => handleDeleteQueueItem(item)}
                      className="px-2 py-1 bg-red-600 text-white rounded"
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
