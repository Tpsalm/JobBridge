import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { getSupabaseFunctionsUrl } from '../lib/supabaseHelpers';

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

export default function EmailLogsAdmin() {
  const [logs, setLogs] = useState<EmailLog[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const functionsBase = getSupabaseFunctionsUrl();

  async function load() {
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

  useEffect(() => {
    load();
  }, []);

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
      await load();
      alert('Resend queued/sent');
    } catch (e: any) {
      alert('Resend failed: ' + (e?.message || String(e)));
    }
  }

  return (
    <div className="p-6">
      <h2 className="text-2xl font-bold mb-4">Email Logs</h2>
      <div className="mb-4 flex items-center gap-2">
        <button onClick={load} className="px-3 py-2 bg-blue-600 text-white rounded">Refresh</button>
        <button
          onClick={async () => {
            if (!functionsBase) return alert('Functions URL not configured');
            const r = await fetch(`${functionsBase}/process-email-queue`, { method: 'POST' });
            const j = await r.json();
            alert('Queue processed: ' + JSON.stringify(j?.processed?.length || j));
            load();
          }}
          className="px-3 py-2 bg-gray-100 rounded"
        >
          Process Queue
        </button>
      </div>
      {loading && <div>Loading…</div>}
      {error && <div className="text-red-600">Error: {error}</div>}
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
              <th className="p-2 text-left">Meta</th>
              <th className="p-2 text-left">Created</th>
              <th className="p-2 text-left">Actions</th>
            </tr>
          </thead>
          <tbody>
            {logs.map((l) => (
              <tr key={l.id} className="border-t">
                <td className="p-2">{l.id}</td>
                <td className="p-2">{l.email}</td>
                <td className="p-2">{l.type}</td>
                <td className="p-2">{l.subject || ''}</td>
                <td className="p-2">{l.status || ''}</td>
                <td className="p-2">{l.resend_id || ''}</td>
                <td className="p-2">{l.meta ? JSON.stringify(l.meta) : ''}</td>
                <td className="p-2">{l.created_at?.replace('T', ' ').replace('Z', '') || ''}</td>
                <td className="p-2">
                  <div className="flex gap-2">
                    <button onClick={() => handleResend(l)} className="px-2 py-1 bg-green-600 text-white rounded">Resend</button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
