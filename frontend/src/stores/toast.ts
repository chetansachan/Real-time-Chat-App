import { create } from 'zustand';

export type ToastTone = 'default' | 'success' | 'error';

export interface Toast {
  id: string;
  title: string;
  description?: string;
  tone: ToastTone;
}

interface ToastState {
  toasts: Toast[];
  push: (toast: { title: string; description?: string; tone?: ToastTone }) => void;
  dismiss: (id: string) => void;
}

const AUTO_DISMISS_MS = 4500;

export const useToastStore = create<ToastState>((set) => ({
  toasts: [],
  push: ({ title, description, tone = 'default' }) => {
    const id = crypto.randomUUID();
    set((state) => ({ toasts: [...state.toasts, { id, title, description, tone }] }));
    window.setTimeout(() => {
      set((state) => ({ toasts: state.toasts.filter((toast) => toast.id !== id) }));
    }, AUTO_DISMISS_MS);
  },
  dismiss: (id) =>
    set((state) => ({ toasts: state.toasts.filter((toast) => toast.id !== id) })),
}));

export const toast = {
  show: (title: string, description?: string) =>
    useToastStore.getState().push({ title, description }),
  success: (title: string, description?: string) =>
    useToastStore.getState().push({ title, description, tone: 'success' }),
  error: (title: string, description?: string) =>
    useToastStore.getState().push({ title, description, tone: 'error' }),
};
