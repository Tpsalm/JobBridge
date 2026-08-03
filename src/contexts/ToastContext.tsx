import React, { createContext, useContext, useState, ReactNode, useCallback } from 'react';
import { useEffect } from 'react';

// 'message' is a reserved type used to suppress floating message popups — the
// UNIFIED CHAT SPACE rule says message content may only appear inside the
// dedicated thread, never as a toast/notification. push() drops these.
type Toast = { id: string; message: string; type?: 'success' | 'error' | 'info' | 'message' };

const ToastContext = createContext({
  toasts: [] as Toast[],
  push: (t: Omit<Toast, 'id'>) => {},
  remove: (id: string) => {},
});

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const push = useCallback((t: Omit<Toast, 'id'>) => {
    if (t.type === 'message') return;
    const id = Math.random().toString(36).slice(2, 9);
    const toast = { id, ...t } as Toast;
    setToasts((s) => [toast, ...s]);
    setTimeout(() => setToasts((s) => s.filter((x) => x.id !== id)), 5000);
  }, []);

  const remove = useCallback((id: string) => setToasts((s) => s.filter((t) => t.id !== id)), []);
  // Global event listener for simple cross-component toasts
  useEffect(() => {
    const handler = (e: any) => {
      const d = e.detail || {};
      if (d && d.message) push({ message: d.message, type: d.type || 'info' });
    };
    window.addEventListener('jobbridge:toast', handler as EventListener);
    return () => window.removeEventListener('jobbridge:toast', handler as EventListener);
  }, [push]);

  return <ToastContext.Provider value={{ toasts, push, remove }}>{children}</ToastContext.Provider>;
}

export function useToasts() {
  return useContext(ToastContext);
}
