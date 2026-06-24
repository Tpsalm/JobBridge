import { ReactNode } from 'react';
import { useAuth } from '../contexts/AuthContext';

export default function AdminRoute({ children }: { children: ReactNode }) {
  const { user, profile } = useAuth();

  const isAdmin = user?.role === 'admin' || profile?.role === 'admin';

  if (!isAdmin) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-6xl font-bold text-gray-300 mb-4">404</h1>
          <p className="text-gray-500 text-lg">Page not found</p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
