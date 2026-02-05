import { create } from 'zustand';

export type ToastType = 'success' | 'error' | 'info';

export interface ToastItem {
  id: string;
  message: string;
  type: ToastType;
  createdAt: number;
}

interface ToastStore {
  toasts: ToastItem[];
  add: (message: string, type?: ToastType) => void;
  remove: (id: string) => void;
  success: (message: string) => void;
  error: (message: string) => void;
  info: (message: string) => void;
}

let id = 0;
const TOAST_TTL = 4000;

export const useToastStore = create<ToastStore>((set, get) => ({
  toasts: [],
  add(message: string, type: ToastType = 'info') {
    const item: ToastItem = {
      id: `toast-${++id}`,
      message,
      type,
      createdAt: Date.now(),
    };
    set((s) => ({ toasts: [...s.toasts, item].slice(-5) }));
    setTimeout(() => {
      get().remove(item.id);
    }, TOAST_TTL);
  },
  remove(id: string) {
    set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) }));
  },
  success(message: string) {
    get().add(message, 'success');
  },
  error(message: string) {
    get().add(message, 'error');
  },
  info(message: string) {
    get().add(message, 'info');
  },
}));
