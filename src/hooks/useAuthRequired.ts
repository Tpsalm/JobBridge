import { useAuth } from '../contexts/AuthContext';
import { useModal } from '../contexts/ModalContext';

interface AuthActionOptions {
  action: 'apply-job' | 'message' | 'post-job' | 'hire' | 'service-request' | 'connect' | 'schedule-interview';
  requiredRole?: 'recruiter' | 'provider';
  modalData?: Record<string, unknown>;
}

export function useAuthRequired() {
  const { isAuthenticated, user, profile } = useAuth();
  const { openModal } = useModal();

  const userRole = profile?.role || user?.user_metadata?.role || user?.role;

  const executeIfAuthenticated = (options: AuthActionOptions): boolean => {
    if (!isAuthenticated) {
      openModal('auth-required', {
        pendingAction: options.action,
        requiredRole: options.requiredRole,
        ...options.modalData,
      });
      return false;
    }

    // Check if user has the required role
    if (options.requiredRole && userRole !== options.requiredRole) {
      openModal('auth-required', {
        pendingAction: options.action,
        requiredRole: options.requiredRole,
        ...options.modalData,
      });
      return false;
    }

    return true;
  };

  const openProtectedModal = (options: AuthActionOptions) => {
    if (executeIfAuthenticated(options)) {
      openModal(options.action as any, options.modalData);
    }
  };

  return { isAuthenticated, user, executeIfAuthenticated, openProtectedModal };
}
