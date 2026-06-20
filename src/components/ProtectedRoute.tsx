import { ReactNode } from 'react';
import { useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useModal } from '../contexts/ModalContext';

interface ProtectedRouteProps {
  children: ReactNode;
}

export default function ProtectedRoute({ children }: ProtectedRouteProps) {
  const { isAuthenticated } = useAuth();
  const _location = useLocation();
  const { openModal } = useModal();

  if (!isAuthenticated) {
    // Open signup modal instead of redirecting
    openModal('signup', { pendingAction: 'access-page' });
    return null;
  }

  return <>{children}</>;
}
