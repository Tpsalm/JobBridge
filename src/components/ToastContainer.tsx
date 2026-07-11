import React from 'react';
import { useToasts } from '../contexts/ToastContext';

export default function ToastContainer() {
  const { toasts, remove } = useToasts();
  return (
    <div className="fixed top-5 right-5 z-[9999] flex flex-col gap-2">
      {toasts.map((t) => (
        <div
          key={t.id}
          className={`px-4 py-3 rounded-3xl shadow-xl max-w-sm text-sm ring-1 ring-slate-200 ${
            t.type === 'success'
              ? 'bg-blue-600 text-white'
              : t.type === 'error'
              ? 'bg-red-600 text-white'
              : 'bg-slate-900 text-white'
          }`}
        >
          <div className="flex items-center justify-between gap-3">
            <div className="flex-1 leading-5">{t.message}</div>
            <button onClick={() => remove(t.id)} className="ml-3 opacity-80 hover:opacity-100">✕</button>
          </div>
        </div>
      ))}
    </div>
  );
}
