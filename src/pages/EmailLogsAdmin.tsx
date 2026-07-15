import React, { useEffect, useState } from 'react';
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

export default function EmailLogsAdmin() {
  const { profile, isAuthenticated } = useAuth();
  const [tab, setTab] = useState<'logs' | 'queue'>('logs');
  const [logs, setLogs] = useState<EmailLog[]>([]);
  const [queue, setQueue] = useState<EmailQueueItem[]>([]);
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
    } else {
      loadQueue();
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
        <button type="button" onClick={() => (tab === 'logs' ? loadLogs() : loadQueue())} className="px-3 py-2 bg-gray-100 rounded">
          Refresh
        </button>
        <button type="button" onClick={() => handleProcessQueue()} className="px-3 py-2 bg-gray-100 rounded">
          Process Queue
        </button>
      </div>

      {loading && <div className="text-sm text-gray-500 mb-4">Loading…</div>}
      {tab === 'logs' && error && <div className="text-red-600 mb-4">Error: {error}</div>}
      {tab === 'queue' && queueError && <div className="text-red-600 mb-4">Error: {queueError}</div>}

      {tab === 'logs' ? (
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
