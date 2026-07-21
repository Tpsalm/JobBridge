import { ReactNode, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useModal } from '../contexts/ModalContext';

interface ProtectedRouteProps {
  children: ReactNode;
}

export default function ProtectedRoute({ children }: ProtectedRouteProps) {
  const { isAuthenticated, loading: authLoading } = useAuth();
  const _location = useLocation();
  const { openModal } = useModal();

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      openModal('signup', { pendingAction: 'access-page' });
    }
  }, [authLoading, isAuthenticated, openModal]);

  if (authLoading) {
    return null;
  }

  if (!isAuthenticated) {
    return null;
  }

  return <>{children}</>;
}
