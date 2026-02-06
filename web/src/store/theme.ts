const STORAGE_KEY = 'relaxdrive-theme';
export type Theme = 'dark' | 'light';

function getInitial(): Theme {
  if (typeof window === 'undefined') return 'dark';
  try {
    const s = localStorage.getItem(STORAGE_KEY);
    if (s === 'light' || s === 'dark') return s;
  } catch {}
  return 'dark';
}

function applyTheme(theme: Theme) {
  if (typeof document === 'undefined') return;
  document.documentElement.setAttribute('data-theme', theme);
  try {
    localStorage.setItem(STORAGE_KEY, theme);
  } catch {}
}

let current: Theme = getInitial();
applyTheme(current);

const listeners = new Set<(t: Theme) => void>();

export const themeStore = {
  getTheme(): Theme {
    return current;
  },
  setTheme(theme: Theme) {
    if (current === theme) return;
    current = theme;
    applyTheme(theme);
    listeners.forEach((fn) => fn(theme));
  },
  subscribe(fn: (t: Theme) => void) {
    listeners.add(fn);
    return () => listeners.delete(fn);
  },
};
