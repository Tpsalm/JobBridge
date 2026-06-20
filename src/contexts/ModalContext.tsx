import { createContext, useContext, useState, ReactNode } from 'react';

export type ModalType =
  | 'post-job'
  | 'message'
  | 'profile'
  | 'hire'
  | 'premium'
  | 'notifications'
  | 'schedule-interview'
  | 'apply-job'
  | 'service-request'
  | 'ai-resume'
  | 'connect'
  | 'info'
  | 'signup'
  | 'login'
  | 'auth-required'
  | null;

interface ModalData {
  title?: string;
  content?: string;
  name?: string;
  role?: string;
  match?: string;
  company?: string;
  pendingAction?: string; // What action prompted signup: 'apply', 'message', 'post-job', 'hire', 'service-request'
  requiredRole?: 'recruiter' | 'provider'; // Required role for action
  [key: string]: unknown;
}

interface ModalContextType {
  modalType: ModalType;
  modalData: ModalData;
  openModal: (type: ModalType, data?: ModalData) => void;
  closeModal: () => void;
}

const ModalContext = createContext<ModalContextType>({
  modalType: null,
  modalData: {},
  openModal: () => {},
  closeModal: () => {},
});

export function ModalProvider({ children }: { children: ReactNode }) {
  const [modalType, setModalType] = useState<ModalType>(null);
  const [modalData, setModalData] = useState<ModalData>({});

  const openModal = (type: ModalType, data: ModalData = {}) => {
    setModalType(type);
    setModalData(data);
  };

  const closeModal = () => {
    setModalType(null);
    setModalData({});
  };

  return (
    <ModalContext.Provider value={{ modalType, modalData, openModal, closeModal }}>
      {children}
    </ModalContext.Provider>
  );
}

export function useModal() {
  return useContext(ModalContext);
}
